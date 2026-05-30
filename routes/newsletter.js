// routes/newsletter.js
const express = require("express");
const router = express.Router();
const newsletterController = require("../controllers/newsletter");

// Isolated POST route for async footer interactions
router.post("/subscribe", newsletterController.subscribe);

module.exports = router;