const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    orderedQuantity: {
        type: Number,
        required: true,
        min: 1
    },
    buyerId: {
        type: String,  // Using String since Firebase UID is string
        required: true
    },
    productId: {
        type: String,  // Using String for consistency
        required: true
    },
    unit: { // Add this field to store the unit
        type: String,
        required: true
    },
    price: { // Add price for cart calculations
        type: Number,
        required: true
    },
    image: { // Add image for cart display
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Cart', cartSchema);