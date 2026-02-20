const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

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
      outOfStock,
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
      Product.countDocuments({ stock: 0 }),
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
      outOfStock,
      monthlySales,
      topProducts: topProductsRaw,
      orderStatusBreakdown: statusBreakdown,
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
};
