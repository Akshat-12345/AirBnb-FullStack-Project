const Listing = require('./models/listing.js');
const Review = require('./models/review.js');
const Booking = require('./models/booking.js'); // Naya module linkage review verification ke liye

module.exports.isLoggedIn = (req,res,next)=>{
    if(!req.isAuthenticated()){
        //redirect url
        req.session.redirectUrl = req.originalUrl;
        req.flash('error','You Must Be Logged-In to Create Listings');
        return res.redirect('/login');
    }
    next();
}

module.exports.saveRedirectUrl = (req,res,next)=>{
    if(req.session.redirectUrl){
       res.locals.redirectUrl = req.session.redirectUrl;
    } 
    next();
}

module.exports.isOwner = async(req,res,next)=>{
    let {id} = req.params;       
    let listing = await Listing.findById(id);
    if(!listing.owner._id.equals(res.locals.currUser._id)){
        req.flash('error',"You are Not The Owner of This Listing!");
        return res.redirect(`/listings/${id}`);
    }
    next();
}

module.exports.isReviewAuthor = async(req,res,next)=>{
    let { id, reviewId } = req.params;       
    let review = await Review.findById(reviewId);
    if(!review.author._id.equals(res.locals.currUser._id)){
        req.flash('error',"You are Not The Author of This Review!");
        return res.redirect(`/listings/${id}`);
    }
    next();
}


// Inside your middleware.js -> Update the isReviewEnforced block completely

module.exports.isReviewEnforced = async (req, res, next) => {
    // Agar user logged in nahi hai, toh check skip karke aage badhne do
    if (!req.isAuthenticated()) {
        return next();
    }

    try {
        // Find if this user has any active CheckedOut stay logs
        const pendingCheckoutBooking = await Booking.findOne({
            user: req.user._id,
            bookingPhase: "CheckedOut"
        }).populate("listing");

        if (pendingCheckoutBooking && pendingCheckoutBooking.listing) {
            
            // =========================================================================
            // 🚨 CRITICAL LOCK: DISPUTE FINE CHECK BEFORE REVIEW ALLOWED (PHASE 8.5)
            // =========================================================================
            // Agar host ne damage log kiya hai AUR fine abhi tak paid nahi hua hai
            if (pendingCheckoutBooking.dispute && 
                pendingCheckoutBooking.dispute.isDamaged && 
                !pendingCheckoutBooking.dispute.isFinePaid) {
                
                // Allow user to hit the dashboard only to pay the fine, block everything else
                const fineSafeUrls = [
                    "/bookings/my-bookings",
                    "/bookings/verify-fine-payment"
                ];

                if (!fineSafeUrls.includes(req.originalUrl)) {
                    req.flash('error', "🚨 Access Blocked: You have a pending property damage fine! Please settle your dues on the dashboard before creating reviews or browsing.");
                    return res.redirect("/bookings/my-bookings");
                }
                
                return next(); // If on my-bookings dashboard to pay fine, pass through
            }

            // =========================================================================
            // 📝 REVIEWS ENFORCEMENT STATE LOCK (Executes only if Fine is Paid/Cleared)
            // =========================================================================
            const listingWithReviews = await Listing.findById(pendingCheckoutBooking.listing._id).populate({
                path: "reviews",
                match: { author: req.user._id }
            });

            // Agar fine cleared hai par review abhi tak nahi diya, toh show page par redirect loop lagao
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