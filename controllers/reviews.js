const Review = require('../models/review.js');
const Listing = require('../models/listing.js');

module.exports.createReviews = async(req,res,next)=>{
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    console.log('New Review Saved');
    req.flash('success','Review Sent Successfully!');
    res.redirect(`/listings/${listing._id}`);
}

module.exports.destroyReviews = async(req,res,next)=>{
        let{ id ,reviewId} = req.params;
        console.log("Delete request for:", id, reviewId);
        await Listing.findByIdAndUpdate(id,{$pull :{reviews :reviewId}})
        await Review.findByIdAndDelete(reviewId);
        res.redirect(`/listings/${id}`);
}