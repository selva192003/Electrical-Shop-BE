const express = require('express');
const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  forgotPassword,
  resetPassword,
  getAllUsers,
  blockUser,
  unblockUser,
  googleLogin,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Public
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/google-login', googleLogin);

// Authenticated user profile
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

// Address management
router.get('/addresses', protect, getAddresses);
router.post('/addresses', protect, addAddress);
router.put('/addresses/:addressId', protect, updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);
router.patch('/addresses/:addressId/default', protect, setDefaultAddress);

// Admin user management
router.get('/', protect, admin, getAllUsers);
router.patch('/:id/block', protect, admin, blockUser);
router.patch('/:id/unblock', protect, admin, unblockUser);

module.exports = router;
