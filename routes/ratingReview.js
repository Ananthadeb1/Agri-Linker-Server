const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Submit review
router.post('/submit', async (req, res) => {
    try {
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { userId, productId, rating, review } = req.body;

        const reviewDoc = {
            userId,
            productId,
            rating: parseInt(rating),
            review: review || "",
            createdAt: new Date()
        };

        const result = await ratingReviewCollection.insertOne(reviewDoc);
        
        res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            review: { _id: result.insertedId, ...reviewDoc }
        });

    } catch (error) {
        console.error("Review submission error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit review"
        });
    }
});

// Get average rating and review count for a product
router.get('/product/:productId', async (req, res) => {
    try {
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { productId } = req.params;

        console.log("📊 Fetching rating for product:", productId);

        const reviews = await ratingReviewCollection.find({ productId }).toArray();
        
        if (reviews.length === 0) {
            return res.json({
                averageRating: 0,
                reviewCount: 0
            });
        }

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;

        res.json({
            averageRating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length
        });

    } catch (error) {
        console.error("Rating fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product rating"
        });
    }
});

// Get all reviews for a product
router.get('/product/:productId/reviews', async (req, res) => {
    try {
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { productId } = req.params;

        console.log("📝 Fetching reviews for product:", productId);

        const reviews = await ratingReviewCollection.find({ productId })
            .sort({ createdAt: -1 })
            .toArray();

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

        res.json({
            reviews: reviews,
            averageRating: parseFloat(averageRating.toFixed(1))
        });

    } catch (error) {
        console.error("Reviews fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product reviews"
        });
    }
});

module.exports = router;