const express = require('express');
const router = express.Router();
const { getInsights } = require('../controllers/insightsController.js');
const { protect } = require('../middleware/authMiddleware.js');

router.get('/', protect, getInsights);

module.exports = router;