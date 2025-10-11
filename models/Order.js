const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    items: [{
        productName: {
            type: String,
            required: true
        },
        productId: {
            type: String,
            required: true
        },
        orderedQuantity: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        image: {
            type: String
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    delivered: {
        type: Boolean,
        default: false
    },
    orderedDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);