/**
 * Estimated clearance price using a small interpretable model (feature blend).
 * Suitable as a stand-in until you plug in a trained regressor / churn model.
 *
 * Features: sales velocity in window, days-to-expiry urgency, stock vs min threshold.
 */

function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}

/**
 * @param {object} opts
 * @param {number} opts.price - current list price
 * @param {number} [opts.costPrice] - unit cost (defaults to 70% of price)
 * @param {number} opts.quantity - on-hand qty
 * @param {number} opts.minThreshold
 * @param {Date|string|null} opts.expiryDate
 * @param {number} opts.soldQtyInWindow - units sold in lookback window
 * @param {number} opts.windowDays - lookback length (e.g. 30)
 * @returns {number} suggested discounted selling price (2 decimals)
 */
function estimateDiscountedPrice(opts) {
    const {
        price,
        costPrice,
        quantity,
        minThreshold,
        expiryDate,
        soldQtyInWindow = 0,
        windowDays = 30,
    } = opts;

    const listPrice = Number(price) || 0;
    if (listPrice <= 0) return 0;

    const cost = Number(costPrice) > 0 ? Number(costPrice) : listPrice * 0.7;

    const maxRefSales = Math.max(5, windowDays * 0.35);
    const velocityScore = 1 - clamp((Number(soldQtyInWindow) || 0) / maxRefSales, 0, 1);

    let expiryUrgency = 0.12;
    if (expiryDate) {
        const d = new Date(expiryDate);
        d.setHours(0, 0, 0, 0);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        const daysLeft = (d - t) / 86400000;
        if (daysLeft < 0) expiryUrgency = 1;
        else if (daysLeft <= 3) expiryUrgency = 0.9;
        else if (daysLeft <= 7) expiryUrgency = 0.65;
        else if (daysLeft <= 14) expiryUrgency = 0.45;
        else if (daysLeft <= 30) expiryUrgency = 0.28;
        else expiryUrgency = 0.12;
    }

    const minT = Math.max(1, Number(minThreshold) || 5);
    const stockPressure = clamp((Number(quantity) || 0) / (2 * minT), 0, 1);

    const discountPct = clamp(
        0.06 + 0.24 * velocityScore + 0.28 * expiryUrgency + 0.1 * stockPressure,
        0.05,
        0.42
    );

    const raw = listPrice * (1 - discountPct);
    const floor = Math.max(cost * 1.02, listPrice * 0.52);
    const suggested = Math.max(floor, raw);
    return Math.round(suggested * 100) / 100;
}

module.exports = { estimateDiscountedPrice };
