const cron = require("node-cron");
const Booking = require("../models/booking");
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY
});

// === SCHEDULED ENGINE: RUNS EVERY HOUR ===
cron.schedule("0 * * * *", async () => {
    console.log("⏰ System Log: Initiating 24-Hour Split Payment Expiration Assessment Matrix...");
    try {
        const now = new Date();
        const expirationThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); 

        // Finds bookings older than 24 hours that are unfulfilled or stuck in split groups
        const expiredBookings = await Booking.find({
            isSplitBooking: true,
            paymentStatus: { $in: ["Pending Split", "Partially Paid"] },
            createdAt: { $lte: expirationThreshold }
        });

        if (expiredBookings.length === 0) {
            console.log("✅ System Log: No expired partial split reservation arrays found.");
            return;
        }

        for (let booking of expiredBookings) {
            console.log(`⚠️ Processing expiration routine for Booking ID: ${booking._id}`);

            // 1. Process main booker automated refund sequence structure
            if (booking.razorpayPaymentId) {
                try {
                    await razorpay.payments.refund(booking.razorpayPaymentId, {
                        notes: { reason: "Group split payment window expired. Automated primary account rollback." }
                    });
                    console.log(`💸 Main Booker Refund processed successfully.`);
                } catch (refundErr) {
                    console.error(`❌ Main booker refund failed or already reversed: ${refundErr.message}`);
                }
            }

            // 2. ⚡ FIXED MULTI-REFUND PIPELINE: Loops and refunds EVERY split traveler who paid!
            for (let friend of booking.splitParticipants) {
                if (friend.hasPaid && friend.razorpayPaymentId) {
                    try {
                        console.log(`📡 Dispatching secure split refund pipeline node to traveler: ${friend.email}`);
                        await razorpay.payments.refund(friend.razorpayPaymentId, {
                            notes: { reason: `Group split window timeout. Refunded segment fractional fraction to ${friend.email}` }
                        });
                        console.log(`💸 Split share refund successfully processed back to ${friend.email}`);
                    } catch (friendRefundErr) {
                        console.error(`❌ Fractional split refund failed for ${friend.email}: ${friendRefundErr.message}`);
                    }
                }
            }

            // 3. Update Status to Failed to archive it away cleanly
            booking.paymentStatus = "Failed"; 
            await booking.save();
            console.log(`🔒 Booking ${booking._id} status modified safely to Failed.`);
        }

    } catch (error) {
        console.error("🚨 Critical Error inside automated reservation cron loop:", error);
    }
});