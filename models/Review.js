const mongoose = require('mongoose');

const adminReplySchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
    adminReply: adminReplySchema,
    // Media attachments
    images: [
      {
        public_id: { type: String, default: '' },
        url: { type: String, required: true },
      },
    ],
    video: {
      public_id: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    // Trust
    isVerifiedPurchase: { type: Boolean, default: false },
    // Helpfulness
    helpfulVotes: { type: Number, default: 0 },
    notHelpfulVotes: { type: Number, default: 0 },
    votedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        vote: { type: String, enum: ['helpful', 'not_helpful'] },
      },
    ],
    // Moderation
    isApproved: { type: Boolean, default: true },
    isFlagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
