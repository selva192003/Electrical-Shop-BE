const express = require('express');
const { addReview, updateReview, deleteReview, adminReply, getMyReview, getProductReviews, checkEligibility } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Public: get all reviews for a product
router.get('/product/:productId', getProductReviews);

// Authenticated: get current user's review for a product
router.get('/product/:productId/my', protect, getMyReview);

// Authenticated: check if user is eligible to review (has a Delivered order for this product)
router.get('/product/:productId/eligibility', protect, checkEligibility);

// User review routes
router.post('/:productId', protect, addReview);
router.put('/:reviewId', protect, updateReview);
router.delete('/:reviewId', protect, deleteReview);

// Admin reply
router.post('/:reviewId/reply', protect, admin, adminReply);

module.exports = router;
