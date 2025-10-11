const mongoose = require('mongoose');

const ratingReviewSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    productId: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Ensure one review per user per product
ratingReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('RatingReview', ratingReviewSchema);