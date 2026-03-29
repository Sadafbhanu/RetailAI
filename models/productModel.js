const mongoose = require('mongoose');
const User = require('./userModel');


const productSchema = new mongoose.Schema({
    name: String,
    quantity: Number,
    purchaseDate: { type: Date, default: Date.now },
    expiryDate: Date,
    price: Number,
    minThreshold: { type: Number, default: 5 }, 
    category: {
        type: String,
        default: 'General'
    },// For Stock-out alerts
    ownerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
    },
}, { timestamps: true }); // This adds createdAt and updatedAt

// Virtual for Freshness Index: FI = (TL - TE) / TL
productSchema.virtual('freshnessIndex').get(function() {
    if (!this.expiryDate || !this.purchaseDate) return 0;
    const totalLife = this.expiryDate.getTime() - this.purchaseDate.getTime();
    const elapsed = new Date().getTime() - this.purchaseDate.getTime();

    if (totalLife <= 0) {
        return 0; // Or handle as an edge case, maybe return -1
    }
    return (totalLife - elapsed) / totalLife;
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;