const path = require("path");
if (process.env.NODE_ENV !== "production") {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

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

// === 1. INITIATE BOOKING (MAIN BOOKER ORDER CREATION) ===
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

        const newBooking = new Booking({
            listing: id,
            user: req.user._id, 
            checkInDate,
            checkOutDate,
            totalPrice,
            razorpayOrderId: rzpOrder.id, 
            paymentStatus: isSplitBooking ? "Pending Split" : "Pending",
            isSplitBooking: isSplitBooking || false,
            splitParticipants: structuredParticipants,
            bookingPhase: "Booked" 
        });

        await newBooking.save();

        res.status(200).json({
            success: true,
            rzpOrder,
            bookingId: newBooking._id,
            key_id: process.env.RAZORPAY_KEY_ID,
            user: { name: req.user.username, email: req.user.email }
        });

    } catch (err) {
        console.error("Critical error in booking initiation:", err);
        res.status(500).json({ success: false, message: "Internal Server Error Processing Payments" });
    }
};

// === 2. VERIFY PRIMARY PAYMENT & TRIGGER AUTOMATED EMAILS ===
module.exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            const booking = await Booking.findById(bookingId).populate("listing").populate("user");
            
            if (!booking.isSplitBooking) {
                booking.paymentStatus = "Paid";
            } else {
                booking.paymentStatus = "Partially Paid";

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
            
            booking.razorpayPaymentId = razorpay_payment_id;
            await booking.save();

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
            // 💥 FIXED TRATING VECTOR FOR CRON AUTO-REFUNDS
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

// =========================================================================
// 📸 NEW CORE FEATURE: SUBMIT CHECK-IN MULTI-MEDIA VERIFICATION
// =========================================================================
module.exports.submitCheckInVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            req.flash("error", "Booking transaction record not found!");
            return res.redirect("/bookings/my-bookings");
        }

        if (!booking.user.equals(req.user._id)) {
            req.flash("error", "Unauthorized: Only the primary traveler can commit check-in assets.");
            return res.redirect("/bookings/my-bookings");
        }

        if (booking.paymentStatus !== "Paid") {
            req.flash("error", "Access Denied: Verification locked until full split balances are completely settled!");
            return res.redirect("/bookings/my-bookings");
        }

        const todayStr = new Date().toISOString().split("T")[0];
        const checkInStr = new Date(booking.checkInDate).toISOString().split("T")[0];
        
        if (todayStr !== checkInStr) {
            req.flash("error", `Access Denied: Check-in media portal opens strictly on your booking date (${checkInStr})!`);
            return res.redirect("/bookings/my-bookings");
        }

        if (!req.files || !req.files["checkInPhotos"] || !req.files["checkInVideo"]) {
            req.flash("error", "Validation Error: Please record and attach 2 Photos and 1 Video completely.");
            return res.redirect("/bookings/my-bookings");
        }

        const photoFiles = req.files["checkInPhotos"];
        let structuredPhotos = photoFiles.map(file => ({
            url: file.path,
            filename: file.filename
        }));

        const videoFile = req.files["checkInVideo"][0];
        let structuredVideo = {
            url: videoFile.path,
            filename: videoFile.filename
        };

        booking.checkInMedia = {
            photos: structuredPhotos,
            video: structuredVideo,
            uploadedAt: new Date()
        };

        booking.bookingPhase = "CheckedIn";

        await booking.save();
        req.flash("success", "🎉 Check-in verification assets secured successfully! Welcome to your stay.");
        res.redirect("/bookings/my-bookings");

    } catch (error) {
        console.error("🚨 Critical failure in check-in verification parser:", error);
        req.flash("error", "System Error occurred while processing video upload arrays.");
        res.redirect("/bookings/my-bookings");
    }
};

