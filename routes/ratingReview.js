const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// ✅ Save pending reviews after order
router.post('/save-pending', async (req, res) => {
    try {
        const pendingReviewsCollection = req.app.get('pendingReviewsCollection');
        const { userId, orderId, cartItems } = req.body;

        console.log("💾 Saving pending reviews for user:", userId);
        console.log("📦 Cart items to save:", cartItems);

        if (!userId || !orderId || !cartItems || !Array.isArray(cartItems)) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: userId, orderId, cartItems"
            });
        }

        // Create pending review documents
        const pendingReviews = cartItems.map(item => ({
            userId: userId,
            productId: item.productId,
            productName: item.productName,
            orderId: orderId,
            rating: null,
            review: "",
            status: "incomplete",
            image: item.image || "",
            category: item.category || "",
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        console.log("📝 Inserting pending reviews:", pendingReviews);

        const result = await pendingReviewsCollection.insertMany(pendingReviews);
        
        console.log("✅ Pending reviews saved successfully, count:", result.insertedCount);

        res.json({
            success: true,
            message: "Pending reviews saved successfully",
            count: result.insertedCount
        });

    } catch (error) {
        console.error("❌ Save pending reviews error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to save pending reviews: " + error.message 
        });
    }
});

// ✅ Get user's pending reviews
router.get('/pending/:userId', async (req, res) => {
    try {
        const pendingReviewsCollection = req.app.get('pendingReviewsCollection');
        const { userId } = req.params;

        console.log("🔍 Fetching pending reviews for user:", userId);

        const pendingReviews = await pendingReviewsCollection.find({
            userId: userId,
            status: "incomplete"
        }).sort({ createdAt: -1 }).toArray(); // Sort by newest first
        
        console.log("📦 Found pending reviews:", pendingReviews.length);

        res.json({
            success: true,
            pendingReviews: pendingReviews
        });

    } catch (error) {
        console.error("❌ Get pending reviews error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to get pending reviews: " + error.message 
        });
    }
});

// ✅ Submit review (update pending review and save to main collection)
router.patch('/submit/:reviewId', async (req, res) => {
    try {
        const pendingReviewsCollection = req.app.get('pendingReviewsCollection');
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { reviewId } = req.params;
        const { rating, review, status } = req.body;

        console.log("🔄 Submitting review:", { reviewId, rating, status });

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: "Review ID is required"
            });
        }

        // First, get the pending review to get product info
        const pendingReview = await pendingReviewsCollection.findOne({ 
            _id: new ObjectId(reviewId) 
        });

        if (!pendingReview) {
            return res.status(404).json({ 
                success: false, 
                message: "Review not found" 
            });
        }

        // If user is submitting a rating (not skipping), save to main collection
        if (status === 'complete' && rating) {
            console.log("⭐ Saving to main rating collection");
            
            const finalReview = {
                userId: pendingReview.userId,
                productId: pendingReview.productId,
                rating: parseInt(rating),
                review: review || "",
                createdAt: new Date()
            };

            await ratingReviewCollection.insertOne(finalReview);
            console.log("✅ Final review saved to main collection");
        }

        // Update the pending review status
        const updateData = {
            status: status,
            updatedAt: new Date()
        };

        if (rating !== undefined) updateData.rating = rating;
        if (review !== undefined) updateData.review = review;

        const result = await pendingReviewsCollection.updateOne(
            { _id: new ObjectId(reviewId) },
            { $set: updateData }
        );
        
        console.log("✅ Pending review updated:", result);

        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Review not found" 
            });
        }

        res.json({
            success: true,
            message: status === 'complete' ? "Review submitted successfully" : "Review skipped"
        });

    } catch (error) {
        console.error("❌ Submit review error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to submit review: " + error.message 
        });
    }
});

// ✅ Get all reviews for a product (for display on product page)
router.get('/product/:productId', async (req, res) => {
    try {
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { productId } = req.params;

        console.log("📊 Fetching rating for product:", productId);

        const reviews = await ratingReviewCollection.find({ productId }).toArray();
        
        if (reviews.length === 0) {
            return res.json({
                averageRating: 0,
                reviewCount: 0,
                reviews: []
            });
        }

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;

        res.json({
            averageRating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length,
            reviews: reviews
        });

    } catch (error) {
        console.error("❌ Rating fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product rating"
        });
    }
});

// ✅ Get all reviews for a product with details (for review popup)
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
            success: true,
            reviews: reviews,
            averageRating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length
        });

    } catch (error) {
        console.error("❌ Reviews fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product reviews"
        });
    }
});

// ✅ Submit review directly to main collection (legacy endpoint - keep for compatibility)
router.post('/submit', async (req, res) => {
    try {
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { userId, productId, rating, review } = req.body;

        console.log("⭐ Submitting direct review:", { userId, productId, rating });

        // Check if review already exists for this user and product
        const existingReview = await ratingReviewCollection.findOne({
            userId: userId,
            productId: productId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "You have already reviewed this product"
            });
        }

        const reviewDoc = {
            userId,
            productId,
            rating: parseInt(rating),
            review: review || "",
            createdAt: new Date()
        };

        const result = await ratingReviewCollection.insertOne(reviewDoc);
        
        console.log("✅ Direct review submitted:", result.insertedId);

        res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            review: { _id: result.insertedId, ...reviewDoc }
        });

    } catch (error) {
        console.error("❌ Review submission error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit review"
        });
    }
});

// ✅ Get user's review history (all reviews - pending, completed, skipped)
router.get('/user/:userId/history', async (req, res) => {
    try {
        const pendingReviewsCollection = req.app.get('pendingReviewsCollection');
        const ratingReviewCollection = req.app.get('ratingReviewCollection');
        const { userId } = req.params;

        console.log("📋 Getting review history for user:", userId);

        // Get pending reviews
        const pendingReviews = await pendingReviewsCollection.find({
            userId: userId
        }).sort({ createdAt: -1 }).toArray();

        // Get completed reviews from main collection
        const completedReviews = await ratingReviewCollection.find({
            userId: userId
        }).sort({ createdAt: -1 }).toArray();

        res.json({
            success: true,
            pendingReviews: pendingReviews,
            completedReviews: completedReviews,
            stats: {
                pending: pendingReviews.filter(r => r.status === 'incomplete').length,
                completed: completedReviews.length,
                skipped: pendingReviews.filter(r => r.status === 'skipped').length
            }
        });

    } catch (error) {
        console.error("❌ Get review history error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get review history"
        });
    }
});

// ✅ Clean up old skipped reviews (optional - for admin)
router.delete('/cleanup-skipped', async (req, res) => {
    try {
        const pendingReviewsCollection = req.app.get('pendingReviewsCollection');
        
        // Delete reviews that were skipped more than 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await pendingReviewsCollection.deleteMany({
            status: "skipped",
            updatedAt: { $lt: thirtyDaysAgo }
        });

        console.log("🧹 Cleaned up skipped reviews:", result.deletedCount);

        res.json({
            success: true,
            message: `Cleaned up ${result.deletedCount} skipped reviews`,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error("❌ Cleanup error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clean up reviews"
        });
    }
});

module.exports = router;
