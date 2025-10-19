const mongoose = require('mongoose');

const pendingReviewSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    productId: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    orderId: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    review: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['incomplete', 'complete', 'skipped'],
        default: 'incomplete'
    },
    image: { // Add image for display
        type: String,
        default: ""
    },
    category: { // Add category for context
        type: String,
        default: ""
    }
}, {
    timestamps: true // This automatically adds createdAt and updatedAt
});

// Create index for faster queries
pendingReviewSchema.index({ userId: 1, status: 1 });
pendingReviewSchema.index({ productId: 1 });

module.exports = mongoose.model('PendingReview', pendingReviewSchema);