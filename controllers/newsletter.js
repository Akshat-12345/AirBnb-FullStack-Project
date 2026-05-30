// controllers/newsletter.js
const nodemailer = require("nodemailer");

// High-Definition Destination Sceneries CDN Dataset for Premium HTML Layouts
const visualSceneries = [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80", // Luxury Infinity Pool Cliff Villa
    "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80", // A-Frame Alpine Forest Cabin
    "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80"  // Premium Oceanfront Island Sanctuary
];

module.exports.subscribe = async (req, res) => {
    try {
        const { subscriberEmail } = req.body;
        
        if (!subscriberEmail) {
            return res.status(400).json({ success: false, message: "Email parameter missing!" });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"Atithi Premium Club" <${process.env.EMAIL_USER}>`,
            to: subscriberEmail,
            subject: `✨ Welcome to Atithi! Explore Premium Visual Horizons`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; padding: 50px 15px; margin: 0; color: #1e293b;">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 40px rgba(0,0,0,0.06); overflow: hidden; border-collapse: collapse;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #FF9432 0%, #67B636 50%, #00A3E0 100%); padding: 45px 35px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.05);">Welcome to Atithi Club! 🌟</h1>
                                <p style="color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">You have successfully subscribed to our global luxury catalogs.</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 35px;">
                                <p style="font-size: 16px; line-height: 1.6; margin-top: 0; color: #0f172a;">Hi Traveler,</p>
                                <p style="font-size: 15px; line-height: 1.6; color: #475569;">Thank you for joining our ecosystem. Get ready to receive regular operational updates, split-booking optimization modules, and handpicked premium stay parameters curated by our system experts.</p>
                                
                                <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin: 35px 0 15px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Curated Visual Sceneries</h3>
                                <p style="font-size: 14px; color: #64748b; margin-bottom: 20px; line-height: 1.5;">Explore these beautiful visual horizons curated directly from our dynamic global catalogs:</p>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
                                    <tr>
                                        <td style="padding-right: 8px; padding-bottom: 10px; width: 50%;">
                                            <img src="${visualSceneries[0]}" width="100%" style="border-radius: 16px; height: 160px; object-fit: cover; display: block;" />
                                        </td>
                                        <td style="padding-left: 8px; padding-bottom: 10px; width: 50%;">
                                            <img src="${visualSceneries[1]}" width="100%" style="border-radius: 16px; height: 160px; object-fit: cover; display: block;" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="2" style="padding-top: 5px;">
                                            <img src="${visualSceneries[2]}" width="100%" style="border-radius: 18px; height: 200px; object-fit: cover; display: block;" />
                                        </td>
                                    </tr>
                                </table>

                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 40px 0 30px 0;">
                                <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; margin: 0;">© 2026 Atithi Engine Technologies Inc. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: "Subscription mail successfully dispatched!" });

    } catch (error) {
        console.error("Nodemailer controller pipeline error:", error);
        return res.status(500).json({ success: false, message: "Email delivery endpoint failed." });
    }
};