const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
    userEmail: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    categoryPreferences: {
        vegetables: { type: Number, default: 0 },
        fruits: { type: Number, default: 0 },
        grains: { type: Number, default: 0 },
        dairy: { type: Number, default: 0 },
        poultry: { type: Number, default: 0 },
        seafood: { type: Number, default: 0 },
        others: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('UserPreference', userPreferenceSchema);