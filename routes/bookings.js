// routes/bookings.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const { isLoggedIn } = require("../middleware"); 

// === TWIN INTEGRATED BIFURCATED CONTROLLER RE-ROUTES ===
const bookingController = require("../controllers/bookings");
const verificationController = require("../controllers/bookingVerification");

// === MULTER & CLOUDINARY CONFIG INTERFACE ===
const multer = require("multer");
const { storage } = require("../cloudConfig"); 
const upload = multer({ storage });

// Route: Initiate Booking (Main Booker)
router.post("/listings/:id/book", isLoggedIn, bookingController.initiateBooking);

// Route: Verify Payment (Main Booker)
router.post("/bookings/verify-payment", isLoggedIn, bookingController.verifyPayment);

// === INDIVIDUAL CO-TRAVELER SHARE SETTLEMENTS ===
router.post("/bookings/initiate-share-payment", isLoggedIn, bookingController.initiateSharePayment);
router.post("/bookings/verify-share-payment", isLoggedIn, bookingController.verifySharePayment);

// =========================================================================
// 📸 CHECK-IN VERIFICATION ENGINE PIPELINE
// =========================================================================
router.post(
    "/bookings/:id/checkin-verify", 
    isLoggedIn, 
    upload.fields([
        { name: "checkInPhotos", maxCount: 2 },
        { name: "checkInVideo", maxCount: 1 }
    ]), 
    verificationController.submitCheckInVerification // Routed securely to verificationController
);

// =========================================================================
// 📸 CHECK-OUT VERIFICATION ENGINE PIPELINE (PHASE 6)
// =========================================================================
router.post(
    "/bookings/:id/checkout-verify", 
    isLoggedIn, 
    upload.fields([
        { name: "checkOutPhotos", maxCount: 2 },
        { name: "checkOutVideo", maxCount: 1 }
    ]), 
    verificationController.submitCheckOutVerification // Routed securely to verificationController
);

// === ADVANCED DASHBOARD STREAMS ===
router.patch("/bookings/:id/approve-media", isLoggedIn, verificationController.approveGuestMedia);
router.get("/bookings/my-bookings", isLoggedIn, bookingController.myBookings);
router.get("/bookings/owner-dashboard", isLoggedIn, bookingController.ownerDashboard);

// =========================================================================
// 🚨 HOST DAMAGE CLAIM & SINGLE BOOKER FINE ENGINE (PHASE 8)
// =========================================================================
router.post(
    "/bookings/:id/claim-fine", 
    isLoggedIn, 
    verificationController.claimDamageFine
);

router.post(
    "/bookings/verify-fine-payment", 
    isLoggedIn, 
    verificationController.verifyFinePayment
);

// =========================================================================
// 🔒 HOST CONTROL ENDPOINTS: SETTLE CLEAN VS CANCEL DISPUTE
// =========================================================================
router.post(
    "/bookings/:id/settle-clean", 
    isLoggedIn, 
    verificationController.settleBookingClean
);

router.post(
    "/bookings/:id/cancel-fine", 
    isLoggedIn, 
    verificationController.cancelDamageFine
);

module.exports = router;