const express = require('express');
const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  uploadProfileImage,
  sendChangePasswordOtp,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyEmail,
  resendVerification,
  getAllUsers,
  blockUser,
  unblockUser,
  googleLogin,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/google-login', googleLogin);

// Authenticated user profile
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/profile/image', protect, upload.single('image'), uploadProfileImage);
router.post('/change-password-otp', protect, sendChangePasswordOtp);
router.put('/change-password', protect, changePassword);

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
