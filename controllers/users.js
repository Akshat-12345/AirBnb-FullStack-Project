const User = require('../models/user.js');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");

// Helper function to issue JWT Token
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Cookie setter helper
const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

module.exports.signUp = (req, res) => {
  res.render('users/signup.ejs');
};

module.exports.createAccount = async (req, res, next) => { // Fixed: added next parameter
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    let registeredUser = await User.register(newUser, password);
    
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      // Issue token on local signup
      const token = createToken(registeredUser);
      setAuthCookie(res, token);

      req.flash('success', 'Welcome to Airbnb, Your Account Has Been Successfully Created');
      res.redirect('/listings');
    });
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/signup');
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render('users/login.ejs');
};

module.exports.Loginuser = async (req, res) => {
  // Issue token on local login
  const token = createToken(req.user);
  setAuthCookie(res, token);

  req.flash('success', 'You are Logged-In Successfully');
  let redirectUrl = res.locals.redirectUrl || '/listings';
  res.redirect(redirectUrl);
};

// Google OAuth Callback Controller
module.exports.googleLoginCallback = (req, res) => {
  // Issue token for Google user
  const token = createToken(req.user);
  setAuthCookie(res, token);

  req.flash('success', `Welcome back, ${req.user.username || 'User'}!`);
  let redirectUrl = res.locals.redirectUrl || '/listings';
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    }
    // Fixed: Clear JWT cookie on logout
    res.clearCookie('token');
    req.flash('success', 'You are Logged-Out Successfully!');
    res.redirect('/listings');
  });
};




// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1. Settings Render Page
module.exports.renderSettings = async (req, res) => {
    const user = await User.findById(req.user._id);
    res.render("users/settings.ejs", { user });
};

// 2. Send OTP Endpoint (AJAX Call)
module.exports.sendEmailOtp = async (req, res) => {
    try {
        const { newEmail } = req.body;
        if (!newEmail || newEmail === req.user.email) {
            return res.status(400).json({ success: false, message: "Please enter a new and valid email." });
        }

        const existing = await User.findOne({ email: newEmail, _id: { $ne: req.user._id } });
        if (existing) {
            return res.status(400).json({ success: false, message: "Email already registered with another account." });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.emailOtpData = {
            targetEmail: newEmail,
            otp: otp,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        };

        await transporter.sendMail({
            from: `"Atithi Security" <${process.env.EMAIL_USER}>`,
            to: newEmail,
            subject: "Verify Your New Email - Atithi",
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
                    <h2>Email Verification Request</h2>
                    <p>You requested to update your email address on <strong>Atithi</strong>.</p>
                    <p>Your one-time verification code is:</p>
                    <h1 style="background: #f1f5f9; padding: 10px 18px; border-radius: 8px; display: inline-block; letter-spacing: 4px; color: #FF9432;">${otp}</h1>
                    <p style="color: #64748b; font-size: 13px;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
                </div>
            `
        });

        return res.status(200).json({ success: true, message: "OTP sent successfully to " + newEmail });
    } catch (err) {
        console.error("Nodemailer error:", err);
        return res.status(500).json({ success: false, message: "Could not send verification email." });
    }
};

// 3. Unified Form Update Handler
module.exports.updateAccountSettings = async (req, res) => {
    try {
        const { username, email, otp, currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.user._id);

        // A. Handle Username update
        if (username && username !== user.username) {
            const usernameTaken = await User.findOne({ username, _id: { $ne: user._id } });
            if (usernameTaken) {
                req.flash("error", "Username is already taken by someone else.");
                return res.redirect("/settings");
            }
            user.username = username;
        }

        // B. Handle Email verification & update
        if (email && email !== user.email) {
            const otpSession = req.session.emailOtpData;
            if (!otpSession || otpSession.targetEmail !== email) {
                req.flash("error", "Please request an OTP for your new email first.");
                return res.redirect("/settings");
            }
            if (Date.now() > otpSession.expiresAt) {
                req.flash("error", "OTP has expired. Please request a new one.");
                return res.redirect("/settings");
            }
            if (otpSession.otp !== otp.trim()) {
                req.flash("error", "Invalid verification code entered.");
                return res.redirect("/settings");
            }
            user.email = email;
            delete req.session.emailOtpData; // Invalidate OTP after use
        }

        // C. Handle Password update (Optional field in same form)
        if (newPassword || currentPassword) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                req.flash("error", "All password fields are required to change password.");
                return res.redirect("/settings");
            }
            if (newPassword !== confirmPassword) {
                req.flash("error", "New passwords do not match.");
                return res.redirect("/settings");
            }
            if (newPassword.length < 6) {
                req.flash("error", "Password must be at least 6 characters long.");
                return res.redirect("/settings");
            }

            // passport-local-mongoose password change
            await user.changePassword(currentPassword, newPassword);
        }

        await user.save();
        req.flash("success", "Account details updated successfully!");
        res.redirect("/settings");
    } catch (err) {
        console.error("Settings update error:", err);
        req.flash("error", err.message || "Failed to update account settings.");
        res.redirect("/settings");
    }
};