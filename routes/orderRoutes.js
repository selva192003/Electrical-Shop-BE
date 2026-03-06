const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  requestCancelOtp,
  verifyCancelOtp,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/:id', getOrderById);
router.post('/:id/cancel/request-otp', requestCancelOtp);
router.post('/:id/cancel/verify-otp',  verifyCancelOtp);
router.patch('/:id/cancel', cancelOrder);

// Admin
router.get('/', admin, getAllOrders);
router.patch('/:id/status', admin, updateOrderStatus);

module.exports = router;
