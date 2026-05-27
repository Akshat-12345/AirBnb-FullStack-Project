const express = require("express");
const router = express.Router({ mergeParams: true });
const bookingController = require("../controllers/bookings");
const { isLoggedIn } = require("../middleware"); 

// Route: Initiate Booking
router.post("/listings/:id/book", isLoggedIn, bookingController.initiateBooking);

// Route: Verify Payment
router.post("/bookings/verify-payment", isLoggedIn, bookingController.verifyPayment);

// === ADVANCED DASHBOARD ROUTES ===
// Route: User Travel Matrix Dashboard
router.get("/bookings/my-bookings", isLoggedIn, bookingController.myBookings);

// Route: Host Analytics Control Center Dashboard
router.get("/bookings/owner-dashboard", isLoggedIn, bookingController.ownerDashboard);

module.exports = router;