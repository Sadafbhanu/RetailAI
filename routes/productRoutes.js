const express = require('express');
const router = express.Router();

const {
    addProduct,
    getAllProducts,
    getAlerts,
    quickSellProduct,
    quickRestockProduct,
    uploadProducts,
    updateMinThreshold,
    deleteProduct,
    getTransactions,
    getLeastSoldProducts,
    updateProductPrice,
} = require('../controllers/productController');

const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/multerMiddleware');

/* ==========================================
   PRODUCT ROUTES
========================================== */

// Add product
router.post('/', protect, addProduct);

// Get all products
router.get('/', protect, getAllProducts);

// Alerts (low stock + expiry)
router.get('/alerts', protect, getAlerts);

// Least sold items (for pricing / clearance)
router.get('/least-sold', protect, getLeastSoldProducts);

// Delete product
router.delete('/:id', protect, deleteProduct);


/* ==========================================
   TRANSACTION ROUTE (IMPORTANT)
========================================== */

// ✅ GET TRANSACTION HISTORY
router.get('/transactions', protect, getTransactions);


/* ==========================================
   ACTION ROUTES
========================================== */

// Sell product
router.post('/:id/sell', protect, quickSellProduct);

// Restock product
router.post('/:id/restock', protect, quickRestockProduct);

// Edit product min threshold
router.put('/:id/min-threshold', protect, updateMinThreshold);

// Update sale price (from clearance / discount flow)
router.put('/:id/price', protect, updateProductPrice);


/* ==========================================
   FILE UPLOAD
========================================== */

// Upload CSV
router.post('/upload', protect, upload.single('file'), uploadProducts);


module.exports = router;