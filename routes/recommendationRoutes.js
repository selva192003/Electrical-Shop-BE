const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const {
  trackView,
  getRecommendations,
  getFrequentlyBoughtTogether,
  getRecentlyViewed,
  getTrendingProducts,
} = require('../controllers/recommendationController');

// Public
router.get('/trending', getTrendingProducts);
router.get('/frequently-bought-together/:productId', getFrequentlyBoughtTogether);

// Auth required
router.get('/for-you', protect, getRecommendations);
router.get('/recently-viewed', protect, getRecentlyViewed);
router.post('/track/:productId', protect, trackView);

module.exports = router;
