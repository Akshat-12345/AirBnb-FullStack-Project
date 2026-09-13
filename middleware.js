const Listing = require('./models/listing.js');
const Review = require('./models/review.js');
const Booking = require('./models/booking.js');

// 1. Updated: Checks both Passport Session and JWT req.user
module.exports.isLoggedIn = (req, res, next) => {
    const isAuthed = (req.isAuthenticated && req.isAuthenticated()) || req.user;
    if (!isAuthed) {
        req.session.redirectUrl = req.originalUrl;
        req.flash('error', 'You Must Be Logged-In to Create Listings');
        return res.redirect('/login');
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    } 
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;       
    let listing = await Listing.findById(id);
    const currentUserId = res.locals.currUser?._id || req.user?._id;

    if (!listing.owner._id.equals(currentUserId)) {
        req.flash('error', "You are Not The Owner of This Listing!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
    let { id, reviewId } = req.params;       
    let review = await Review.findById(reviewId);
    const currentUserId = res.locals.currUser?._id || req.user?._id;

    if (!review.author._id.equals(currentUserId)) {
        req.flash('error', "You are Not The Author of This Review!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// 2. Updated: Supports both Session & JWT inside review lock
module.exports.isReviewEnforced = async (req, res, next) => {
    const isAuthed = (req.isAuthenticated && req.isAuthenticated()) || req.user;
    if (!isAuthed) {
        return next();
    }

    try {
        const pendingCheckoutBooking = await Booking.findOne({
            user: req.user._id,
            bookingPhase: "CheckedOut"
        }).populate("listing");

        if (pendingCheckoutBooking && pendingCheckoutBooking.listing) {
            
            // Dispute Fine Check
            if (pendingCheckoutBooking.dispute && 
                pendingCheckoutBooking.dispute.isDamaged && 
                !pendingCheckoutBooking.dispute.isFinePaid) {
                
                const fineSafeUrls = [
                    "/bookings/my-bookings",
                    "/bookings/verify-fine-payment"
                ];

                if (!fineSafeUrls.includes(req.originalUrl)) {
                    req.flash('error', "🚨 Access Blocked: You have a pending property damage fine! Please settle your dues on the dashboard before creating reviews or browsing.");
                    return res.redirect("/bookings/my-bookings");
                }
                
                return next();
            }

            // Review Submission Lock
            const listingWithReviews = await Listing.findById(pendingCheckoutBooking.listing._id).populate({
                path: "reviews",
                match: { author: req.user._id }
            });

            if (!listingWithReviews.reviews || listingWithReviews.reviews.length === 0) {
                const reviewSafeUrls = [
                    `/listings/${pendingCheckoutBooking.listing._id}`,
                    `/listings/${pendingCheckoutBooking.listing._id}/reviews`
                ];

                if (!reviewSafeUrls.includes(req.originalUrl)) {
                    req.flash('error', "⚠️ Access Blocked: You must submit a property review before exiting your stay workflow!");
                    return res.redirect(`/listings/${pendingCheckoutBooking.listing._id}`);
                }
            }
        }
        next();
    } catch (err) {
        console.error("🚨 Review & Fine Guard Matrix Failure:", err);
        next();
    }
};