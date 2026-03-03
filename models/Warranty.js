const mongoose = require('mongoose');

const warrantySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    productName: { type: String, required: true },
    productImage: { type: String, default: '' },
    purchaseDate: { type: Date, required: true },
    warrantyMonths: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'claimed'],
      default: 'active',
    },
    claimDetails: { type: String, default: '' },
    claimedAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

warrantySchema.index({ expiryDate: 1 });

const Warranty = mongoose.model('Warranty', warrantySchema);
module.exports = Warranty;
