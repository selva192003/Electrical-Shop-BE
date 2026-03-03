const Product = require('../models/Product');
const ViewHistory = require('../models/ViewHistory');

// Track product view (guest or logged-in)
exports.trackView = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (req.user) {
      await ViewHistory.findOneAndUpdate(
        { user: req.user._id, product: productId },
        {
          $inc: { viewCount: 1 },
          $set: { lastViewedAt: new Date() },
          $setOnInsert: { category: req.body.categoryId },
        },
        { upsert: true, new: true }
      );
    }

    return res.json({ tracked: true });
  } catch (error) {
    next(error);
  }
};

// Get personalized recommendations for logged-in user
exports.getRecommendations = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 8;

    if (!req.user) {
      // Fallback: return featured products for guests
      const featured = await Product.find({ isActive: true, featured: true })
        .populate('category', 'name slug')
        .limit(limit)
        .sort({ ratings: -1 });
      return res.json(featured);
    }

    // Get the categories this user browses most
    const viewData = await ViewHistory.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$category', totalViews: { $sum: '$viewCount' }, products: { $addToSet: '$product' } } },
      { $sort: { totalViews: -1 } },
      { $limit: 3 },
    ]);

    const viewedProductIds = await ViewHistory.distinct('product', { user: req.user._id });

    if (viewData.length === 0) {
      // No history: return top-rated products
      const topRated = await Product.find({ isActive: true, _id: { $nin: viewedProductIds } })
        .populate('category', 'name slug')
        .sort({ ratings: -1, numReviews: -1 })
        .limit(limit);
      return res.json(topRated);
    }

    const topCategoryIds = viewData.map((d) => d._id).filter(Boolean);

    const recommended = await Product.find({
      isActive: true,
      category: { $in: topCategoryIds },
      _id: { $nin: viewedProductIds },
    })
      .populate('category', 'name slug')
      .sort({ ratings: -1, numReviews: -1 })
      .limit(limit);

    // If not enough from preferred categories, fill with popular products
    if (recommended.length < limit) {
      const needed = limit - recommended.length;
      const existingIds = [...viewedProductIds, ...recommended.map((p) => p._id)];

      const fillers = await Product.find({
        isActive: true,
        _id: { $nin: existingIds },
      })
        .populate('category', 'name slug')
        .sort({ ratings: -1 })
        .limit(needed);

      return res.json([...recommended, ...fillers]);
    }

    return res.json(recommended);
  } catch (error) {
    next(error);
  }
};

// Get "Frequently Bought Together" for a specific product
exports.getFrequentlyBoughtTogether = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const Order = require('../models/Order');

    // Find orders that contain this product
    const ordersWithProduct = await Order.find(
      { 'orderItems.product': productId, orderStatus: 'Delivered' },
      { 'orderItems.product': 1 }
    ).limit(200);

    // Count co-occurrences
    const coOccurrences = {};
    for (const order of ordersWithProduct) {
      for (const item of order.orderItems) {
        const pid = item.product.toString();
        if (pid !== productId) {
          coOccurrences[pid] = (coOccurrences[pid] || 0) + 1;
        }
      }
    }

    const topIds = Object.entries(coOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => id);

    if (topIds.length === 0) {
      // Fallback: same category
      const product = await Product.findById(productId);
      const related = await Product.find({
        isActive: true,
        category: product?.category,
        _id: { $ne: productId },
      })
        .limit(4)
        .sort({ ratings: -1 });
      return res.json(related);
    }

    const products = await Product.find({ _id: { $in: topIds }, isActive: true })
      .populate('category', 'name slug');

    return res.json(products);
  } catch (error) {
    next(error);
  }
};

// Get user's recently viewed products
exports.getRecentlyViewed = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const history = await ViewHistory.find({ user: req.user._id })
      .populate({ path: 'product', populate: { path: 'category', select: 'name slug' } })
      .sort({ lastViewedAt: -1 })
      .limit(limit);

    const products = history
      .filter((h) => h.product && h.product.isActive)
      .map((h) => h.product);

    return res.json(products);
  } catch (error) {
    next(error);
  }
};

// Get trending/popular products based on recent views
exports.getTrendingProducts = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const trending = await ViewHistory.aggregate([
      { $match: { lastViewedAt: { $gte: since } } },
      { $group: { _id: '$product', totalViews: { $sum: '$viewCount' } } },
      { $sort: { totalViews: -1 } },
      { $limit: limit },
    ]);

    const ids = trending.map((t) => t._id);

    const products = await Product.find({ _id: { $in: ids }, isActive: true })
      .populate('category', 'name slug');

    // Preserve trending order
    const ordered = ids
      .map((id) => products.find((p) => p._id.toString() === id.toString()))
      .filter(Boolean);

    return res.json(ordered);
  } catch (error) {
    next(error);
  }
};
