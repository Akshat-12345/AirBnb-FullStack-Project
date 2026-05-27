const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing", // Jo tumhara existing property model hai
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User", // Jo tumhara authentication/user model hai
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
        enum: ["Pending", "Paid", "Failed", "Pending Split"],
        default: "Pending"
    },
    // New Feature: Bill Splitting
    isSplitBooking: { 
        type: Boolean, 
        default: false 
    },
    splitParticipants: [{
        email: String,
        shareAmount: Number,
        hasPaid: { type: Boolean, default: false }
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