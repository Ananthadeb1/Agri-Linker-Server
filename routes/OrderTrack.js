const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Generate unique tracking number
const generateTrackingNumber = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `ALK${timestamp}${random}`;
};

// Generate order ID (to match the orders system)
const generateOrderId = () => {
    return 'ORD' + Date.now();
};

// Create order from cart - UPDATED TO SYNC WITH BOTH SYSTEMS
router.post('/create', async (req, res) => {
    try {
        const { userId } = req.body;
        const cartCollection = req.app.get("cartCollection");
        const orderTrackCollection = req.app.get("orderTrackCollection");
        const orderCollection = req.app.get("orderCollection"); // For admin panel
        const productCollection = req.app.get("productCollection");

        console.log("🛒 Creating order for user:", userId);

        // 1. Get user's cart items
        const cartItems = await cartCollection.find({ buyerId: userId }).toArray();
        
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        console.log("📦 Cart items found:", cartItems.length);

        // 2. Calculate total
        const totalAmount = cartItems.reduce((total, item) => {
            return total + (item.price * item.orderedQuantity);
        }, 0);

        // 3. Generate both tracking number and order ID
        const trackingNumber = generateTrackingNumber();
        const orderId = generateOrderId();

        console.log("🎫 Generated IDs - Order:", orderId, "Tracking:", trackingNumber);

        // 4. Create order for OrderTrack system
        const orderItems = cartItems.map(item => ({
            productName: item.productName,
            category: item.category,
            quantity: item.orderedQuantity,
            unit: item.unit,
            price: item.price,
            image: item.image,
            productId: item.productId
        }));

        const newOrderTrack = {
            trackingNumber,
            orderId, // Add orderId for reference
            userId,
            items: orderItems,
            totalAmount,
            status: 'Order Placed',
            statusHistory: [{
                status: 'Order Placed',
                date: new Date(),
                note: 'Order successfully placed'
            }],
            createdAt: new Date()
        };

        // 5. Create order for Admin Panel system (ordered_Items collection)
        const newOrderForAdmin = {
            orderId: orderId,
            userId: userId,
            items: cartItems.map(item => ({
                productName: item.productName,
                productId: item.productId,
                orderedQuantity: item.orderedQuantity,
                unit: item.unit,
                price: item.price,
                image: item.image
            })),
            totalPrice: totalAmount,
            delivered: false,
            orderedDate: new Date()
        };

        // 6. Save to BOTH collections
        console.log("💾 Saving to OrderTrack collection...");
        const trackResult = await orderTrackCollection.insertOne(newOrderTrack);
        
        console.log("💾 Saving to ordered_Items collection for admin...");
        const adminResult = await orderCollection.insertOne(newOrderForAdmin);

        console.log("✅ Saved to both collections successfully");

        // 7. Update product quantities
        try {
            if (productCollection) {
                console.log("🔄 Updating product quantities...");
                for (const cartItem of cartItems) {
                    try {
                        const product = await productCollection.findOne({ 
                            _id: new ObjectId(cartItem.productId) 
                        });
                        
                        if (product && product.quantity) {
                            const newQuantity = product.quantity.value - cartItem.orderedQuantity;
                            await productCollection.updateOne(
                                { _id: new ObjectId(cartItem.productId) },
                                { 
                                    $set: { 
                                        "quantity.value": Math.max(0, newQuantity),
                                        "status": newQuantity <= 0 ? "out-of-stock" : "available"
                                    } 
                                }
                            );
                            console.log(`✅ Updated ${cartItem.productName}: ${product.quantity.value} → ${newQuantity}`);
                        }
                    } catch (itemError) {
                        console.error(`❌ Error updating product ${cartItem.productId}:`, itemError);
                    }
                }
            } else {
                console.log("⚠️ productCollection not available - skipping stock update");
            }
        } catch (stockError) {
            console.error("❌ Stock update error:", stockError);
        }

        // 8. Clear the user's cart after successful order
        console.log("🗑️ Clearing cart for user:", userId);
        await cartCollection.deleteMany({ buyerId: userId });

        // 9. Return success with both IDs
        res.json({
            success: true,
            message: 'Order placed successfully!',
            trackingNumber: trackingNumber,
            orderId: orderId, // Also return orderId
            order: newOrderTrack
        });

    } catch (error) {
        console.error('❌ Order creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: error.message
        });
    }
});

// ✅ UPDATED: Track order by tracking number - IMPROVED
router.get('/track/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const orderTrackCollection = req.app.get("orderTrackCollection");
        
        console.log("🔍 Tracking order:", trackingNumber);
        
        const order = await orderTrackCollection.findOne({ trackingNumber });
        
        if (!order) {
            console.log("❌ Order not found:", trackingNumber);
            return res.status(404).json({
                success: false,
                message: 'Order not found. Please check your tracking number.'
            });
        }

        console.log("✅ Order found:", order.trackingNumber, "Status:", order.status);
        res.json({
            success: true,
            order: order
        });

    } catch (error) {
        console.error('❌ Order tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while tracking order',
            error: error.message
        });
    }
});

// Track order by Order ID (for admin panel compatibility)
router.get('/by-order-id/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const orderTrackCollection = req.app.get("orderTrackCollection");
        
        console.log("🔍 Tracking by Order ID:", orderId);
        
        const order = await orderTrackCollection.findOne({ orderId });
        
        if (!order) {
            console.log("❌ Order not found by Order ID:", orderId);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log("✅ Order found by Order ID:", order.orderId);
        res.json({
            success: true,
            order: order
        });

    } catch (error) {
        console.error('❌ Order tracking by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get user's order history
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const orderTrackCollection = req.app.get("orderTrackCollection");
        
        console.log("📋 Getting order history for user:", userId);
        
        const orders = await orderTrackCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
        
        console.log(`✅ Found ${orders.length} orders for user`);
        res.json({
            success: true,
            orders: orders
        });

    } catch (error) {
        console.error('❌ Order history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get all orders (for admin)
router.get('/all', async (req, res) => {
    try {
        const orderTrackCollection = req.app.get("orderTrackCollection");
        
        console.log("📋 Getting all orders from OrderTrack");
        const orders = await orderTrackCollection.find().sort({ createdAt: -1 }).toArray();
        
        console.log(`✅ Found ${orders.length} total orders`);
        res.json({
            success: true,
            orders: orders
        });

    } catch (error) {
        console.error('❌ Get all orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Update order status
router.patch('/update-status/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const { status } = req.body;
        const orderTrackCollection = req.app.get("orderTrackCollection");
        
        console.log("🔄 Updating order status:", trackingNumber, "→", status);
        
        const result = await orderTrackCollection.updateOne(
            { trackingNumber },
            { 
                $set: { status },
                $push: { 
                    statusHistory: {
                        status: status,
                        date: new Date(),
                        note: `Status updated to ${status}`
                    }
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log("✅ Order status updated successfully");
        res.json({
            success: true,
            message: 'Order status updated successfully'
        });

    } catch (error) {
        console.error('❌ Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get order by ID (for internal use)
router.get('/order/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const orderTrackCollection = req.app.get("orderTrackCollection");
        
        console.log("🔍 Getting order by ID:", id);
        
        const order = await orderTrackCollection.findOne({ _id: new ObjectId(id) });
        
        if (!order) {
            console.log("❌ Order not found by ID:", id);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log("✅ Order found by ID:", order.trackingNumber);
        res.json({
            success: true,
            order: order
        });

    } catch (error) {
        console.error('❌ Get order by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;