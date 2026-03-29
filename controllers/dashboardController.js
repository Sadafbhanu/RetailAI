const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Transaction = require('../models/transactionModel');
const { getExpiryStatus } = require('../utils/expiry');

const getDashboardData = asyncHandler(async (req, res) => {
    const ownerID = req.user._id;

    /* ===============================
       1️⃣ Fetch Products
    ================================ */
    const products = await Product.find({ ownerID });

    /* ===============================
       2️⃣ Total Inventory Value
    ================================ */
    const totalInventoryValue = products.reduce(
        (sum, product) => sum + product.quantity * product.price,
        0
    );

    /* ===============================
       3️⃣ Critical Expiry Alerts
    ================================ */
    const criticalAlertsCount = products.filter(product => {
        const status = getExpiryStatus(product.expiryDate);
        return status === 'Expired' || status === 'Warning';
    }).length;

    /* ===============================
       4️⃣ Top Selling Products (Safer Version)
    ================================ */
    const topSellingProducts = await Transaction.aggregate([
    {
        $match: {
            ownerID: req.user._id,
            type: 'Sale'
        }
    },
    {
        $group: {
            _id: '$product',
            totalSold: { $sum: '$quantity' }
        }
    },
    {
        $lookup: {
            from: 'products', // Mongo collection name
            localField: '_id',
            foreignField: '_id',
            as: 'productDetails'
        }
    },
    { $unwind: '$productDetails' },
    {
        $project: {
            _id: 0,
            productId: '$_id',
            productName: '$productDetails.name',
            totalSold: 1
        }
    },
    {
        $sort: { totalSold: -1 }
    },
    {
        $limit: 5
    }
]);

    res.json({
        totalInventoryValue,
        criticalAlertsCount,
        topSellingProducts
    });
});

module.exports = { getDashboardData };