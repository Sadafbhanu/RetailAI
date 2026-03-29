const express = require('express');
const router = express.Router();
const {
    addProduct,
    getAllProducts,
    getAlerts,
    quickSellProduct,
    quickRestockProduct,
    uploadProducts,
} = require('../controllers/productController');

const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/multerMiddleware');

router.post('/', protect, addProduct);
router.get('/', protect, getAllProducts);
router.get('/alerts', protect, getAlerts);
router.post('/:id/sell', protect, quickSellProduct);
router.post('/:id/restock', protect, quickRestockProduct);
router.post('/upload', protect, upload.single('file'), uploadProducts);

module.exports = router;
