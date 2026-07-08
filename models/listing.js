const { ref } = require('joi');
const mongoose = require('mongoose');
const Review = require('./review.js');

const listingSchema = new mongoose.Schema({
    title : {
        type : String,
        required : true,  
    },
    description : String,

    // Images structure updated with categorization tags
    images: [
        {
            url: String,
            filename: String,
            tag: {
                type: String,
                enum: ['General', 'Bedroom', 'Kitchen', 'Bathroom', 'Exterior'],
                default: 'General' // Agar user koi tag select na kare toh general save hoga
            }
        }
    ],

    price : Number,
    location : String,
    country : String,
    reviews : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Review',
        }
    ],
    owner : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
    },
    category: {
        type: String,
        enum: ['Trending', 'Rooms', 'Amazing views', 'Mansions', 'Amazing pools', 'Beach', 'Cabins', 'Camping', 'Farms'],
        default: 'Trending'
    },
});

// Middleware for deleting reviews when a listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
    if(listing){
        await Review.deleteMany({ _id : { $in : listing.reviews } });
    }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;