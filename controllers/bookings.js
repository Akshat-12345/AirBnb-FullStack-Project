// controllers/bookings.js
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user"); 
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY
});

// === 1. INITIATE BOOKING (MAIN BOOKER ORDER CREATION - NO DATABASE SAVE YET) ===
module.exports.initiateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { checkInDate, checkOutDate, isSplitBooking, splitEmails } = req.body;
        const listing = await Listing.findById(id);

        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found" });
        }

        const d1 = new Date(checkInDate);
        const d2 = new Date(checkOutDate);
        const timeDiff = d2.getTime() - d1.getTime();
        let totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        if (totalDays <= 0) {
            totalDays = 1;
        }

        const totalPrice = listing.price * totalDays; 
        let finalPayableAmount = totalPrice; 
        let structuredParticipants = [];

        if (isSplitBooking && splitEmails && splitEmails.length > 0) {
            const cleanEmails = [...new Set(splitEmails)].filter(e => e !== req.user.email);
            const totalHeads = cleanEmails.length + 1; 
            const individualShare = Math.round(totalPrice / totalHeads);

            for (let email of cleanEmails) {
                const foundUser = await User.findOne({ email: email.toLowerCase().trim() });
                if (!foundUser) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Validation Failed: Co-traveler "${email}" is not registered on this platform yet.` 
                    });
                }
                
                structuredParticipants.push({
                    user: foundUser._id,
                    email: foundUser.email,
                    shareAmount: individualShare,
                    hasPaid: false
                });
            }
            finalPayableAmount = individualShare;
        }

        const options = {
            amount: finalPayableAmount * 100, 
            currency: "INR",
            receipt: `rcpt_ord_${Date.now().toString().slice(-8)}`
        };

        const rzpOrder = await razorpay.orders.create(options);

        // 💥 STAGE SAFE: We do not save to MongoDB here. We pass metadata context back to client checkout container.
        res.status(200).json({
            success: true,
            rzpOrder,
            listingId: id,
            checkInDate,
            checkOutDate,
            totalPrice,
            isSplitBooking: isSplitBooking || false,
            structuredParticipants, // Metadata context pass for verification payload
            key_id: process.env.RAZORPAY_KEY_ID,
            user: { name: req.user.username, email: req.user.email }
        });

    } catch (err) {
        console.error("Critical error in booking initiation:", err);
        res.status(500).json({ success: false, message: "Internal Server Error Processing Payments" });
    }
};

// === 2. VERIFY PRIMARY PAYMENT & COMMIT DOCUMENT TO MONGO DB ===
module.exports.verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature, 
            // 💥 METADATA CAPTURE SESSIONS INJECTED IN PAYLOAD FROM FRONTEND CONTAINER
            listingId, 
            checkInDate, 
            checkOutDate, 
            totalPrice, 
            isSplitBooking, 
            structuredParticipants 
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            
            // 💥 DYNAMIC DATABASE WRITER GATEWAY INTERCEPTOR
            // Entry explicitly committed to MongoDB ONLY if payment validation logic passes cleanly
            const newBooking = new Booking({
                listing: listingId,
                user: req.user._id,
                checkInDate,
                checkOutDate,
                totalPrice,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                paymentStatus: isSplitBooking ? "Partially Paid" : "Paid",
                isSplitBooking: isSplitBooking || false,
                splitParticipants: structuredParticipants || [],
                bookingPhase: "Booked"
            });

            await newBooking.save();
            const booking = await Booking.findById(newBooking._id).populate("listing").populate("user");

            if (booking.isSplitBooking) {
                // === AUTOMATED NODEMAILER DISPATCH ENGINE ===
                try {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    for (let friend of booking.splitParticipants) {
                        const checkoutUrl = `${process.env.APP_BASE_URL}/bookings/my-bookings`;
                        
                        const mailOptions = {
                            from: `"Akshat's Airbnb" <${process.env.EMAIL_USER}>`,
                            to: friend.email,
                            subject: `Group Trip Alert: ${booking.user.username} invited you to split a stay!`,
                            html: `
                                <div style="font-family: sans-serif; padding: 20px; color: #222222; max-width: 600px; border: 1px solid #dddddd; border-radius: 12px;">
                                    <h2 style="color: #ff385c; font-size: 24px; margin-bottom: 4px;">Pack Your Bags! 🎒</h2>
                                    <p style="font-size: 15px; margin-top: 0; color: #555555;">You have been added to a group reservation workflow.</p>
                                    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
                                    <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Stay Details:</p>
                                    <p style="margin: 4px 0; font-size: 14px;"><b>Property:</b> ${booking.listing.title}</p>
                                    <p style="margin: 4px 0; font-size: 14px;"><b>Location:</b> ${booking.listing.location}</p>
                                    <p style="margin: 4px 0; font-size: 14px;"><b>Your Share Amount:</b> ₹${friend.shareAmount.toLocaleString("en-IN")}</p>
                                    <div style="margin: 30px 0; text-align: center;">
                                        <a href="${checkoutUrl}" style="background-color: #ff385c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">View Booking & Pay Share</a>
                                    </div>
                                    <p style="font-size: 11px; color: #717171;">Log into your account to clear individual slots or view live matrix synchronization states.</p>
                                </div>
                            `
                        };
                        await transporter.sendMail(mailOptions);
                        console.log(`Mail dispatched to ${friend.email}`);
                    }
                } catch (mailErr) {
                    console.error("Nodemailer block handled gracefully:", mailErr.message);
                }
            } 

            return res.status(200).json({ success: true, bookingId: booking._id });
        } else {
            return res.status(400).json({ success: false, message: "Signature verification failed" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Verification Error" });
    }
};

// === 3. CO-TRAVELER SHARE INITIALIZATION (DASHBOARD CLICK ENGINE) ===
module.exports.initiateSharePayment = async (req, res) => {
    try {
        const { bookingId, participantEmail } = req.body;
        const booking = await Booking.findById(bookingId);

        if (!booking) return res.status(404).json({ success: false, message: "Booking template not found" });

        const participant = booking.splitParticipants.find(p => p.email === participantEmail);
        if (!participant) return res.status(404).json({ success: false, message: "Participant scope matrix mismatch" });

        const options = {
            amount: participant.shareAmount * 100,
            currency: "INR",
            receipt: `rcpt_spl_${Date.now().toString().slice(-8)}`
        };

        const rzpOrder = await razorpay.orders.create(options);
        
        participant.razorpayOrderId = rzpOrder.id;
        await booking.save();

        res.status(200).json({ success: true, rzpOrder, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed processing share node" });
    }
};

// === 4. VERIFY INDIVIDUAL CO-TRAVELER SHARE PAYMENT ===
module.exports.verifySharePayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ success: false, message: "Signature verification failed" });
        }

        const booking = await Booking.findById(bookingId);
        const participant = booking.splitParticipants.find(p => p.razorpayOrderId === razorpay_order_id);

        if (participant) {
            participant.hasPaid = true;
            participant.paidBy = req.user._id; 
            participant.razorpayPaymentId = razorpay_payment_id;
        }

        const allPaid = booking.splitParticipants.every(p => p.hasPaid === true);
        if (allPaid) {
            booking.paymentStatus = "Paid";
        }

        await booking.save();
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal server validation failure" });
    }
};

// === 5. USER BOOKINGS DASHBOARD VIEW ENGINE ===
module.exports.myBookings = async (req, res) => {
    try {
        if (!req.user) {
            req.flash("error", "You must be logged in to view your dashboard!");
            return res.redirect("/login");
        }

        const now = new Date();
        const allBookings = await Booking.find({
            $or: [
                { user: req.user._id },
                { "splitParticipants.user": req.user._id }
            ]
        })
        .populate("listing")
        .populate("user", "username email")
        .populate("splitParticipants.user", "username email")
        .sort({ createdAt: -1 });

        let activeBookings = [];
        let pastBookings = [];
        let totalSpent = 0, totalNights = 0, upcomingTripsCount = 0;

        allBookings.forEach(b => {
            const checkOut = new Date(b.checkOutDate);
            const checkIn = new Date(b.checkInDate);

            if (b.paymentStatus === "Paid" || b.paymentStatus === "Partially Paid") {
                if (b.user._id.equals(req.user._id)) {
                    totalSpent += b.totalPrice;
                } else {
                    const shareNode = b.splitParticipants.find(p => p.user.equals(req.user._id));
                    if (shareNode) totalSpent += shareNode.shareAmount;
                }
                const diffDays = Math.ceil((checkOut - checkIn) / (1000 * 3600 * 24));
                totalNights += diffDays > 0 ? diffDays : 1;
                
                if (checkIn > now) {
                    upcomingTripsCount++;
                }
            }

            // ⚡ LIFECYCLE LOCK IMPLEMENTED: Active section hold till manual waiver settlement
            const isSettledByHost = b.bookingPhase === "CheckedOut" && b.dispute && b.dispute.isFinePaid;
            const isTerminated = ["Refunded", "Cancelled", "Failed"].includes(b.paymentStatus);

            if (isSettledByHost || checkOut < now || isTerminated) {
                if (b.bookingPhase === "CheckedOut" && b.dispute && !b.dispute.isFinePaid) {
                    activeBookings.push(b);
                } else {
                    pastBookings.push(b);
                }
            } else {
                activeBookings.push(b);
            }
        });

        res.render("bookings/myBookings.ejs", { 
            bookings: activeBookings, 
            pastBookings,
            currUser: req.user,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            metrics: { totalSpent, totalTrips: allBookings.length, totalNights, upcomingTripsCount } 
        });
    } catch (err) {
        console.error(err);
        req.flash("error", "Something went wrong while loading customer dashboard!");
        res.redirect("/listings");
    }
};

// === 6. HOST CONTROL ANALYTICS OVERVIEW ===
module.exports.ownerDashboard = async (req, res) => {
    try {
        if (!req.user) {
            req.flash("error", "You must be logged in to access the control panel!");
            return res.redirect("/login");
        }

        const myListings = await Listing.find({ owner: req.user._id });
        const listingIds = myListings.map(l => l._id);

        const incomingBookings = await Booking.find({ 
            listing: { $in: listingIds }
        })
        .populate("listing")
        .populate("user", "username email")
        .sort({ createdAt: -1 });

        let activeReservationsLogs = [];
        let pastArchiveHistory = [];
        let totalRevenue = 0, activeReservations = 0;
        const now = new Date();

        incomingBookings.forEach(b => {
            const checkIn = new Date(b.checkInDate);
            const checkOut = new Date(b.checkOutDate);

            if (b.paymentStatus === "Paid" || b.paymentStatus === "Partially Paid") {
                totalRevenue += b.totalPrice;
                if (now >= checkIn && now <= checkOut) {
                    activeReservations++;
                }
            }

            // ⚡ LIFECYCLE LOCK IMPLEMENTED: Keeps user inside streaming logs queue until fine clears or marked clean
            const isSettledByHost = b.bookingPhase === "CheckedOut" && b.dispute && b.dispute.isFinePaid;
            const isTerminated = ["Refunded", "Cancelled", "Failed"].includes(b.paymentStatus);

            if (isSettledByHost || checkOut < now || isTerminated) {
                if (b.bookingPhase === "CheckedOut" && b.dispute && !b.dispute.isFinePaid) {
                    activeReservationsLogs.push(b);
                } else {
                    pastArchiveHistory.push(b);
                }
            } else {
                activeReservationsLogs.push(b);
            }
        });

        res.render("bookings/ownerDashboard.ejs", { 
            myListings, 
            incomingBookings: activeReservationsLogs, 
            pastArchiveHistory,
            metrics: { totalRevenue, totalBookings: activeReservationsLogs.length, activeReservations }
        });
    } catch (err) {
        console.error(err);
        req.flash("error", "Failed to compile host analytics reporting stack!");
        res.redirect("/listings");
    }
};