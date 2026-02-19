const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Helper to recalculate product rating and numReviews
const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  const product = await Product.findById(productId);
  if (!product) return;

  if (stats.length > 0) {
    product.ratings = stats[0].avgRating;
    product.numReviews = stats[0].numReviews;
  } else {
    product.ratings = 0;
    product.numReviews = 0;
  }

  await product.save();
};

// Add a product review (only if purchased)
exports.addReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    if (!rating) {
      return res.status(400).json({ message: 'Rating is required' });
    }

    const hasOrdered = await Order.exists({
      user: req.user._id,
      'orderItems.product': productId,
      orderStatus: { $ne: 'Cancelled' },
    });

    if (!hasOrdered) {
      return res.status(403).json({ message: 'You can review only after purchasing this product' });
    }

    let review = await Review.findOne({ user: req.user._id, product: productId });

    if (review) {
      review.rating = rating;
      review.comment = comment;
      await review.save();
    } else {
      review = await Review.create({
        user: req.user._id,
        product: productId,
        rating,
        comment,
      });
    }

    await updateProductRating(productId);

    return res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

// Edit review
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

    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await review.save();
    await updateProductRating(review.product);

    return res.json(review);
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

    return res.json({ message: 'Review deleted successfully' });
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
