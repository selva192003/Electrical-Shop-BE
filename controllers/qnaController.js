const QnA = require('../models/QnA');
const Order = require('../models/Order');

// Get all Q&A for a product
exports.getProductQnA = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [qnas, total] = await Promise.all([
      QnA.find({ product: productId })
        .populate('user', 'name profileImage')
        .populate('answers.user', 'name profileImage role')
        .sort({ upvoteCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      QnA.countDocuments({ product: productId }),
    ]);

    return res.json({ qnas, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// Ask a question
exports.askQuestion = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { question } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ message: 'Question text is required' });
    }

    const qna = await QnA.create({
      product: productId,
      user: req.user._id,
      userName: req.user.name,
      question: question.trim(),
    });

    return res.status(201).json(qna);
  } catch (error) {
    next(error);
  }
};

// Answer a question (admin or verified buyer)
exports.answerQuestion = async (req, res, next) => {
  try {
    const { qnaId } = req.params;
    const { answer } = req.body;

    if (!answer?.trim()) {
      return res.status(400).json({ message: 'Answer text is required' });
    }

    const qna = await QnA.findById(qnaId);
    if (!qna) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is verified buyer for this product
    const isVerifiedBuyer = req.user.role !== 'admin'
      ? await Order.exists({
          user: req.user._id,
          'orderItems.product': qna.product,
          orderStatus: 'Delivered',
        })
      : false;

    qna.answers.push({
      user: req.user._id,
      userName: req.user.name,
      answer: answer.trim(),
      isAdmin: req.user.role === 'admin',
      isVerifiedBuyer: !!isVerifiedBuyer,
    });

    qna.isAnswered = true;
    await qna.save();

    const updated = await QnA.findById(qnaId)
      .populate('user', 'name profileImage')
      .populate('answers.user', 'name profileImage role');

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Upvote a question
exports.upvoteQuestion = async (req, res, next) => {
  try {
    const { qnaId } = req.params;
    const qna = await QnA.findById(qnaId);

    if (!qna) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const userId = req.user._id.toString();
    const alreadyUpvoted = qna.upvotes.some((id) => id.toString() === userId);

    if (alreadyUpvoted) {
      qna.upvotes = qna.upvotes.filter((id) => id.toString() !== userId);
      qna.upvoteCount = Math.max(0, qna.upvoteCount - 1);
    } else {
      qna.upvotes.push(req.user._id);
      qna.upvoteCount += 1;
    }

    await qna.save();
    return res.json({ upvoteCount: qna.upvoteCount, upvoted: !alreadyUpvoted });
  } catch (error) {
    next(error);
  }
};

// Delete a question (owner or admin)
exports.deleteQuestion = async (req, res, next) => {
  try {
    const { qnaId } = req.params;
    const qna = await QnA.findById(qnaId);

    if (!qna) return res.status(404).json({ message: 'Question not found' });

    const isOwner = qna.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }

    await qna.deleteOne();
    return res.json({ message: 'Question deleted' });
  } catch (error) {
    next(error);
  }
};
