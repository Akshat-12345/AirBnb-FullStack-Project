// routes/itinerary.js
const express = require("express");
const router = express.Router({ mergeParams: true });

// Jo controller humne Step 3 mein banaya, use import kiya
const itineraryController = require("../controllers/itinerary");

// Aapke project ke existing middlewares (MERN project se path automatic check kar lena)
const { isLoggedIn } = require("../middleware"); 

// Independent API endpoint jo query parameter se listingId lega aur controller trigger karega
router.get("/listing/:listingId/generate-itinerary", isLoggedIn, itineraryController.generateItinerary);

module.exports = router;