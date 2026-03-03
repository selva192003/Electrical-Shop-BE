const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    answer: { type: String, required: true, trim: true },
    isAdmin: { type: Boolean, default: false },
    isVerifiedBuyer: { type: Boolean, default: false },
    helpfulVotes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const qnaSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    question: { type: String, required: true, trim: true },
    answers: [answerSchema],
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    upvoteCount: { type: Number, default: 0 },
    isAnswered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

qnaSchema.index({ product: 1, upvoteCount: -1 });

const QnA = mongoose.model('QnA', qnaSchema);
module.exports = QnA;
