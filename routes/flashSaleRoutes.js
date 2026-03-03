const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const {
  subscribeRestock,
  unsubscribeRestock,
  searchSuggestions,
  getTrendingSearches,
  setBulkPricing,
} = require('../controllers/flashSaleController');

// Public
router.get('/suggestions', searchSuggestions);
router.get('/trending-searches', getTrendingSearches);

// Auth
router.post('/:id/restock/subscribe', protect, subscribeRestock);
router.delete('/:id/restock/subscribe', protect, unsubscribeRestock);

// Admin
router.put('/:id/bulk-pricing', protect, isAdmin, setBulkPricing);

module.exports = router;
