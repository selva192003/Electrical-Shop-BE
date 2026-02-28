const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// Dashboard analytics summary
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProducts,
      revenueStats,
      monthlySales,
      topProductsRaw,
      statusBreakdown,
      pendingOrders,
      lowStock,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments({ isActive: { $ne: false } }),
      Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } },
      ]),
      Order.aggregate([
        { $match: { isPaid: true } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            totalSales: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 },
      ]),
      Order.aggregate([
        { $match: { isPaid: true } },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.product',
            name: { $first: '$orderItems.name' },
            totalQuantity: { $sum: '$orderItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ orderStatus: 'Pending' }),
      Product.countDocuments({ stock: { $gt: 0, $lte: 5 } }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email')
        .select('_id totalPrice orderStatus isPaid createdAt user'),
    ]);

    const totalRevenue = revenueStats[0]?.totalRevenue || 0;
    const totalOrders = statusBreakdown.reduce((acc, o) => acc + o.count, 0);

    return res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      lowStock,
      monthlySales,
      topProducts: topProductsRaw,
      orderStatusBreakdown: statusBreakdown,
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
};

// ── AI Insights ────────────────────────────────────────────────────────────────

exports.getInsights = async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const lastWeekSameDay    = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekSameDayEnd = new Date(lastWeekSameDay.getTime() + 24 * 60 * 60 * 1000);

    const [
      salesVelocityRaw,
      allActiveProducts,
      soldInLast30,
      todayRevenueAgg,
      lastWeekRevenueAgg,
      couponPerformance,
    ] = await Promise.all([
      // Units sold per product in last 30 days
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.product',
            name:     { $first: '$orderItems.name' },
            totalQty: { $sum: '$orderItems.quantity' },
            revenue:  { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } },
          },
        },
      ]),

      // All active products with stock info
      Product.find({ isActive: true }).select('name stock brand category').lean(),

      // Product IDs that had at least one sale in last 30 days (for dead-stock detection)
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$orderItems' },
        { $group: { _id: '$orderItems.product' } },
      ]),

      // Today's revenue
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),

      // Same weekday last week revenue
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: lastWeekSameDay, $lt: lastWeekSameDayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),

      // Coupon performance: usedCount, avg discount, revenue linked to orders that used a coupon
      Coupon.find({ usedCount: { $gt: 0 } })
        .select('code discountType discountValue usedCount usageLimit expiresAt isActive createdAt')
        .sort({ usedCount: -1 })
        .limit(10)
        .lean(),
    ]);

    // ── Restock Predictions ──
    const salesMap = {};
    salesVelocityRaw.forEach((s) => {
      salesMap[String(s._id)] = {
        name:      s.name,
        totalQty:  s.totalQty,
        dailyRate: s.totalQty / 30,
        revenue:   s.revenue,
      };
    });

    const restockAlerts = allActiveProducts
      .map((p) => {
        const sales = salesMap[String(p._id)];
        if (!sales || sales.dailyRate === 0) return null;
        const daysRemaining = p.stock / sales.dailyRate;
        if (daysRemaining > 30) return null;
        return {
          productId:        p._id,
          name:             p.name,
          brand:            p.brand,
          stock:            p.stock,
          dailyRate:        Math.round(sales.dailyRate * 10) / 10,
          daysRemaining:    Math.round(daysRemaining),
          recommendedReorder: Math.ceil(sales.dailyRate * 45),
          urgency: daysRemaining <= 3 ? 'critical' : daysRemaining <= 7 ? 'high' : 'medium',
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    // ── Dead Stock Detector ──
    const soldIds = new Set(soldInLast30.map((d) => String(d._id)));
    const deadStock = allActiveProducts
      .filter((p) => !soldIds.has(String(p._id)) && p.stock > 0)
      .map((p) => ({
        productId: p._id,
        name:      p.name,
        brand:     p.brand,
        stock:     p.stock,
      }));

    // ── Revenue Anomaly Detection ──
    const todayTotal    = todayRevenueAgg[0]?.total    || 0;
    const lastWeekTotal = lastWeekRevenueAgg[0]?.total || 0;
    let anomaly = null;
    if (lastWeekTotal > 0) {
      const changePct = ((todayTotal - lastWeekTotal) / lastWeekTotal) * 100;
      if (Math.abs(changePct) >= 30) {
        anomaly = {
          type:          changePct < 0 ? 'drop' : 'spike',
          todayRevenue:  todayTotal,
          lastWeekRevenue: lastWeekTotal,
          changePercent: Math.round(changePct),
        };
      }
    }

    // ── Coupon Performance Scorer ──
    const coupons = couponPerformance.map((c) => {
      const usageRate = c.usageLimit ? Math.round((c.usedCount / c.usageLimit) * 100) : null;
      const revenuePerRedemption = salesVelocityRaw.reduce((acc, s) => acc + s.revenue, 0) / (c.usedCount || 1);
      const effectivenessScore   = Math.min(100, Math.round(
        (c.usedCount > 0 ? 40 : 0) +
        (usageRate !== null ? Math.min(40, usageRate * 0.4) : 20) +
        (c.isActive && new Date(c.expiresAt) > now ? 20 : 0)
      ));
      return {
        code:               c.code,
        discountType:       c.discountType,
        discountValue:      c.discountValue,
        usedCount:          c.usedCount,
        usageLimit:         c.usageLimit,
        usageRate,
        effectivenessScore,
        isActive:           c.isActive,
        expiresAt:          c.expiresAt,
      };
    });

    return res.json({ restockAlerts, deadStock, anomaly, coupons });
  } catch (err) {
    next(err);
  }
};

// ── Smart Description Generator (no external API needed) ────────────────────────

exports.generateDescription = async (req, res, next) => {
  try {
    const { name, brand, category, specs, price, stock } = req.body;

    const specEntries = specs && typeof specs === 'object' ? Object.entries(specs) : [];

    const specSentences = specEntries
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const stockNote =
      stock !== undefined
        ? Number(stock) <= 5
          ? ' Limited stock available — order now!'
          : ' In stock and ready to ship.'
        : '';

    const priceNote = price
      ? ` Available at just ₹${Number(price).toLocaleString('en-IN')}.`
      : '';

    const brandLine = brand ? `Crafted by **${brand}**, ` : '';
    const categoryLine = category ? ` — perfect for all your ${category.toLowerCase()} needs` : '';

    const specBlock = specSentences
      ? ` It comes equipped with ${specSentences}.`
      : '';

    const description =
      `${brandLine}the **${name}** is a high-quality, reliable electrical product${categoryLine}.` +
      `${specBlock}` +
      ` Built to deliver consistent performance and long-lasting durability, this product meets the highest industry standards.` +
      `${priceNote}${stockNote}`;

    return res.json({ description });
  } catch (err) {
    next(err);
  }
};

// ── Low Stock Products ─────────────────────────────────────────────────────────

exports.getLowStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ stock: { $gt: 0, $lte: 5 }, isActive: { $ne: false } })
      .populate('category', 'name')
      .select('name brand stock price images category')
      .sort({ stock: 1 });
    return res.json(products);
  } catch (err) {
    next(err);
  }
};
