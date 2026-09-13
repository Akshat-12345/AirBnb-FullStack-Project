// controllers/bookingVerification.js
const Booking = require("../models/booking");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const axios = require("axios");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY
});

// Helper: Secure Nodemailer Transporter with explicit SSL
const createTransporter = () => {
    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // SSL
        auth: {
            user: (process.env.EMAIL_USER || "").trim(),
            pass: (process.env.EMAIL_PASS || "").trim()
        }
    });
};

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

// === 2. SUBMIT CHECK-OUT MULTI-MEDIA VERIFICATION (WITH ATITHI-NET FORENSIC AUDIT BILLING) ===
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

        // =========================================================================
        // 🤖 ATITHI-NET: BI-TEMPORAL VISUAL DAMAGE DETECTION PIPELINE
        // =========================================================================
        const checkInPhotoUrl = booking.checkInMedia?.photos?.[0]?.url;
        const checkOutPhotoUrl = booking.checkOutMedia?.photos?.[0]?.url;

        let aiAuditSuccess = false;

        if (checkInPhotoUrl && checkOutPhotoUrl) {
            try {
                booking.aiAudit.auditStatus = "Processing";
                await booking.save();

                // Call FastAPI Microservice
                const aiResponse = await axios.post("http://127.0.0.1:8000/api/v1/inspect", {
                    bookingId: booking._id.toString(),
                    checkInUrl: checkInPhotoUrl,
                    checkOutUrl: checkOutPhotoUrl
                }, { timeout: 35000 });

                const auditData = aiResponse.data;

                // 🛡️ ADAPTER: Strict Schema Enum Mapping for Mongoose
                const mapToSchemaCategory = (text) => {
                    const str = (text || "").toLowerCase();
                    if (str.includes("linen") || str.includes("bed") || str.includes("towel") || str.includes("fabric")) return "Linen/Fabric";
                    if (str.includes("switch") || str.includes("remote") || str.includes("kettle") || str.includes("electronic") || str.includes("tv") || str.includes("ac")) return "Electronic/Appliance";
                    if (str.includes("wall") || str.includes("paint") || str.includes("plaster")) return "Wall/Paint";
                    if (str.includes("glass") || str.includes("mirror") || str.includes("furniture")) return "Furniture/Glass";
                    if (str.includes("sanitary") || str.includes("toilet") || str.includes("marble")) return "Sanitary";
                    return "General";
                };

                const mapToSchemaSeverity = (sev) => {
                    const str = (sev || "").toLowerCase();
                    if (str.includes("critical") || str.includes("safety") || str.includes("depletion")) return "Critical";
                    if (str.includes("moderate") || str.includes("actionable")) return "Moderate";
                    return "Low";
                };

                const dbDamages = (auditData.damages || []).map(d => ({
                    category: mapToSchemaCategory(d.item || d.category),
                    severity: mapToSchemaSeverity(d.severity),
                    confidenceScore: d.confidenceScore || 0.95,
                    affectedAreaRatio: d.affectedAreaRatio || 0.02,
                    checkInEvidenceUrl: d.checkInEvidenceUrl || checkInPhotoUrl,
                    checkOutEvidenceUrl: d.checkOutEvidenceUrl || checkOutPhotoUrl,
                    calculatedFine: d.fine !== undefined ? d.fine : (d.calculatedFine || 0)
                }));

                booking.aiAudit = {
                    isAudited: true,
                    auditTimestamp: new Date(),
                    integrityScore: auditData.integrityScore !== undefined ? auditData.integrityScore : 100,
                    damagesDetected: dbDamages,
                    totalCalculatedFine: auditData.totalFine || 0,
                    inferenceExecutionTimeMs: Math.round((auditData.executionTimeSec || 0) * 1000),
                    auditStatus: "Completed"
                };

                // Agar AI ne damage detect kiya, automatically Razorpay fine order create karo
                if (auditData.isDamaged && auditData.totalFine > 0) {
                    const shortIdSlice = id.toString().slice(-6);
                    const shortTimeSlice = Date.now().toString().slice(-8);

                    const finePaise = Math.round(auditData.totalFine * 100);
                    const fineOrder = await razorpay.orders.create({
                        amount: finePaise,
                        currency: "INR",
                        receipt: `ai_fn_${shortIdSlice}_${shortTimeSlice}`
                    });

                    // Itemized human-readable ledger string
                    const itemizedBreakdown = (auditData.damages || [])
                        .filter(d => (d.fine || d.calculatedFine || 0) > 0)
                        .map(d => `${d.item || d.category} (${d.anomalyType || d.severity}: ₹${d.fine || d.calculatedFine})`)
                        .join(" | ");

                    booking.dispute = {
                        isDamaged: true,
                        fineAmount: auditData.totalFine,
                        fineReason: itemizedBreakdown || `Forensic damage flagged: ₹${auditData.totalFine}`,
                        isFinePaid: false,
                        fineRazorpayOrderId: fineOrder.id,
                        ownerOverride: false
                    };

                    // =========================================================================
                    // 📧 INVOICE EMAIL: ASYNC AWAITED DELIVERY
                    // =========================================================================
                    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                        try {
                            const transporter = createTransporter();
                            const finePaymentUrl = `${process.env.APP_BASE_URL}/bookings/my-bookings`;

                            let tableRowsHtml = "";
                            (auditData.damages || []).forEach((dmg, index) => {
                                const cost = dmg.fine || dmg.calculatedFine || 0;
                                if (cost > 0) {
                                    tableRowsHtml += `
                                        <tr style="border-bottom: 1px solid #eeeeee;">
                                            <td style="padding: 10px; font-size: 13px; color: #333333;">${index + 1}</td>
                                            <td style="padding: 10px; font-size: 13px; color: #222222;">
                                                <b>${dmg.item || dmg.category}</b><br>
                                                <span style="font-size: 11px; color: #777777;">${dmg.spec || "Restoration / Replacement required"}</span>
                                            </td>
                                            <td style="padding: 10px; font-size: 13px; color: #d9534f; font-weight: 600;">${dmg.anomalyType || dmg.severity}</td>
                                            <td style="padding: 10px; font-size: 13px; text-align: right; font-weight: 600; color: #222222;">₹${cost.toLocaleString("en-IN")}</td>
                                        </tr>
                                    `;
                                }
                            });

                            const mailOptions = {
                                from: `"Smart Atithi Forensic Audit" <${process.env.EMAIL_USER}>`,
                                to: booking.user.email,
                                subject: `⚠️ Itemized Damage Invoice & Penalty Notice - Booking #${booking._id}`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; padding: 25px; color: #222222; max-width: 650px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
                                        <div style="border-bottom: 2px solid #ff385c; padding-bottom: 15px; margin-bottom: 20px;">
                                            <h2 style="color: #d9534f; margin: 0; font-size: 22px;">Property Damage Assessment Invoice</h2>
                                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #666666;">Automated Bi-Temporal Visual Inspection Ledger</p>
                                        </div>

                                        <p style="font-size: 14px; margin-bottom: 15px;">Dear <b>${booking.user.username}</b>,</p>
                                        <p style="font-size: 14px; line-height: 1.5; color: #444444;">
                                            During your check-out inspection at <b>${booking.listing.title}</b>, the ATITHI-Net Deep Vision Engine detected discrepancies compared to your check-in baseline. Non-damage everyday wear & tear has been exempted.
                                        </p>

                                        <table style="width: 100%; font-size: 13px; background-color: #f9f9f9; padding: 12px; border-radius: 6px; margin: 15px 0;">
                                            <tr>
                                                <td style="padding: 4px;"><b>Booking Ref:</b> #${booking._id}</td>
                                                <td style="padding: 4px;"><b>Property:</b> ${booking.listing.title}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px;"><b>Room Integrity Score:</b> ${booking.aiAudit.integrityScore}/100</td>
                                                <td style="padding: 4px;"><b>Audit Status:</b> Flagged with Discrepancy</td>
                                            </tr>
                                        </table>

                                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                                            <thead>
                                                <tr style="background-color: #f2f2f2; border-bottom: 2px solid #dddddd;">
                                                    <th style="padding: 10px; font-size: 12px; text-align: left; color: #555555;">#</th>
                                                    <th style="padding: 10px; font-size: 12px; text-align: left; color: #555555;">Item & Specification</th>
                                                    <th style="padding: 10px; font-size: 12px; text-align: left; color: #555555;">Anomaly</th>
                                                    <th style="padding: 10px; font-size: 12px; text-align: right; color: #555555;">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${tableRowsHtml}
                                            </tbody>
                                            <tfoot>
                                                <tr style="background-color: #fafafa; border-top: 2px solid #333333;">
                                                    <td colspan="3" style="padding: 12px 10px; font-size: 14px; font-weight: bold; text-align: right;">Total Assessed Liability:</td>
                                                    <td style="padding: 12px 10px; font-size: 16px; font-weight: bold; text-align: right; color: #d9534f;">₹${booking.dispute.fineAmount.toLocaleString("en-IN")}</td>
                                                </tr>
                                            </tfoot>
                                        </table>

                                        <div style="margin: 30px 0; text-align: center;">
                                            <a href="${finePaymentUrl}" style="background-color: #ff385c; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">View Evidence & Settle Balance</a>
                                        </div>
                                    </div>
                                `
                            };

                            const mailResult = await transporter.sendMail(mailOptions);
                            console.log(`✅ Itemized fine invoice email sent to ${booking.user.email} (MsgId: ${mailResult.messageId})`);
                        } catch (mailErr) {
                            console.error("❌ Nodemailer fine delivery failed:", mailErr.message);
                        }
                    }
                } else {
                    booking.dispute = {
                        isDamaged: false,
                        fineAmount: 0,
                        fineReason: "AI Visual Audit verified pristine room condition (Wear & Tear Exempted).",
                        isFinePaid: true,
                        ownerOverride: false
                    };
                }

                aiAuditSuccess = true;

            } catch (aiErr) {
                console.error("⚠️ AI Microservice Call Failed:", aiErr.message);
                booking.aiAudit.auditStatus = "Failed";
            }
        }

        await booking.save();

        // Review Reminder Email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = createTransporter();
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
            } catch (mailErr) {
                console.error("Nodemailer checkout reminder error:", mailErr.message);
            }
        }

        if (aiAuditSuccess && booking.dispute.isDamaged) {
            req.flash("error", `⚠️ AI Audit complete: Damage detected. Fine of ₹${booking.dispute.fineAmount} imposed.`);
        } else if (aiAuditSuccess) {
            req.flash("success", "✅ AI Room Audit passed with 100% clean condition! Enjoy your day.");
        } else {
            req.flash("success", "✅ Checkout media logged. AI inspection deferred for manual review.");
        }

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
            fineRazorpayOrderId: fineOrder.id,
            ownerOverride: true
        };
        await booking.save();

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = createTransporter();
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
            } catch (mailErr) {
                console.error("Nodemailer Dispute Fine Pipeline Error handled safely:", mailErr.message);
            }
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
                booking.dispute.fineRazorpayPaymentId = razorpay_payment_id;
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
            isFinePaid: true,
            ownerOverride: true
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
            fineRazorpayOrderId: null,
            ownerOverride: true
        };

        await booking.save();
        req.flash("success", "🔄 Active dispute fine revoked! Property room status returned to inspection tree.");
        res.redirect("/bookings/owner-dashboard");
    } catch (error) {
        console.error("🚨 Revoke Fine Engine Breakdown:", error);
        res.redirect("/bookings/owner-dashboard");
    }
};