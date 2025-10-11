const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const connectDB = require('../DBconnection.js');

let client;
let cartCollection, productCollection, orderCollection;

// Initialize collections when server starts
connectDB().then(dbClient => {
    client = dbClient;
    cartCollection = client.db("AgriLinker").collection("carts");
    productCollection = client.db("AgriLinker").collection("products");
    orderCollection = client.db("AgriLinker").collection("ordered_Items");
    console.log("✅ Order routes collections initialized");
});

// Create new order
router.post('/create', async (req, res) => {
    try {
        console.log("🛒 Order creation started for user:", req.body.userId);
        
        if (!cartCollection || !productCollection || !orderCollection) {
            return res.status(500).json({
                success: false,
                message: "Server not ready. Please try again."
            });
        }
        
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Get user's cart items
        const cartItems = await cartCollection.find({ buyerId: userId }).toArray();
        console.log("📦 Cart items found:", cartItems.length);
        
        if (cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        // Calculate total price
        const totalPrice = cartItems.reduce((total, item) => total + (item.price * item.orderedQuantity), 0);
        console.log("💰 Total price:", totalPrice);

        // Generate unique order ID
        const orderId = 'ORD' + Date.now();

        // Create order document
        const order = {
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
            totalPrice: totalPrice,
            delivered: false,
            orderedDate: new Date()
        };

        console.log("🔄 Updating product quantities...");

        // Update product quantities and check availability
        for (const item of cartItems) {
            console.log("📝 Processing item:", item.productName, "ID:", item.productId);
            
            const product = await productCollection.findOne({ _id: new ObjectId(item.productId) });
            
            if (!product) {
                console.log("❌ Product not found:", item.productId);
                return res.status(400).json({
                    success: false,
                    message: `Product not found: ${item.productName}`
                });
            }

            console.log("📊 Product found:", product.name, "Available:", product.quantity.value, product.quantity.unit);

            if (product.quantity.value < item.orderedQuantity) {
                console.log("❌ Insufficient quantity");
                return res.status(400).json({
                    success: false,
                    message: `Insufficient quantity for ${product.name}. Available: ${product.quantity.value} ${product.quantity.unit}`
                });
            }

            // Update product quantity
            const updateResult = await productCollection.updateOne(
                { _id: new ObjectId(item.productId) },
                { $inc: { "quantity.value": -item.orderedQuantity } }
            );

            console.log("✅ Product quantity updated:", updateResult.modifiedCount);
        }

        // Save order to database
        console.log("💾 Saving order to database...");
        const orderResult = await orderCollection.insertOne(order);
        console.log("✅ Order saved with ID:", orderResult.insertedId);

        // Clear user's cart
        console.log("🗑️ Clearing cart for user:", userId);
        const deleteResult = await cartCollection.deleteMany({ buyerId: userId });
        console.log("✅ Cart cleared, items removed:", deleteResult.deletedCount);

        res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order: {
                _id: orderResult.insertedId,
                ...order
            }
        });

    } catch (error) {
        console.error("❌ Order creation error:", error);
        console.error("❌ Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Failed to create order: " + error.message
        });
    }
});

module.exports = router;