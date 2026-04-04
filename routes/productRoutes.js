const express = require('express');
const router = express.Router();

const {
    addProduct,
    getAllProducts,
    getAlerts,
    quickSellProduct,
    quickRestockProduct,
    uploadProducts,
    deleteProduct,
    getTransactions   // ✅ ADD THIS
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


/* ==========================================
   FILE UPLOAD
========================================== */

// Upload CSV
router.post('/upload', protect, upload.single('file'), uploadProducts);


module.exports = router;