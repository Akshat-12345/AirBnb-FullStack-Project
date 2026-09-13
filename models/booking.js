// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;

// const bookingSchema = new Schema({
//     listing: {
//         type: Schema.Types.ObjectId,
//         ref: "Listing", 
//         required: true
//     },
//     user: {
//         type: Schema.Types.ObjectId,
//         ref: "User", 
//         required: true
//     },
//     checkInDate: {
//         type: Date,
//         required: true
//     },
//     checkOutDate: {
//         type: Date,
//         required: true
//     },
//     totalPrice: {
//         type: Number,
//         required: true
//     },
//     // Razorpay Integration Fields for Main Booker
//     razorpayOrderId: {
//         type: String,
//         required: true
//     },
//     razorpayPaymentId: {
//         type: String
//     },
//     paymentStatus: {
//         type: String,
//         enum: ["Pending", "Paid", "Failed", "Partially Paid", "Pending Split", "Refunded", "Cancelled"],
//         default: "Pending"
//     },
//     // Enhanced Bill Splitting Arrays
//     isSplitBooking: { 
//         type: Boolean, 
//         default: false 
//     },
//     splitParticipants: [{
//         user: {
//             type: Schema.Types.ObjectId,
//             ref: "User"
//         },
//         email: {
//             type: String,
//             required: true
//         },
//         shareAmount: {
//             type: Number,
//             required: true
//         },
//         hasPaid: { 
//             type: Boolean, 
//             default: false 
//         },
//         razorpayOrderId: {
//             type: String 
//         },
//         // 💥 FIXED: Individual friend payment token identifier
//         razorpayPaymentId: {
//             type: String
//         },
//         paidBy: {
//             type: Schema.Types.ObjectId,
//             ref: "User"
//         }
//     }],

//     // 📸 CHECK-IN VERIFICATION MATRIX
//     checkInMedia: {
//         photos: [
//             {
//                 url: String,
//                 filename: String
//             }
//         ],
//         video: {
//             url: String,
//             filename: String
//         },
//         uploadedAt: {
//             type: Date
//         }
//     },
//     isApprovedByOwner: {
//         type: Boolean,
//         default: false
//     },

//     // 📄 CHECK-OUT INTEGRITY VALIDATION MATRIX
//     checkOutMedia: {
//         photos: [
//             {
//                 url: String,
//                 filename: String
//             }
//         ],
//         video: {
//             url: String,
//             filename: String
//         },
//         uploadedAt: {
//             type: Date
//         }
//     },

//     // 🛡️ DAMAGE CLAIMS & FINANCIAL DISPUTE MANAGEMENT
//     dispute: {
//         isDamaged: { type: Boolean, default: false },
//         fineAmount: { type: Number, default: 0 },
//         fineReason: { type: String },
//         isFinePaid: { type: Boolean, default: false },
//         fineRazorpayOrderId: { type: String }
//     },

//     // ⏱️ STATE MACHINE PHASE TRACKING
//     bookingPhase: {
//         type: String,
//         enum: ["Booked", "CheckedIn", "CheckedOut"],
//         default: "Booked"
//     },

//     createdAt: {
//         type: Date,
//         default: Date.now
//     }
// });
  
// module.exports = mongoose.model("Booking", bookingSchema);



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
    // Razorpay Integration Fields for Main Booker
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Partially Paid", "Pending Split", "Refunded", "Cancelled"],
        default: "Pending"
    },
    // Enhanced Bill Splitting Arrays
    isSplitBooking: { 
        type: Boolean, 
        default: false 
    },
    splitParticipants: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User"
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
            type: String 
        },
        // Individual friend payment token identifier
        razorpayPaymentId: {
            type: String
        },
        paidBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    }],

    // 📸 CHECK-IN VERIFICATION MATRIX
    checkInMedia: {
        photos: [
            {
                url: String,
                filename: String
            }
        ],
        video: {
            url: String,
            filename: String
        },
        uploadedAt: {
            type: Date
        }
    },
    isApprovedByOwner: {
        type: Boolean,
        default: false
    },

    // 📄 CHECK-OUT INTEGRITY VALIDATION MATRIX
    checkOutMedia: {
        photos: [
            {
                url: String,
                filename: String
            }
        ],
        video: {
            url: String,
            filename: String
        },
        uploadedAt: {
            type: Date
        }
    },

    // 🤖 AI VISUAL AUDIT & CHANGE DETECTION (ATITHI-Net Engine)
    aiAudit: {
        isAudited: { 
            type: Boolean, 
            default: false 
        },
        auditTimestamp: { 
            type: Date 
        },
        integrityScore: { 
            type: Number, 
            min: 0, 
            max: 100, 
            default: 100 
        }, // 100 = Pristine room condition
        damagesDetected: [
            {
                category: { 
                    type: String, 
                    enum: ["Wall/Paint", "Electronic/Appliance", "Furniture/Glass", "Linen/Fabric", "Sanitary", "General"],
                    required: true 
                },
                severity: { 
                    type: String, 
                    enum: ["Low", "Moderate", "Critical"], 
                    default: "Low" 
                },
                confidenceScore: { 
                    type: Number 
                },
                affectedAreaRatio: { 
                    type: Number 
                },
                checkInEvidenceUrl: { 
                    type: String 
                },
                checkOutEvidenceUrl: { 
                    type: String 
                },
                heatMapMaskUrl: { 
                    type: String 
                },
                calculatedFine: { 
                    type: Number, 
                    default: 0 
                }
            }
        ],
        totalCalculatedFine: { 
            type: Number, 
            default: 0 
        },
        inferenceExecutionTimeMs: { 
            type: Number 
        },
        auditStatus: {
            type: String,
            enum: ["Idle", "Processing", "Completed", "Failed"],
            default: "Idle"
        }
    },

    // 🛡️ DAMAGE CLAIMS & FINANCIAL DISPUTE MANAGEMENT
    dispute: {
        isDamaged: { 
            type: Boolean, 
            default: false 
        },
        fineAmount: { 
            type: Number, 
            default: 0 
        },
        fineReason: { 
            type: String 
        },
        isFinePaid: { 
            type: Boolean, 
            default: false 
        },
        fineRazorpayOrderId: { 
            type: String 
        },
        fineRazorpayPaymentId: {
            type: String
        },
        ownerOverride: { 
            type: Boolean, 
            default: false 
        } // Allows host to modify or waive AI-calculated fines
    },

    // ⏱️ STATE MACHINE PHASE TRACKING
    bookingPhase: {
        type: String,
        enum: ["Booked", "CheckedIn", "CheckedOut"],
        default: "Booked"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Booking", bookingSchema);