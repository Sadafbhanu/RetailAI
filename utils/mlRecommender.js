function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}

function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function normalize(features) {
    const salesVelocity = Number(features.salesVelocity || 0); // units/day
    const stockRatio = Number(features.stockRatio || 0); // qty / minThreshold
    const daysToExpiry = Number(features.daysToExpiry || 60);
    const marginRatio = Number(features.marginRatio || 0.25);

    return {
        salesVelocity: clamp(salesVelocity / 4, 0, 2.5),
        stockRatio: clamp(stockRatio / 4, 0, 2.5),
        expiryUrgency: daysToExpiry < 0 ? 1 : clamp((30 - daysToExpiry) / 30, 0, 1),
        marginRatio: clamp(marginRatio, 0, 0.8),
    };
}

/**
 * Lightweight model score for discounting.
 * Higher score => stronger discount recommendation.
 */
function scoreDiscountNeed(rawFeatures) {
    const f = normalize(rawFeatures);
    return (
        -0.65 * f.salesVelocity +
        0.55 * f.stockRatio +
        0.8 * f.expiryUrgency -
        0.25 * f.marginRatio
    );
}

function predictDiscountPrice(input) {
    const price = Number(input.price || 0);
    const costPrice = Number(input.costPrice || price * 0.7);
    if (price <= 0) return { suggestedPrice: 0, discountPct: 0, confidence: 0 };

    const quantity = Number(input.quantity || 0);
    const minThreshold = Math.max(1, Number(input.minThreshold || 5));
    const soldQtyInWindow = Number(input.soldQtyInWindow || 0);
    const windowDays = Math.max(1, Number(input.windowDays || 30));
    const salesVelocity = soldQtyInWindow / windowDays;

    let daysToExpiry = 90;
    if (input.expiryDate) {
        const exp = new Date(input.expiryDate);
        const today = new Date();
        exp.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        daysToExpiry = (exp - today) / 86400000;
    }

    const features = {
        salesVelocity,
        stockRatio: quantity / minThreshold,
        daysToExpiry,
        marginRatio: (price - costPrice) / Math.max(price, 1),
    };

    const score = scoreDiscountNeed(features);
    const confidence = clamp(sigmoid(Math.abs(score)) * 0.9, 0.5, 0.95);
    const discountPct = clamp(0.08 + sigmoid(score) * 0.32, 0.05, 0.42);
    const raw = price * (1 - discountPct);
    const floor = Math.max(costPrice * 1.02, price * 0.52);
    const suggestedPrice = Math.round(Math.max(raw, floor) * 100) / 100;

    return { suggestedPrice, discountPct, confidence };
}

function predictDemandDirection(input) {
    const current = Number(input.currentSales || 0);
    const previous = Number(input.previousSales || 0);
    const weekendRatio = Number(input.weekendRatio || 0);
    const stockRatio = Number(input.stockRatio || 0);

    // 3-class one-vs-rest style scores.
    const growthSignal = previous > 0 ? (current - previous) / previous : current > 0 ? 0.35 : 0;
    const decSignal = previous > 0 ? (previous - current) / previous : 0;

    const incScore = 1.2 * growthSignal + 0.2 * weekendRatio - 0.08 * Math.max(0, stockRatio - 3);
    const decScore = 1.2 * decSignal + 0.1 * Math.max(0, stockRatio - 2);
    const stableScore = 0.5 - Math.abs(growthSignal) - Math.abs(decSignal) * 0.2;

    const candidates = [
        { direction: "increase", score: incScore },
        { direction: "decrease", score: decScore },
        { direction: "stable", score: stableScore },
    ].sort((a, b) => b.score - a.score);

    const winner = candidates[0];
    const runner = candidates[1];
    const confidence = clamp(sigmoid(winner.score - runner.score + 0.2), 0.45, 0.95);

    let reason = "past sales are steady";
    if (winner.direction === "increase") {
        reason = "trend: recent sales velocity is improving";
    } else if (winner.direction === "decrease") {
        reason = "trend: recent sales are softening";
    } else if (weekendRatio >= 0.5) {
        reason = "seasonality: sales are weekend-heavy";
    }

    return {
        direction: winner.direction,
        confidence,
        reason,
    };
}

module.exports = {
    predictDiscountPrice,
    predictDemandDirection,
};
