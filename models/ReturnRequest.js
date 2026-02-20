const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    image: { type: String },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    items: { type: [returnItemSchema], required: true, validate: v => v.length > 0 },
    reason: {
      type: String,
      enum: ['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'other'],
      required: true,
    },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'picked_up', 'refunded'],
      default: 'pending',
    },
    adminNote: { type: String, default: '' },
    refundAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);

module.exports = ReturnRequest;
