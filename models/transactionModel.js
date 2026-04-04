const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
{
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    ownerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['Sale', 'Restock'],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
},
{
    timestamps: true   // ✅ creates createdAt & updatedAt automatically
});

module.exports = mongoose.model('Transaction', transactionSchema);