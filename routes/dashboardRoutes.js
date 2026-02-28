const express = require('express');
const { getDashboardSummary, getInsights, generateDescription, getLowStockProducts } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/summary',             protect, admin, getDashboardSummary);
router.get('/insights',            protect, admin, getInsights);
router.get('/low-stock',           protect, admin, getLowStockProducts);
router.post('/generate-description', protect, admin, generateDescription);

module.exports = router;
