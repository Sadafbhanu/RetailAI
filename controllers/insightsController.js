const Transaction = require('../models/transactionModel');
const Product = require('../models/productModel');

const getInsights = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0,0,0,0);

        const products = await Product.find();
        const transactions = await Transaction.find();

        let insights = [];

        // =========================
        // MAP PRODUCT IDs SAFELY
        // =========================
        const productMap = {};
        products.forEach(p => {
            productMap[p._id.toString()] = p;
        });

        // =========================
        // 1. LOW STOCK
        // =========================
        products.forEach(p => {
            if (p.quantity <= p.minThreshold) {
                insights.push({
                    type: "Low Stock",
                    message: `${p.name} is low in stock.`,
                    priority: "High"
                });
            }
        });

        // =========================
        // 2. EXPIRY
        // =========================
        products.forEach(p => {
            if (!p.expiryDate) return;

            const exp = new Date(p.expiryDate);
            exp.setHours(0,0,0,0);

            const diff = (exp - today) / (1000 * 60 * 60 * 24);

            if (diff < 0) {
                insights.push({
                    type: "Expiry",
                    message: `${p.name} has expired.`,
                    priority: "High"
                });
            } else if (diff <= 3) {
                insights.push({
                    type: "Expiry",
                    message: `${p.name} will expire in ${Math.ceil(diff)} day(s).`,
                    priority: "High"
                });
            }
        });

        // =========================
        // 3. SALES / DEMAND
        // =========================
        const salesMap = {};

        transactions.forEach(t => {
            const id = t.productId?.toString();

            // ❌ Ignore unknown products
            if (!productMap[id]) return;

            salesMap[id] = (salesMap[id] || 0) + (t.quantitySold || 1);
        });

        const sorted = Object.entries(salesMap).sort((a,b) => b[1] - a[1]);

        if (sorted.length > 0) {
            const top = productMap[sorted[0][0]];

            insights.push({
                type: "Demand",
                message: `${top.name} is selling fast.`,
                priority: "High"
            });
        }

        if (sorted.length > 1) {
            const slow = productMap[sorted[sorted.length - 1][0]];

            insights.push({
                type: "Demand",
                message: `${slow.name} is slow moving.`,
                priority: "Medium"
            });
        }

        // =========================
        // 4. PROFIT
        // =========================
        let maxPriceProduct = products[0];

        products.forEach(p => {
            if (p.price > maxPriceProduct.price) {
                maxPriceProduct = p;
            }
        });

        if (maxPriceProduct) {
            insights.push({
                type: "Profit",
                message: `${maxPriceProduct.name} is the highest priced product.`,
                priority: "Medium"
            });
        }

        // =========================
        // 5. SMART DYNAMIC SUGGESTIONS
        // =========================
        products.forEach(p => {
            const sold = salesMap[p._id.toString()] || 0;

            // Fast selling + low stock
            if (sold > 10 && p.quantity <= p.minThreshold) {
                insights.push({
                    type: "Suggestion",
                    message: `${p.name} is fast-selling and low in stock. Increase stock.`,
                    priority: "High"
                });
            }

            // Slow selling + high stock
            if (sold < 2 && p.quantity > p.minThreshold * 2) {
                insights.push({
                    type: "Suggestion",
                    message: `${p.name} has high stock but low sales. Reduce stock.`,
                    priority: "Medium"
                });
            }
        });

        // =========================
        // FINAL SAFETY
        // =========================
        if (insights.length === 0) {
            insights.push({
                type: "Info",
                message: "Not enough data to generate insights.",
                priority: "Low"
            });
        }

        res.json(insights);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getInsights };