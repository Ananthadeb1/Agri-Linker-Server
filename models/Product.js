const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String, // This will store the image URL after uploading
        required: true
    },
    quantity: {
        value: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            enum: ['kg', 'grams', 'pounds', 'liters', 'pieces'],
            required: true
        }
    },
    category: {
        type: String,
        required: true,
        enum: ['vegetables', 'fruits', 'grains', 'dairy', 'poultry', 'seafood', 'others']
    },
    farmerEmail: {
        type: String,
        required: true
    },
    price: {
        type: Number, // Price per unit (kg/grams/pounds etc.)
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'sold-out'],
        default: 'available'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);