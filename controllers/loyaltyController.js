const User = require('../models/User');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');

// Points per ₹10 spent
const POINTS_PER_10_RUPEES = 1;
// Tier thresholds (cumulative points earned)
const TIERS = [
  { name: 'Platinum', min: 5000 },
  { name: 'Gold', min: 2000 },
  { name: 'Silver', min: 500 },
  { name: 'Bronze', min: 0 },
];

const getTier = (totalPoints) => {
  for (const tier of TIERS) {
    if (totalPoints >= tier.min) return tier.name;
  }
  return 'Bronze';
};

// Award points for a delivered order
exports.awardPointsForOrder = async (userId, orderId, orderTotal) => {
  try {
    const pointsEarned = Math.floor(orderTotal / 10) * POINTS_PER_10_RUPEES;
    if (pointsEarned <= 0) return;

    const user = await User.findById(userId);
    if (!user) return;

    user.loyaltyPoints += pointsEarned;
    user.totalPointsEarned += pointsEarned;
    user.loyaltyTier = getTier(user.totalPointsEarned);
    await user.save();

    await LoyaltyTransaction.create({
      user: userId,
      points: pointsEarned,
      type: 'earned',
      description: `Earned for order #${String(orderId).slice(-8).toUpperCase()}`,
      orderId,
      balanceAfter: user.loyaltyPoints,
    });

    // Send loyalty email notification if user prefers
    if (user.notificationPrefs?.loyaltyUpdates) {
      const tierMsg =
        user.loyaltyTier !== 'Bronze'
          ? ` You've reached ${user.loyaltyTier} tier! 🎉`
          : '';
      await sendEmail({
        to: user.email,
        subject: `You earned ${pointsEarned} loyalty points! ⚡`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #003566;">You earned ${pointsEarned} loyalty points!</h2>
            <p>Your order has been delivered. You earned <strong>${pointsEarned} points</strong> (₹${orderTotal.toFixed(2)} × 1 pt/₹10).</p>
            <p>Total balance: <strong>${user.loyaltyPoints} points</strong>${tierMsg}</p>
            <p>Redeem 100 points = ₹10 discount on your next order.</p>
            <hr/>
            <p style="font-size: 12px; color: #888;">Electrical Shop Loyalty Program</p>
          </div>
        `,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('LoyaltyController.awardPointsForOrder error:', err.message);
  }
};

// Get loyalty info for logged-in user
exports.getLoyaltyInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'loyaltyPoints totalPointsEarned loyaltyTier name'
    );

    const transactions = await LoyaltyTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    // Next tier info
    const currentTierIndex = TIERS.findIndex((t) => t.name === user.loyaltyTier);
    const nextTier = currentTierIndex > 0 ? TIERS[currentTierIndex - 1] : null;
    const pointsToNextTier = nextTier ? nextTier.min - user.totalPointsEarned : 0;

    return res.json({
      loyaltyPoints: user.loyaltyPoints,
      totalPointsEarned: user.totalPointsEarned,
      loyaltyTier: user.loyaltyTier,
      transactions,
      nextTier: nextTier?.name || null,
      pointsToNextTier: Math.max(0, pointsToNextTier),
      redemptionValue: Math.floor(user.loyaltyPoints / 100) * 10,
      // 100 pts = ₹10
    });
  } catch (error) {
    next(error);
  }
};

// Redeem points at checkout — returns discount amount
exports.redeemPoints = async (req, res, next) => {
  try {
    const { pointsToRedeem } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (pointsToRedeem > user.loyaltyPoints) {
      return res.status(400).json({ message: 'Insufficient loyalty points' });
    }
    if (pointsToRedeem <= 0) {
      return res.status(400).json({ message: 'Points must be greater than 0' });
    }
    // Must redeem in multiples of 100
    if (pointsToRedeem % 100 !== 0) {
      return res.status(400).json({ message: 'Points must be redeemed in multiples of 100' });
    }

    const discountAmount = (pointsToRedeem / 100) * 10;

    user.loyaltyPoints -= pointsToRedeem;
    await user.save();

    await LoyaltyTransaction.create({
      user: user._id,
      points: -pointsToRedeem,
      type: 'redeemed',
      description: `Redeemed ${pointsToRedeem} points for ₹${discountAmount} discount`,
      balanceAfter: user.loyaltyPoints,
    });

    return res.json({
      message: `Successfully redeemed ${pointsToRedeem} points`,
      discountAmount,
      remainingPoints: user.loyaltyPoints,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: award bonus points to a user
exports.awardBonusPoints = async (req, res, next) => {
  try {
    const { userId, points, reason } = req.body;

    if (!userId || !points || points <= 0) {
      return res.status(400).json({ message: 'userId and positive points are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.loyaltyPoints += points;
    user.totalPointsEarned += points;
    user.loyaltyTier = getTier(user.totalPointsEarned);
    await user.save();

    await LoyaltyTransaction.create({
      user: userId,
      points,
      type: 'bonus',
      description: reason || 'Admin bonus points',
      balanceAfter: user.loyaltyPoints,
    });

    return res.json({
      message: `Awarded ${points} bonus points to ${user.name}`,
      loyaltyPoints: user.loyaltyPoints,
      loyaltyTier: user.loyaltyTier,
    });
  } catch (error) {
    next(error);
  }
};

// Generate referral code for user if they don't have one
exports.getReferralInfo = async (req, res, next) => {
  try {
    let user = await User.findById(req.user._id).select(
      'referralCode referralCount loyaltyPoints name email'
    );

    if (!user.referralCode) {
      // Generate a unique referral code
      const crypto = require('crypto');
      let code;
      let isUnique = false;
      while (!isUnique) {
        code = 'ELEC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const existing = await User.findOne({ referralCode: code });
        if (!existing) isUnique = true;
      }
      user.referralCode = code;
      await user.save();
    }

    const referralLink = `${process.env.CLIENT_URL}/register?ref=${user.referralCode}`;

    return res.json({
      referralCode: user.referralCode,
      referralLink,
      referralCount: user.referralCount,
      rewardPerReferral: 100, // points
    });
  } catch (error) {
    next(error);
  }
};

// Apply referral code during registration (called from userController)
exports.applyReferral = async (referralCode, newUserId) => {
  try {
    if (!referralCode) return;

    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    if (!referrer || referrer._id.toString() === newUserId.toString()) return;

    // Update new user
    await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });

    // Award referrer 100 bonus points
    referrer.loyaltyPoints += 100;
    referrer.totalPointsEarned += 100;
    referrer.referralCount += 1;
    referrer.loyaltyTier = getTier(referrer.totalPointsEarned);
    await referrer.save();

    await LoyaltyTransaction.create({
      user: referrer._id,
      points: 100,
      type: 'referral',
      description: 'Earned for referring a new user',
      balanceAfter: referrer.loyaltyPoints,
    });
  } catch (err) {
    console.error('applyReferral error:', err.message);
  }
};
