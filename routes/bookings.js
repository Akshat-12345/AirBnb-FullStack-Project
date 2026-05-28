const express = require("express");
const router = express.Router({ mergeParams: true });
const bookingController = require("../controllers/bookings");
const { isLoggedIn } = require("../middleware"); 

// Route: Initiate Booking (Main Booker)
router.post("/listings/:id/book", isLoggedIn, bookingController.initiateBooking);

// Route: Verify Payment (Main Booker)
router.post("/bookings/verify-payment", isLoggedIn, bookingController.verifyPayment);

// === NEW FEATURE: INDIVIDUAL CO-TRAVELER SHARE SETTLEMENTS ===
// Route: Initiate Share Payment for a specific friend node from Dashboard
router.post("/bookings/initiate-share-payment", isLoggedIn, bookingController.initiateSharePayment);

// Route: Verify Share Payment for friends or sick-friend bypass authorization
router.post("/bookings/verify-share-payment", isLoggedIn, bookingController.verifySharePayment);

// === ADVANCED DASHBOARD ROUTES ===
// Route: User Travel Matrix Dashboard
router.get("/bookings/my-bookings", isLoggedIn, bookingController.myBookings);

// Route: Host Analytics Control Center Dashboard
router.get("/bookings/owner-dashboard", isLoggedIn, bookingController.ownerDashboard);

module.exports = router;