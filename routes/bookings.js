const express = require("express");
const router = express.Router({ mergeParams: true });
const bookingController = require("../controllers/bookings");
const { isLoggedIn } = require("../middleware"); // Jo bhi tumhara auth middleware hai

// Route: Initiate Booking
router.post("/listings/:id/book", isLoggedIn, bookingController.initiateBooking);

// Route: Verify Payment
router.post("/bookings/verify-payment", isLoggedIn, bookingController.verifyPayment);

module.exports = router;