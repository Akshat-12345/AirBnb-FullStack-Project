// models/itinerary.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const itinerarySchema = new Schema({
    // Existing User model se mapping
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User", 
        required: true
    },
    // Existing Listing model se mapping
    listingId: {
        type: Schema.Types.ObjectId,
        ref: "Listing", 
        required: true
    },
    destination: {
        type: String,
        required: true
    },
    // Ab yeh fixed 7 nahi rahega, user ke real stay duration ke hisab se save hoga
    totalDays: {
        type: Number,
        required: true
    },
    // AI se aane wala flexible dynamic array data isme store hoga
    scheduleData: { 
        type: Array, 
        required: true 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Itinerary", itinerarySchema);