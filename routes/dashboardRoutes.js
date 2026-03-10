const express = require('express');
const { getDashboardSummary, getInsights, generateDescription, getLowStockProducts, getLowStockCount } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/summary',             protect, admin, getDashboardSummary);
router.get('/insights',            protect, admin, getInsights);
router.get('/low-stock',           protect, admin, getLowStockProducts);
router.get('/low-stock-count',     protect, admin, getLowStockCount);
router.post('/generate-description', protect, admin, generateDescription);

module.exports = router;
