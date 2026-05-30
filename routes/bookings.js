const express = require("express");
const router = express.Router({ mergeParams: true });
const bookingController = require("../controllers/bookings");
const { isLoggedIn } = require("../middleware"); 

// === MULTER & CLOUDINARY CONFIG INTERFACE ===
const multer = require("multer");
const { storage } = require("../cloudConfig"); // Kal jo humne upgrade kiya tha multi-format framework wala storage
const upload = multer({ storage });

// Route: Initiate Booking (Main Booker)
router.post("/listings/:id/book", isLoggedIn, bookingController.initiateBooking);

// Route: Verify Payment (Main Booker)
router.post("/bookings/verify-payment", isLoggedIn, bookingController.verifyPayment);

// === NEW FEATURE: INDIVIDUAL CO-TRAVELER SHARE SETTLEMENTS ===
router.post("/bookings/initiate-share-payment", isLoggedIn, bookingController.initiateSharePayment);
router.post("/bookings/verify-share-payment", isLoggedIn, bookingController.verifySharePayment);


// =========================================================================
// 📸 CORE MATRIX UPDATE: CHECK-IN VERIFICATION ENGINE ROUTE
// =========================================================================
// strictly parse: Max 2 images from "checkInPhotos" and Max 1 video from "checkInVideo"
router.post(
    "/bookings/:id/checkin-verify", 
    isLoggedIn, 
    upload.fields([
        { name: "checkInPhotos", maxCount: 2 },
        { name: "checkInVideo", maxCount: 1 }
    ]), 
    bookingController.submitCheckInVerification
);


// =========================================================================
// 📸 NEW CORE FEATURE: CHECK-OUT VERIFICATION ENGINE ROUTE (PHASE 6)
// =========================================================================
// strictly parse: Max 2 images from "checkOutPhotos" and Max 1 video from "checkOutVideo"
router.post(
    "/bookings/:id/checkout-verify", 
    isLoggedIn, 
    upload.fields([
        { name: "checkOutPhotos", maxCount: 2 },
        { name: "checkOutVideo", maxCount: 1 }
    ]), 
    bookingController.submitCheckOutVerification
);


// === ADVANCED DASHBOARD ROUTES ===
// Route: Host Approves Guest Media to be displayed publicly on Listing Page
router.patch("/bookings/:id/approve-media", isLoggedIn, bookingController.approveGuestMedia);
router.get("/bookings/my-bookings", isLoggedIn, bookingController.myBookings);
router.get("/bookings/owner-dashboard", isLoggedIn, bookingController.ownerDashboard);


// =========================================================================
// 🚨 NEW CORE FEATURE: HOST DAMAGE CLAIM & SINGLE BOOKER FINE ENGINE ROUTE (PHASE 8)
// =========================================================================
// This accepts host damage calculations and updates the dispute schema branch
router.post(
    "/bookings/:id/claim-fine", 
    isLoggedIn, 
    bookingController.claimDamageFine
);

// Route: Verify Fine Payment Signature Matrix 
router.post(
    "/bookings/verify-fine-payment", 
    isLoggedIn, 
    bookingController.verifyFinePayment
);

// Inside routes/booking.js (Insert right before module.exports = router;)

// =========================================================================
// 🔒 HOST CONTROL ENDPOINT: CLOSE STAY AS 'ALL CLEAN' (NO FINE REQUIRED)
// =========================================================================
router.post(
    "/bookings/:id/settle-clean", 
    isLoggedIn, 
    bookingController.settleBookingClean
);

// =========================================================================
// 🔒 HOST CONTROL ENDPOINT: CANCEL / REVOKE ACTIVE UNPAID DISPUTE FINE
// =========================================================================
router.post(
    "/bookings/:id/cancel-fine", 
    isLoggedIn, 
    bookingController.cancelDamageFine
);

module.exports = router;