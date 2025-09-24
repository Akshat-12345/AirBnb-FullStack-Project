const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const Listing = require('../models/listing.js');
const ExpressError = require('../utils/ExpressError.js');
const { listingSchema} = require('../schema.js');
const{ isLoggedIn, isOwner } = require('../middleware.js');
const listingController = require('../controllers/listings.js');

const {storage} = require('../cloudConfig.js')
const multer  = require('multer');
const upload = multer({ storage });

// type of error check
const validateListing = (req,res,next)=>{
    let {error} = listingSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el)=> el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else(
        next()
    )
}

//index route
router.get("/", wrapAsync(listingController.index));
//new route
router.get("/new",isLoggedIn,listingController.renderNewForm);

//show route
router.get("/:id",wrapAsync(listingController.showListing));

// post route  ,validateListing
router.post("/",upload.single('listing[image]'), wrapAsync(listingController.createListing));

//Edit Route
router.get("/:id/edit",isLoggedIn,isOwner,validateListing,wrapAsync(listingController.editListings));

//update route
router.put('/:id',isLoggedIn, isOwner,upload.single('listing[image]'), wrapAsync(listingController.updateListings));

//Delete Route
router.delete('/:id',isLoggedIn, isOwner, wrapAsync(listingController.deleteListings));

module.exports =router;