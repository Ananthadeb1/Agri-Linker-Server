const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Add item to cart
router.post('/add', async (req, res) => {
  try {
    const cartCollection = req.app.get('cartCollection');
    console.log("🛒 Received cart request:", req.body);
    
    const { productName, category, orderedQuantity, buyerId, productId, unit, price, image } = req.body;
    
    // Validate required fields
    if (!productName || !category || !orderedQuantity || !buyerId || !productId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Check if item already exists in cart
    const existingCartItem = await cartCollection.findOne({ 
      buyerId: buyerId, 
      productId: productId 
    });

    if (existingCartItem) {
      // Update quantity if item already exists
      const result = await cartCollection.updateOne(
        { _id: existingCartItem._id },
        { $inc: { orderedQuantity: orderedQuantity } }
      );
      
      return res.status(200).json({ 
        success: true, 
        message: "Cart item quantity updated",
        cartItem: { ...existingCartItem, orderedQuantity: existingCartItem.orderedQuantity + orderedQuantity }
      });
    }

    // Create new cart item
    const cartItem = {
      productName,
      category,
      orderedQuantity: Number(orderedQuantity),
      buyerId,
      productId,
      unit: unit || 'piece',
      price: price || 0,
      image: image || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await cartCollection.insertOne(cartItem);
    
    res.status(201).json({ 
      success: true, 
      message: "Item added to cart successfully",
      cartItem: { _id: result.insertedId, ...cartItem }
    });
  } catch (error) {
    console.error("❌ Cart add error:", error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get all cart items for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const cartCollection = req.app.get('cartCollection');
    const items = await cartCollection.find({ buyerId: req.params.userId }).toArray();
    res.json({
      success: true,
      items: items
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to get cart items" 
    });
  }
});

// Remove item from cart
router.delete('/remove/:cartItemId', async (req, res) => {
  try {
    const cartCollection = req.app.get('cartCollection');
    const { cartItemId } = req.params;
    const result = await cartCollection.deleteOne({ _id: new ObjectId(cartItemId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }
    
    res.json({
      success: true,
      message: "Item removed from cart"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart"
    });
  }
});

module.exports = router;