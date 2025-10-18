// Agri-Linker-Server/models/OrderTrack.js
const mongoose = require('mongoose');

const orderTrackSchema = new mongoose.Schema({
    trackingNumber: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    items: [{
        productName: String,
        category: String,
        quantity: Number,
        unit: String,
        price: Number,
        image: String,
        productId: String
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        default: 'Order Placed'
    },
    statusHistory: [{
        status: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    shippingAddress: {
        type: String,
        default: 'Dhaka, Bangladesh' // You can make this dynamic later
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OrderTrack', orderTrackSchema);