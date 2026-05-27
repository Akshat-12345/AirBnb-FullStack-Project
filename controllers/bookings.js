const path = require("path");
if (process.env.NODE_ENV !== "production") {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

const Booking = require("../models/booking");
const Listing = require("../models/listing");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY
});

module.exports.initiateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { checkInDate, checkOutDate, isSplitBooking, participantsEmails } = req.body;
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

        const options = {
            amount: totalPrice * 100, 
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`
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
            isSplitBooking: isSplitBooking || false
        });

        if (isSplitBooking && participantsEmails) {
            const share = totalPrice / (participantsEmails.length + 1);
            newBooking.splitParticipants = participantsEmails.map(email => ({
                email,
                shareAmount: share,
                hasPaid: false
            }));
        }

        await newBooking.save();

        res.status(200).json({
            success: true,
            rzpOrder,
            bookingId: newBooking._id,
            key_id: process.env.RAZORPAY_KEY_ID,
            user: { name: req.user.username, email: req.user.email }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            const booking = await Booking.findById(bookingId);
            
            if (!booking.isSplitBooking) {
                booking.paymentStatus = "Paid";
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

// === 3. ADVANCED USER BOOKINGS ENGINE ===
module.exports.myBookings = async (req, res) => {
    try {
        if (!req.user) {
            req.flash("error", "You must be logged in to view your dashboard!");
            return res.redirect("/login");
        }

        const bookings = await Booking.find({ user: req.user._id, paymentStatus: "Paid" })
            .populate("listing")
            .sort({ createdAt: -1 });

        let totalSpent = 0;
        let totalNights = 0;
        let upcomingTripsCount = 0;
        const now = new Date();

        bookings.forEach(b => {
            totalSpent += b.totalPrice;
            const d1 = new Date(b.checkInDate);
            const d2 = new Date(b.checkOutDate);
            const diffDays = Math.ceil((d2 - d1) / (1000 * 3600 * 24));
            totalNights += diffDays > 0 ? diffDays : 1;
            
            if (d1 > now) {
                upcomingTripsCount++;
            }
        });

        res.render("bookings/myBookings.ejs", { 
            bookings, 
            metrics: { totalSpent, totalTrips: bookings.length, totalNights, upcomingTripsCount } 
        });
    } catch (err) {
        console.error(err);
        req.flash("error", "Something went wrong while loading customer dashboard!");
        res.redirect("/listings");
    }
};

// === 4. ADVANCED OWNER ANALYTICS DASHBOARD ===
module.exports.ownerDashboard = async (req, res) => {
    try {
        if (!req.user) {
            req.flash("error", "You must be logged in to access the control panel!");
            return res.redirect("/login");
        }

        const myListings = await Listing.find({ owner: req.user._id });
        const listingIds = myListings.map(l => l._id);

        const incomingBookings = await Booking.find({ listing: { $in: listingIds }, paymentStatus: "Paid" })
            .populate("listing")
            .populate("user", "username email")
            .sort({ createdAt: -1 });

        let totalRevenue = 0;
        let activeReservations = 0;
        const now = new Date();

        incomingBookings.forEach(b => {
            totalRevenue += b.totalPrice;
            const checkIn = new Date(b.checkInDate);
            const checkOut = new Date(b.checkOutDate);
            if (now >= checkIn && now <= checkOut) {
                activeReservations++;
            }
        });

        res.render("bookings/ownerDashboard.ejs", { 
            myListings, 
            incomingBookings,
            metrics: { totalRevenue, totalBookings: incomingBookings.length, activeReservations }
        });
    } catch (err) {
        console.error(err);
        req.flash("error", "Failed to compile host analytics reporting stack!");
        res.redirect("/listings");
    }
};