// =========================================================================
// 📸 NEW CORE FEATURE: SUBMIT CHECK-OUT MULTI-MEDIA VERIFICATION (PHASE 6 & 7)
// =========================================================================
module.exports.submitCheckOutVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate("listing").populate("user");

        if (!booking) {
            req.flash("error", "Booking log record not found!");
            return res.redirect("/bookings/my-bookings");
        }

        if (!booking.user.equals(req.user._id)) {
            req.flash("error", "Unauthorized: Only the primary traveler can push checkout assets.");
            return res.redirect("/bookings/my-bookings");
        }

        if (!req.files || !req.files["checkOutPhotos"] || !req.files["checkOutVideo"]) {
            req.flash("error", "Validation Matrix Broken: Please attach 2 Room Photos and 1 continuous video sequence.");
            return res.redirect("/bookings/my-bookings");
        }

        const photoFiles = req.files["checkOutPhotos"];
        let structuredPhotos = photoFiles.map(file => ({
            url: file.path,
            filename: file.filename
        }));

        const videoFile = req.files["checkOutVideo"][0];
        let structuredVideo = {
            url: videoFile.path,
            filename: videoFile.filename
        };

        booking.checkOutMedia = {
            photos: structuredPhotos,
            video: structuredVideo,
            uploadedAt: new Date()
        };

        booking.bookingPhase = "CheckedOut";
        await booking.save();

        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const reviewRedirectUrl = `${process.env.APP_BASE_URL}/listings/${booking.listing._id}`;

            const mailOptions = {
                from: `"Akshat's Airbnb" <${process.env.EMAIL_USER}>`,
                to: booking.user.email,
                subject: `🔒 Action Required: Complete your stay review for ${booking.listing.title}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #222222; max-width: 600px; border: 1px solid #ff385c; border-radius: 12px;">
                        <h2 style="color: #ff385c; font-size: 22px; margin-bottom: 4px;">Thank You for Staying! 🙏</h2>
                        <p style="font-size: 15px; margin-top: 0; color: #555555;">Your checkout structural verification assets have been recorded safely.</p>
                        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
                        <p style="font-size: 15px; font-weight: bold; color: #bd1e59;">⚠️ Final Security Step Pending:</p>
                        <p style="font-size: 14px; line-height: 1.5; color: #666;">As per the platform's security layout guidelines, you are required to submit an honest feedback review to completely clear your booking ledger bounds.</p>
                        <div style="margin: 25px 0; text-align: center;">
                            <a href="${reviewRedirectUrl}" style="background-color: #ff385c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Submit Property Review</a>
                        </div>
                        <p style="font-size: 11px; color: #717171;">Note: System navigation holds will automatically release upon completing your verification matrix click workflow.</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`Review enforcement notification dispatched to ${booking.user.email}`);
        } catch (mailErr) {
            console.error("Nodemailer block handled gracefully for checkout reminder:", mailErr.message);
        }

        req.flash("success", "✅ Room structural logs locked! Checkout media processed and review notification dispatched.");
        res.redirect(`/listings/${booking.listing._id}`); 

    } catch (error) {
        console.error("🚨 Critical failure in check-out verification parser:", error);
        req.flash("error", "Internal Server Error updating checkout state logs.");
        res.redirect("/bookings/my-bookings");
    }
};

// === 7. USER BOOKINGS DASHBOARD VIEW ENGINE WITH HISTORICAL BIFURCATION ===
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
        
        let totalSpent = 0;
        let totalNights = 0;
        let upcomingTripsCount = 0;

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

            const isFinePending = b.dispute && b.dispute.isDamaged && !b.dispute.isFinePaid;

            if ((b.bookingPhase === "CheckedOut" && !isFinePending) || checkOut < now || b.paymentStatus === "Refunded" || b.paymentStatus === "Cancelled" || b.paymentStatus === "Failed") {
                pastBookings.push(b);
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

// === 8. HOST CONTROL ANALYTICS OVERVIEW WITH HISTORICAL BIFURCATION ===
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
        
        let totalRevenue = 0;
        let activeReservations = 0;
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

            const isFinePending = b.dispute && b.dispute.isDamaged && !b.dispute.isFinePaid;

            if ((b.bookingPhase === "CheckedOut" && !isFinePending) || checkOut < now || b.paymentStatus === "Refunded" || b.paymentStatus === "Cancelled" || b.paymentStatus === "Failed") {
                pastArchiveHistory.push(b);
            } else {
                activeReservationsLogs.push(b);
            }
        });

        // 💥 FIXED REFERENCE TYPO MATCH
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

// =========================================================================
// 🔒 HOST AUTHORIZATION: APPROVE OR REMOVE GUEST MEDIA FROM PUBLIC VIEW
// =========================================================================
module.exports.approveGuestMedia = async (req, res) => {
    try {
        const { id } = req.params;
        const { approve } = req.body; 
        
        const booking = await Booking.findById(id).populate("listing");

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking log matrix not found" });
        }

        if (!booking.listing.owner.equals(req.user._id)) {
            return res.status(403).json({ success: false, message: "Unauthorized execution block." });
        }

        booking.isApprovedByOwner = (approve === "true" || approve === true);
        await booking.save();

        req.flash("success", booking.isApprovedByOwner ? "📸 Media successfully pinned to your public property gallery!" : "🔒 Media removed from your public property gallery.");
        res.redirect("/bookings/owner-dashboard");

    } catch (error) {
        console.error("🚨 Host media approval error:", error);
        req.flash("error", "Internal network breakdown while updating host assets privileges.");
        res.redirect("/bookings/owner-dashboard");
    }
};

// =========================================================================
// 🚨 HOST DAMAGE CLAIM & SINGLE BOOKER FINE ENGINE (PHASE 8 MULTI-METRIC)
// =========================================================================
module.exports.claimDamageFine = async (req, res) => {
    try {
        let { id } = req.params;
        let { fineAmount, fineReason } = req.body;
        const amountInPaise = Math.round(parseFloat(fineAmount) * 100);

        const booking = await Booking.findById(id).populate("listing").populate("user");

        if (!booking) {
            req.flash("error", "Booking log template not found!");
            return res.redirect("/bookings/owner-dashboard");
        }

        if (booking.bookingPhase !== "CheckedOut") {
            req.flash("error", "Access Denied: Fine engine can only be triggered after guest checkout.");
            return res.redirect("/bookings/owner-dashboard");
        }

        // --- Razorpay Order Generation for the Damage Fine ---
        const shortIdSlice = id.toString().slice(-6); 
        const shortTimeSlice = Date.now().toString().slice(-8);

        const rzpFineOptions = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `fn_${shortIdSlice}_${shortTimeSlice}` 
        };

        const fineOrder = await razorpay.orders.create(rzpFineOptions);

        booking.dispute = {
            isDamaged: true,
            fineAmount: parseFloat(fineAmount),
            fineReason: fineReason,
            isFinePaid: false,
            fineRazorpayOrderId: fineOrder.id
        };

        await booking.save();

        // === 📧 EMAIL DISPATCH TO THE PRIMARY USER ONLY ===
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const finePaymentUrl = `${process.env.APP_BASE_URL}/bookings/my-bookings`;

            const mailOptions = {
                from: `"Akshat's Airbnb Legal" <${process.env.EMAIL_USER}>`,
                to: booking.user.email,
                subject: `🚨 Urgent Notice: Property Damage Fine Account Hold - Ref #${booking._id}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #222222; max-width: 600px; border: 2px solid #d9534f; border-radius: 12px;">
                        <h2 style="color: #d9534f; font-size: 22px; margin-bottom: 4px;">Property Damage Assessment Claim ⚠️</h2>
                        <p style="font-size: 14px; margin-top: 0; color: #555555;">An official claim has been logged for your recent stay at <b>${booking.listing.title}</b>.</p>
                        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
                        <p style="font-size: 14px; margin-bottom: 10px;"><b>Reason for Fine:</b> ${booking.dispute.fineReason}</p>
                        <h3 style="color: #bd1e59; margin-bottom: 20px;">Total Fine Amount Due: ₹${booking.dispute.fineAmount.toLocaleString("en-IN")}</h3>
                        <div style="margin: 25px 0; text-align: center;">
                            <a href="${finePaymentUrl}" style="background-color: #d9534f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Pay Fine & Settle Account Center</a>
                        </div>
                        <p style="font-size: 11px; color: #717171;">Note: Account holds will automatically release across all associated nodes upon successful clearing confirmation.</p>
                    </div>
                `
            };
            await transporter.sendMail(mailOptions);
            console.log(`Dispute Invoice Order successfully tracked to primary user email: ${booking.user.email}`);
        } catch (mailErr) {
            console.error("Nodemailer Dispute Fine Pipeline Error handled safely:", mailErr.message);
        }

        req.flash("success", `🚨 Damage claim logged for ₹${fineAmount}! Invoice dispatched to the primary account wrapper.`);
        res.redirect("/bookings/owner-dashboard");

    } catch (error) {
        console.error("🚨 Fine Engine Claim Execution Failure:", error);
        req.flash("error", "Internal Server Error compiling dispute matrix reports.");
        res.redirect("/bookings/owner-dashboard");
    }
};

// =========================================================================
// 🚨 VERIFY FINE PAYMENT SIGNATURE MODULE ENTRYPOINT
// =========================================================================
module.exports.verifyFinePayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            const booking = await Booking.findById(bookingId);
            if (booking) {
                booking.dispute.isFinePaid = true;
                await booking.save();
                return res.status(200).json({ success: true });
            }
            return res.status(404).json({ success: false, message: "Booking matrix node missing." });
        } else {
            return res.status(400).json({ success: false, message: "Signature verification failed" });
        }
    } catch (err) {
        console.error("🚨 Fine Signature verification breakdown:", err);
        res.status(500).json({ success: false, message: "Internal server verification mapping error" });
    }
};

// =========================================================================
// 🔒 HOST CONTROL: CLOSE STAY AS CLEAN
// =========================================================================
module.exports.settleBookingClean = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            req.flash("error", "Booking transaction record not found!");
            return res.redirect("/bookings/owner-dashboard");
        }

        if (booking.bookingPhase !== "CheckedOut") {
            req.flash("error", "Access Denied: Cannot clear stay bounds before guest check-out validation.");
            return res.redirect("/bookings/owner-dashboard");
        }

        booking.dispute = {
            isDamaged: false,
            fineAmount: 0,
            fineReason: "Property inspected. Room status verified as pristine condition.",
            isFinePaid: true
        };
        
        await booking.save();

        req.flash("success", "✅ Stay status completed! Asset verified as 'All Clean' with no damage logs.");
        res.redirect("/bookings/owner-dashboard");
    } catch (error) {
        console.error("🚨 Settle Clean Log Engine Error:", error);
        req.flash("error", "Internal network error archiving safe stay records.");
        res.redirect("/bookings/owner-dashboard");
    }
};

// =========================================================================
// 🔒 HOST CONTROL: REVOKE / CANCEL ACTIVE UNPAID DISPUTE FINE
// =========================================================================
module.exports.cancelDamageFine = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            req.flash("error", "Booking ledger log instance missing!");
            return res.redirect("/bookings/owner-dashboard");
        }

        if (booking.dispute && booking.dispute.isFinePaid) {
            req.flash("error", "Operation Denied: Fine ledger has already been settled via electronic transaction node.");
            return res.redirect("/bookings/owner-dashboard");
        }

        booking.dispute = {
            isDamaged: false,
            fineAmount: 0,
            fineReason: "",
            isFinePaid: false,
            fineRazorpayOrderId: null
        };

        await booking.save();

        req.flash("success", "🔄 Active dispute fine revoked! Property room status returned to inspection tree.");
        res.redirect("/bookings/owner-dashboard");
    } catch (error) {
        console.error("🚨 Revoke Fine Engine Breakdown:", error);
        req.flash("error", "System error handled while resetting active fine variables.");
        res.redirect("/bookings/owner-dashboard");
    }
};