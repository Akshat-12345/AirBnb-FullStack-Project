const express = require('express');
const router = express.Router({ mergeParams: true });
const ExpressError = require('../utils/ExpressError.js');
const wrapAsync = require('../utils/wrapAsync.js');
const User = require('../models/user.js');
const passport = require('passport');
const { saveRedirectUrl } = require('../middleware.js');
const userController = require('../controllers/users.js');
const { isLoggedIn } = require("../middleware.js"); // Tera login check middleware

// --- Local Auth Routes ---
router.get('/signup', userController.signUp);

router.post('/signup', wrapAsync(userController.createAccount));

router.get('/login', userController.renderLoginForm);

router.post(
  '/login',
  saveRedirectUrl,
  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
  userController.Loginuser
);

router.get('/logout', userController.logout);

// --- Google OAuth Routes ---
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
  userController.googleLoginCallback
);

// Render Settings
router.get("/settings", isLoggedIn, userController.renderSettings);

// AJAX Send Email OTP Route
router.post("/settings/send-email-otp", isLoggedIn, userController.sendEmailOtp);

// Unified Form Post Route
router.post("/settings/update", isLoggedIn, userController.updateAccountSettings);

module.exports = router;
