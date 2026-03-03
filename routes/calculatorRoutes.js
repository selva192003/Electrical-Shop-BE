const express = require('express');
const {
  matchProducts,
  addCalculatorToCart,
  saveCalculatorAsProject,
} = require('../controllers/calculatorController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — no auth needed to get product matches (unregistered users can still see what's available)
router.post('/match-products', matchProducts);

// Protected — requires login
router.post('/add-to-cart', protect, addCalculatorToCart);
router.post('/save-as-project', protect, saveCalculatorAsProject);

module.exports = router;
