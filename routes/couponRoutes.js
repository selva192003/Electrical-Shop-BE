const express = require('express');
const {
  validateCoupon,
  applyCoupon,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/couponController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect);

// User routes
router.post('/validate', validateCoupon);
router.post('/apply', applyCoupon);

// Admin routes
router.get('/', admin, getAllCoupons);
router.post('/', admin, createCoupon);
router.put('/:id', admin, updateCoupon);
router.delete('/:id', admin, deleteCoupon);

module.exports = router;
