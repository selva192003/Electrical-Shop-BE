const User = require('../models/User');
const Order = require('../models/Order');

// Dashboard analytics summary
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const [totalUsers, revenueStats, monthlySales, topProducts, statusBreakdown] = await Promise.all([
      User.countDocuments(),
      Order.aggregate([
        { $match: { isPaid: true } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPrice' },
          },
        },
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
      ]),
      Order.aggregate([
        { $match: { isPaid: true } },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.product',
            totalQuantity: { $sum: '$orderItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueStats[0]?.totalRevenue || 0;

    return res.json({
      totalUsers,
      totalRevenue,
      monthlySales,
      topProducts,
      orderStatusBreakdown: statusBreakdown,
    });
  } catch (error) {
    next(error);
  }
};
