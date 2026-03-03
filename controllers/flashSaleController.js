const Product = require('../models/Product');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');

// Subscribe to restock notification
exports.subscribeRestock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.stock > 0) {
      return res.status(400).json({ message: 'Product is currently in stock' });
    }

    const alreadySubscribed = product.restockSubscribers?.some(
      (s) => s.user.toString() === req.user._id.toString()
    );

    if (alreadySubscribed) {
      return res.status(400).json({ message: 'Already subscribed to restock notification' });
    }

    if (!product.restockSubscribers) product.restockSubscribers = [];
    product.restockSubscribers.push({ user: req.user._id, subscribedAt: new Date(), notified: false });
    await product.save();

    return res.json({ message: 'You will be notified when this product is back in stock' });
  } catch (error) {
    next(error);
  }
};

// Unsubscribe from restock notification
exports.unsubscribeRestock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.restockSubscribers = (product.restockSubscribers || []).filter(
      (s) => s.user.toString() !== req.user._id.toString()
    );
    await product.save();

    return res.json({ message: 'Unsubscribed from restock notification' });
  } catch (error) {
    next(error);
  }
};

// Trigger restock notifications (called from productController when stock updated > 0)
exports.notifyRestockSubscribers = async (product) => {
  try {
    const unnotified = (product.restockSubscribers || []).filter((s) => !s.notified);
    if (unnotified.length === 0) return;

    const userIds = unnotified.map((s) => s.user);
    const users = await User.find({ _id: { $in: userIds } }).select('email name');

    for (const user of users) {
      await sendEmail({
        to: user.email,
        subject: `"${product.name}" is back in stock! ⚡`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #003566;">Great news, ${user.name}!</h2>
            <p><strong>${product.name}</strong> is back in stock.</p>
            <p>Hurry — stocks are limited!</p>
            <a href="${process.env.CLIENT_URL}/products/${product._id}" 
               style="background: #003566; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 12px;">
              Shop Now
            </a>
            <hr style="margin-top: 24px;"/>
            <p style="font-size: 12px; color: #888;">Electrical Shop — Restock Alert</p>
          </div>
        `,
      }).catch(() => {});
    }

    // Mark all as notified
    product.restockSubscribers = product.restockSubscribers.map((s) => ({ ...s.toObject(), notified: true }));
    await product.save();
  } catch (err) {
    console.error('notifyRestockSubscribers error:', err.message);
  }
};

// Autocomplete search suggestions
exports.searchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ products: [], categories: [], brands: [] });

    const SearchLog = require('../models/SearchLog');
    const Category = require('../models/Category');

    const searchRegex = new RegExp(q.trim(), 'i');

    const [products, categories, brands] = await Promise.all([
      Product.find({ isActive: true, name: searchRegex })
        .select('name images price brand')
        .limit(5),
      Category.find({ name: searchRegex }).select('name slug').limit(3),
      Product.distinct('brand', { isActive: true, brand: searchRegex }),
    ]);

    // Log search query
    SearchLog.findOneAndUpdate(
      { query: q.trim().toLowerCase() },
      {
        $inc: { count: 1 },
        $set: { lastSearchedAt: new Date(), hasResults: products.length > 0, resultCount: products.length },
      },
      { upsert: true }
    ).catch(() => {});

    return res.json({ products, categories, brands: brands.slice(0, 3) });
  } catch (error) {
    next(error);
  }
};

// Get trending searches
exports.getTrendingSearches = async (req, res, next) => {
  try {
    const SearchLog = require('../models/SearchLog');
    const trending = await SearchLog.find({ hasResults: true })
      .sort({ count: -1, lastSearchedAt: -1 })
      .limit(10)
      .select('query count');
    return res.json(trending);
  } catch (error) {
    next(error);
  }
};

// Admin: set bulk pricing for a product
exports.setBulkPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bulkPricing } = req.body;

    if (!Array.isArray(bulkPricing)) {
      return res.status(400).json({ message: 'bulkPricing must be an array' });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.bulkPricing = bulkPricing;
    await product.save();

    return res.json({ message: 'Bulk pricing updated', bulkPricing: product.bulkPricing });
  } catch (error) {
    next(error);
  }
};
