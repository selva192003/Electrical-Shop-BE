const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Helper: recalculate product ratings from all reviews and persist.
// IMPORTANT: Mongoose aggregate() bypasses schema casting, so productId
// MUST be cast to ObjectId explicitly — otherwise $match never hits anything
// and ratings get reset to 0 on every write.
const updateProductRating = async (productId) => {
  const oid = new mongoose.Types.ObjectId(String(productId));

  const stats = await Review.aggregate([
    { $match: { product: oid } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  await Product.findByIdAndUpdate(
    productId,
    stats.length > 0
      ? { ratings: Math.round(stats[0].avgRating * 10) / 10, numReviews: stats[0].numReviews }
      : { ratings: 0, numReviews: 0 },
    { new: false }
  );
};

// Helper: return the updated ratings payload for frontend caching
const getRatingsPayload = async (productId) => {
  const p = await Product.findById(productId).select('ratings numReviews').lean();
  return {
    productId: String(productId),
    ratings:    p?.ratings    ?? 0,
    numReviews: p?.numReviews ?? 0,
  };
};

// Add or update a product review (only if the order is Delivered)
exports.addReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Only allow reviews for products the user has actually received
    const hasDelivered = await Order.exists({
      user: req.user._id,
      'orderItems.product': productId,
      orderStatus: 'Delivered',
    });

    if (!hasDelivered) {
      return res.status(403).json({
        message: 'You can only review a product after it has been delivered',
      });
    }

    let review = await Review.findOne({ user: req.user._id, product: productId });
    let isNew = false;

    if (review) {
      // Update existing review (handles re-purchases: user may update any time)
      review.rating  = ratingNum;
      review.comment = comment?.trim() || '';
      await review.save();
    } else {
      review = await Review.create({
        user:    req.user._id,
        product: productId,
        rating:  ratingNum,
        comment: comment?.trim() || '',
      });
      isNew = true;
    }

    await updateProductRating(productId);
    const updatedRatings = await getRatingsPayload(productId);

    return res.status(isNew ? 201 : 200).json({ review, updatedRatings });
  } catch (error) {
    next(error);
  }
};

// Edit review (standalone, e.g. from product page)
exports.updateReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }

    const ratingNum = Number(rating);
    if (rating !== undefined) {
      if (ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      review.rating = ratingNum;
    }
    if (comment !== undefined) review.comment = comment?.trim() || '';

    await review.save();
    await updateProductRating(review.product);
    const updatedRatings = await getRatingsPayload(review.product);

    return res.json({ review, updatedRatings });
  } catch (error) {
    next(error);
  }
};

// Delete review
exports.deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    const productId = review.product;
    await review.deleteOne();
    await updateProductRating(productId);
    const updatedRatings = await getRatingsPayload(productId);

    return res.json({ message: 'Review deleted successfully', updatedRatings });
  } catch (error) {
    next(error);
  }
};

// Get all reviews for a product (public)
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(reviews);
  } catch (error) {
    next(error);
  }
};

// Get current user's own review for a product
exports.getMyReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const review = await Review.findOne({ user: req.user._id, product: productId }).lean();
    if (!review) return res.status(404).json({ message: 'No review found' });
    return res.json(review);
  } catch (error) {
    next(error);
  }
};

// Admin reply to review
exports.adminReply = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { message } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.adminReply = {
      admin: req.user._id,
      message,
      createdAt: new Date(),
    };

    await review.save();

    return res.json(review);
  } catch (error) {
    next(error);
  }
};
