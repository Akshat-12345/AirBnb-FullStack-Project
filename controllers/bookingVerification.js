// controllers/bookingVerification.js
const Booking = require("../models/booking");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY
});

// === 1. SUBMIT CHECK-IN MULTI-MEDIA VERIFICATION ===
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

        booking.checkInMedia = {
            photos: req.files["checkInPhotos"].map(file => ({ url: file.path, filename: file.filename })),
            video: { url: req.files["checkInVideo"][0].path, filename: req.files["checkInVideo"][0].filename },
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

// === 2. SUBMIT CHECK-OUT MULTI-MEDIA VERIFICATION ===
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

        booking.checkOutMedia = {
            photos: req.files["checkOutPhotos"].map(file => ({ url: file.path, filename: file.filename })),
            video: { url: req.files["checkOutVideo"][0].path, filename: req.files["checkOutVideo"][0].filename },
            uploadedAt: new Date()
        };

        booking.bookingPhase = "CheckedOut";
        await booking.save();

        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const reviewRedirectUrl = `${process.env.APP_BASE_URL}/listings/${booking.listing._id}`;

            await transporter.sendMail({
                from: `"Akshat's Airbnb" <${process.env.EMAIL_USER}>`,
                to: booking.user.email,
                subject: `🔒 Action Required: Complete your stay review for ${booking.listing.title}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #222222; max-width: 600px; border: 1px solid #ff385c; border-radius: 12px;">
                        <h2 style="color: #ff385c; font-size: 22px; margin-bottom: 4px;">Thank You for Staying! 🙏</h2>
                        <p style="font-size: 15px; margin-top: 0; color: #555555;">Your checkout structural verification assets have been recorded safely.</p>
                        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
                        <p style="font-size: 14px; line-height: 1.5; color: #666;">As per the platform's security layout guidelines, you are required to submit an honest feedback review to completely clear your booking ledger bounds.</p>
                        <div style="margin: 25px 0; text-align: center;">
                            <a href="${reviewRedirectUrl}" style="background-color: #ff385c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Submit Property Review</a>
                        </div>
                    </div>
                `
            });
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

// === 3. HOST AUTHORIZATION: APPROVE OR REMOVE GUEST MEDIA FROM PUBLIC VIEW ===
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
        res.redirect("/bookings/owner-dashboard");
    }
};

// === 4. HOST DAMAGE CLAIM & SINGLE BOOKER FINE ENGINE ===
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

        const shortIdSlice = id.toString().slice(-6); 
        const shortTimeSlice = Date.now().toString().slice(-8);

        const fineOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `fn_${shortIdSlice}_${shortTimeSlice}` 
        });

        booking.dispute = {
            isDamaged: true,
            fineAmount: parseFloat(fineAmount),
            fineReason: fineReason,
            isFinePaid: false,
            fineRazorpayOrderId: fineOrder.id
        };
        await booking.save();

        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const finePaymentUrl = `${process.env.APP_BASE_URL}/bookings/my-bookings`;

            await transporter.sendMail({
                from: `"Akshat's Airbnb Legal" <${process.env.EMAIL_USER}>`,
                to: booking.user.email,
                subject: `🚨 Urgent Notice: Property Damage Fine Account Hold - Ref #${booking._id}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #222222; max-width: 600px; border: 2px solid #d9534f; border-radius: 12px;">
                        <h2 style="color: #d9534f; font-size: 22px; margin-bottom: 4px;">Property Damage Assessment Claim ⚠️</h2>
                        <p>An official claim has been logged for your recent stay at <b>${booking.listing.title}</b>.</p>
                        <hr style="border: none; border-top: 1px solid #eaeaea;">
                        <p><b>Reason for Fine:</b> ${booking.dispute.fineReason}</p>
                        <h3 style="color: #bd1e59;">Total Fine Amount Due: ₹${booking.dispute.fineAmount.toLocaleString("en-IN")}</h3>
                        <div style="margin: 25px 0; text-align: center;">
                            <a href="${finePaymentUrl}" style="background-color: #d9534f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Pay Fine & Settle Account Center</a>
                        </div>
                    </div>
                `
            });
            console.log(`Dispute Invoice Order successfully tracked to primary user email: ${booking.user.email}`);
        } catch (mailErr) {
            console.error("Nodemailer Dispute Fine Pipeline Error handled safely:", mailErr.message);
        }

        req.flash("success", `🚨 Damage claim logged for ₹${fineAmount}! Invoice dispatched to the primary account wrapper.`);
        res.redirect("/bookings/owner-dashboard");
    } catch (error) {
        console.error("🚨 Fine Engine Claim Execution Failure:", error);
        res.redirect("/bookings/owner-dashboard");
    }
};

// === 5. VERIFY FINE PAYMENT SIGNATURE ===
module.exports.verifyFinePayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
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

// === 6. HOST CONTROL: CLOSE STAY AS CLEAN (TRIGGERS INSTANT HISTORICAL EXPULSION) ===
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
            isFinePaid: true // 💥 RELEASE PARAMETER MATCHED CLEAN FOR DYNAMIC EXPORT TO ARCHIVE
        };
        
        await booking.save();
        req.flash("success", "✅ Stay status completed! Asset verified as 'All Clean' with no damage logs.");
        res.redirect("/bookings/owner-dashboard");
    } catch (error) {
        console.error("🚨 Settle Clean Log Engine Error:", error);
        res.redirect("/bookings/owner-dashboard");
    }
};

// === 7. HOST CONTROL: REVOKE / CANCEL ACTIVE UNPAID DISPUTE FINE ===
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
        res.redirect("/bookings/owner-dashboard");
    }
};