const asyncHandler = require('../middleware/asyncHandler');
const Product = require('../models/productModel');
const Transaction = require('../models/transactionModel');
const { getExpiryStatus } = require('../utils/expiry');

const getDashboardData = asyncHandler(async (req, res) => {

    const ownerID = req.user._id;

    // 📦 Products
    const products = await Product.find({ ownerID });

    // 💰 Total Inventory Value
    const totalInventoryValue = products.reduce(
        (sum, product) => sum + product.quantity * product.price,
        0
    );

    // ⚠️ Expiry Alerts
    const expiryAlerts = products.filter(product => {
        const status = getExpiryStatus(product.expiryDate);
        return status === 'Expired' || status === 'Warning';
    });

    const criticalAlertsCount = expiryAlerts.length;

    res.json({
        totalInventoryValue,
        totalProducts: products.length,
        criticalAlertsCount,
        expiryAlerts
    });
});

module.exports = { getDashboardData };