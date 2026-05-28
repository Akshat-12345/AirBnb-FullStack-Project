const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing", 
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User", 
        required: true
    },
    checkInDate: {
        type: Date,
        required: true
    },
    checkOutDate: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    // Razorpay Integration Fields
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Partially Paid", "Pending Split"],
        default: "Pending"
    },
    // New Feature: Bill Splitting (Enhanced as per Akshat's System Design)
    isSplitBooking: { 
        type: Boolean, 
        default: false 
    },
    splitParticipants: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User" // Validation matrix integration ke liye registered user linkage
        },
        email: {
            type: String,
            required: true
        },
        shareAmount: {
            type: Number,
            required: true
        },
        hasPaid: { 
            type: Boolean, 
            default: false 
        },
        razorpayOrderId: {
            type: String // Har bande ke dynamic checkout session tracking ke liye
        },
        paidBy: {
            type: Schema.Types.ObjectId,
            ref: "User" // System design twist: Agar dost bimar hai toh real-time me track hoga kisne backup kiya!
        }
    }],
    // New Feature: Room Verification Video
    checkInVideo: {
        url: String,
        filename: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
  
module.exports = mongoose.model("Booking", bookingSchema);