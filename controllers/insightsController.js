const Transaction = require('../models/transactionModel');
const Product = require('../models/productModel');
const { predictDemandDirection, predictDiscountPrice } = require('../utils/mlRecommender');

const getInsights = async (req, res) => {
    try {
        const now = new Date();
        const products = await Product.find({ ownerID: req.user._id });
        const transactions = await Transaction.find({
            ownerID: req.user._id,
            type: 'Sale',
        });

        const productMap = new Map(products.map((p) => [p._id.toString(), p]));
        const dayMs = 24 * 60 * 60 * 1000;
        const demandWindowDays = 14;

        // Build per-product sales metrics for two windows: last 14 days vs previous 14 days.
        const currentSales = new Map();
        const previousSales = new Map();
        const weekendSales = new Map();
        const totalSales = new Map();
        const dailyTotals = new Map(); // key: YYYY-MM-DD

        const currentStart = new Date(now.getTime() - demandWindowDays * dayMs);
        const previousStart = new Date(now.getTime() - demandWindowDays * 2 * dayMs);

        for (const t of transactions) {
            const id = t.product?.toString();
            if (!id || !productMap.has(id)) continue;
            const qty = Number(t.quantity) || 0;
            if (qty <= 0) continue;

            totalSales.set(id, (totalSales.get(id) || 0) + qty);

            const soldAt = new Date(t.createdAt);
            if (soldAt >= currentStart) {
                currentSales.set(id, (currentSales.get(id) || 0) + qty);
            } else if (soldAt >= previousStart && soldAt < currentStart) {
                previousSales.set(id, (previousSales.get(id) || 0) + qty);
            }

            const isWeekend = soldAt.getDay() === 0 || soldAt.getDay() === 6;
            if (isWeekend) {
                weekendSales.set(id, (weekendSales.get(id) || 0) + qty);
            }

            const dayKey = soldAt.toISOString().slice(0, 10);
            dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + qty);
        }

        const insights = [];

        // 1) Demand Forecast (ML-based direction + confidence)
        for (const p of products) {
            const id = p._id.toString();
            const cur = currentSales.get(id) || 0;
            const prev = previousSales.get(id) || 0;
            const total = totalSales.get(id) || 0;
            if (cur === 0 && prev === 0) continue;

            const weekendRatio = total > 0 ? (weekendSales.get(id) || 0) / total : 0;
            const demand = predictDemandDirection({
                currentSales: cur,
                previousSales: prev,
                weekendRatio,
                stockRatio: (Number(p.quantity) || 0) / Math.max(1, Number(p.minThreshold) || 5),
            });
            const forecast = demand.direction;
            const priority = demand.confidence >= 0.8
                ? 'High'
                : demand.confidence >= 0.6
                    ? 'Medium'
                    : 'Low';

            insights.push({
                section: 'Demand Forecast',
                type: 'Demand Forecast',
                title: `${p.name}: demand may ${forecast}`,
                message: `Reason: ${demand.reason}. Confidence: ${(demand.confidence * 100).toFixed(0)}%.`,
                priority,
            });
        }

        // 2) Trend Analysis (fast-growing / declining + unusual spikes/drops)
        const growthScores = products.map((p) => {
            const id = p._id.toString();
            const cur = currentSales.get(id) || 0;
            const prev = previousSales.get(id) || 0;
            return { p, cur, prev, delta: cur - prev };
        });

        const fastGrowing = growthScores
            .filter((x) => x.cur > 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 2);
        const declining = growthScores
            .filter((x) => x.prev > 0)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, 2);

        fastGrowing.forEach(({ p, cur, prev, delta }) => {
            if (delta <= 0) return;
            insights.push({
                section: 'Trend Analysis',
                type: 'Trend',
                title: `${p.name}: fast-growing`,
                message: `Sales increased by ${delta} units (${prev} -> ${cur}) in recent ${demandWindowDays}-day windows.`,
                priority: 'High',
            });
        });

        declining.forEach(({ p, cur, prev, delta }) => {
            if (delta >= 0) return;
            insights.push({
                section: 'Trend Analysis',
                type: 'Trend',
                title: `${p.name}: declining`,
                message: `Sales decreased by ${Math.abs(delta)} units (${prev} -> ${cur}) in recent ${demandWindowDays}-day windows.`,
                priority: 'Medium',
            });
        });

        const dailyValues = [...dailyTotals.values()];
        if (dailyValues.length >= 7) {
            const avg = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
            const max = Math.max(...dailyValues);
            const min = Math.min(...dailyValues);
            if (max >= avg * 1.8) {
                insights.push({
                    section: 'Trend Analysis',
                    type: 'Trend',
                    title: 'Unusual spike detected',
                    message: `Peak daily sales (${max}) are significantly above average (${avg.toFixed(1)}).`,
                    priority: 'Medium',
                });
            }
            if (min <= avg * 0.4) {
                insights.push({
                    section: 'Trend Analysis',
                    type: 'Trend',
                    title: 'Unusual drop detected',
                    message: `Lowest daily sales (${min}) are well below average (${avg.toFixed(1)}).`,
                    priority: 'Medium',
                });
            }
        }

        // 3) Smart Offer Suggestions (ML-guided pricing + recommendations)
        const bySlowSales = products
            .map((p) => {
                const id = p._id.toString();
                return {
                    p,
                    sold: currentSales.get(id) || 0,
                };
            })
            .sort((a, b) => a.sold - b.sold);

        bySlowSales.slice(0, 3).forEach(({ p, sold }) => {
            if ((p.quantity || 0) <= (p.minThreshold || 0)) return;
            const ml = predictDiscountPrice({
                price: p.price,
                costPrice: p.costPrice,
                quantity: p.quantity,
                minThreshold: p.minThreshold,
                expiryDate: p.expiryDate,
                soldQtyInWindow: sold,
                windowDays: demandWindowDays,
            });

            insights.push({
                section: 'Smart Offer Suggestions',
                type: 'Offer',
                title: `${p.name}: discount recommendation`,
                message: `Slow-moving stock (sold ${sold} in last ${demandWindowDays} days). Suggested price: ₹${ml.suggestedPrice.toFixed(2)} (${(ml.discountPct * 100).toFixed(0)}% discount, confidence ${(ml.confidence * 100).toFixed(0)}%).`,
                priority: 'Medium',
            });
        });

        const topSelling = growthScores
            .filter((x) => x.cur > 0)
            .sort((a, b) => b.cur - a.cur)
            .slice(0, 2);
        if (topSelling.length === 2) {
            insights.push({
                section: 'Smart Offer Suggestions',
                type: 'Offer',
                title: 'Combo offer suggestion',
                message: `Try combo: Buy ${topSelling[0].p.name} + ${topSelling[1].p.name} for a bundle price.`,
                priority: 'Low',
            });
        }

        const deadStock = products
            .filter((p) => (p.quantity || 0) > 0 && (totalSales.get(p._id.toString()) || 0) === 0)
            .slice(0, 3);
        deadStock.forEach((p) => {
            insights.push({
                section: 'Smart Offer Suggestions',
                type: 'Offer',
                title: `${p.name}: clearance suggestion`,
                message: `No recorded sales recently while stock exists. Suggest clearance sale to free shelf space.`,
                priority: 'High',
            });
        });

        if (insights.length === 0) {
            insights.push({
                section: 'Demand Forecast',
                type: 'Info',
                title: 'Not enough data',
                message: 'Need more sales history to generate advanced retail insights.',
                priority: 'Low',
            });
        }

        res.json(insights);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getInsights };