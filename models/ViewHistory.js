const mongoose = require('mongoose');

const viewHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    viewCount: { type: Number, default: 1 },
    lastViewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

viewHistorySchema.index({ user: 1, product: 1 }, { unique: true });
viewHistorySchema.index({ lastViewedAt: -1 });

const ViewHistory = mongoose.model('ViewHistory', viewHistorySchema);
module.exports = ViewHistory;
