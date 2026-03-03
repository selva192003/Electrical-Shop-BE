const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const {
  getLoyaltyInfo,
  redeemPoints,
  awardBonusPoints,
  getReferralInfo,
} = require('../controllers/loyaltyController');

router.get('/my', protect, getLoyaltyInfo);
router.post('/redeem', protect, redeemPoints);
router.get('/referral', protect, getReferralInfo);
router.post('/admin/award', protect, isAdmin, awardBonusPoints);

module.exports = router;
