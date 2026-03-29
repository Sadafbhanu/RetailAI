// utils/expiry.js

const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) {
        return 'Safe';
    }

    const now = new Date();
    const expiry = new Date(expiryDate);

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    if (expiry < now) return 'Expired';
    if (expiry <= threeDaysFromNow) return 'Warning';
    return 'Safe';
};

module.exports = { getExpiryStatus };