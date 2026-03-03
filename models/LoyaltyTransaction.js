const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true },
    type: {
      type: String,
      enum: ['earned', 'redeemed', 'bonus', 'expired', 'referral'],
      required: true,
    },
    description: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

loyaltyTransactionSchema.index({ createdAt: -1 });

const LoyaltyTransaction = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
module.exports = LoyaltyTransaction;
