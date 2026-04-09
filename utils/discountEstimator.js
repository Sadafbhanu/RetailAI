const { predictDiscountPrice } = require('./mlRecommender');

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
    return predictDiscountPrice(opts).suggestedPrice;
}

module.exports = { estimateDiscountedPrice };
