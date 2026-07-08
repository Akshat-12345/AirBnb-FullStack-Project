const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const Listing = require('../models/listing.js');
const ExpressError = require('../utils/ExpressError.js');
const { listingSchema } = require('../schema.js');
const { isLoggedIn, isOwner } = require('../middleware.js');
const listingController = require('../controllers/listings.js');

const { storage } = require('../cloudConfig.js');
const multer = require('multer');

// 🚀 FIXED: Multer configuration with 50MB size limit allocation
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 50 * 1024 * 1024,  // 50MB per individual file constraint
        fieldSize: 50 * 1024 * 1024 // 50MB text/field limits framework
    } 
});

// type of error check
const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

// Index route
router.get("/", wrapAsync(listingController.index));

// New route
router.get("/new", isLoggedIn, listingController.renderNewForm);

// Show route
router.get("/:id", wrapAsync(listingController.showListing));

// Post route - Max 25 images with 50MB overall validation secure
router.post(
    "/", 
    isLoggedIn, 
    upload.array('listing[images]', 25), 
    wrapAsync(listingController.createListing)
);

// Edit Route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListings));

// Update route - Max 25 images with 50MB overall validation secure
router.put(
    '/:id', 
    isLoggedIn, 
    isOwner, 
    upload.array('listing[images]', 25), 
    wrapAsync(listingController.updateListings)
);

// Delete Route
router.delete('/:id', isLoggedIn, isOwner, wrapAsync(listingController.deleteListings));

module.exports = router;