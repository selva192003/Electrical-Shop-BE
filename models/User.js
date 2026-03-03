const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 6 },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    addresses: [addressSchema],
    isBlocked: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // Profile enhancements
    profileImage: { type: String, default: '' },
    phone: { type: String, default: '' },
    // Security
    loginAttempts: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    lockUntil: { type: Date },
    // Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    // Wishlist (stored as array of product refs for quick access)
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    // Loyalty & Rewards
    loyaltyPoints: { type: Number, default: 0 },
    totalPointsEarned: { type: Number, default: 0 },
    loyaltyTier: {
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
      default: 'Bronze',
    },
    // Referral Program
    referralCode: { type: String, unique: true, sparse: true, uppercase: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    referralRewardClaimed: { type: Boolean, default: false },
    // B2B / Business
    isBusinessAccount: { type: Boolean, default: false },
    businessName: { type: String, default: '' },
    gstin: { type: String, default: '', uppercase: true },
    businessType: {
      type: String,
      enum: ['Contractor', 'Electrician', 'Builder', 'Developer', 'Retailer', 'Other', ''],
      default: '',
    },
    // Notification preferences
    notificationPrefs: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      restockAlerts: { type: Boolean, default: true },
      warrantyReminders: { type: Boolean, default: true },
      loyaltyUpdates: { type: Boolean, default: true },
    },
    // Dark mode pref stored server-side
    darkMode: { type: Boolean, default: false },
    // Last activity
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Increment failed logins and lock after 5 attempts
userSchema.methods.incLoginAttempts = async function () {
  // if previous lock has expired, reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1, isLocked: false }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { isLocked: true, lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  return this.updateOne(updates);
};

// Reset attempts on successful login
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $set: { loginAttempts: 0, isLocked: false }, $unset: { lockUntil: 1 } });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
