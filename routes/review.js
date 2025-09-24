const express = require('express');
const router = express.Router({mergeParams :true});
const ExpressError = require('../utils/ExpressError.js');
const wrapAsync = require('../utils/wrapAsync.js');
const Review = require('../models/review.js');
const Listing = require('../models/listing.js');
const { reviewSchema } = require('../schema.js');
const{ isLoggedIn, isReviewAuthor} = require('../middleware.js');
const reviewController = require('../controllers/reviews.js');

//review validate 
const validateReview = (req,res,next)=>{
    let {error} = reviewSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el)=> el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else(
        next()
    )
}

//Reviews
//POST route
router.post("/",isLoggedIn,validateReview,wrapAsync(reviewController.createReviews));

// delete route
router.delete("/:reviewId",isLoggedIn,isReviewAuthor,wrapAsync(reviewController.destroyReviews));

module.exports =router;