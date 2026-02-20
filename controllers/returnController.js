const ReturnRequest = require('../models/ReturnRequest');
const Order = require('../models/Order');
const { createNotification } = require('./notificationController');

// POST /api/returns  — user submits return
exports.createReturnRequest = async (req, res, next) => {
  try {
    const { orderId, items, reason, description } = req.body;

    if (!orderId || !items || !items.length || !reason) {
      return res.status(400).json({ message: 'orderId, items and reason are required' });
    }

    // Verify the order belongs to the user and is delivered
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (order.orderStatus !== 'Delivered') {
      return res.status(400).json({ message: 'Only delivered orders can be returned' });
    }

    // Prevent duplicate return for same order
    const existing = await ReturnRequest.findOne({ order: orderId, user: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'A return request for this order already exists' });
    }

    const returnReq = await ReturnRequest.create({
      user: req.user._id,
      order: orderId,
      items,
      reason,
      description,
    });

    await createNotification({
      userId: req.user._id,
      title: 'Return Request Submitted',
      message: 'Your return request has been submitted and is under review.',
      type: 'return',
      link: '/returns',
    });

    return res.status(201).json(returnReq);
  } catch (error) {
    next(error);
  }
};

// GET /api/returns  — get own return requests (user)
exports.getMyReturnRequests = async (req, res, next) => {
  try {
    const returns = await ReturnRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('order', 'createdAt totalPrice orderStatus');

    return res.json(returns);
  } catch (error) {
    next(error);
  }
};

// GET /api/returns/:id  — get single return (user or admin)
exports.getReturnRequest = async (req, res, next) => {
  try {
    const returnReq = await ReturnRequest.findById(req.params.id)
      .populate('order', 'createdAt totalPrice orderStatus')
      .populate('user', 'name email');

    if (!returnReq) return res.status(404).json({ message: 'Return request not found' });

    if (req.user.role !== 'admin' && returnReq.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    return res.json(returnReq);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/returns/:id/status  — admin updates status
exports.updateReturnStatus = async (req, res, next) => {
  try {
    const { status, adminNote, refundAmount } = req.body;

    const returnReq = await ReturnRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminNote, refundAmount },
      { new: true, runValidators: true }
    );

    if (!returnReq) return res.status(404).json({ message: 'Return request not found' });

    const titleMap = {
      approved: 'Return Request Approved',
      rejected: 'Return Request Rejected',
      picked_up: 'Item Picked Up',
      refunded: 'Refund Processed',
    };

    if (titleMap[status]) {
      await createNotification({
        userId: returnReq.user,
        title: titleMap[status],
        message: `Your return request status has been updated to: ${status}.`,
        type: 'return',
        link: `/returns/${returnReq._id}`,
      });
    }

    return res.json(returnReq);
  } catch (error) {
    next(error);
  }
};

// GET /api/returns/admin/all  — all returns (admin)
exports.getAllReturnRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};

    const [returns, total] = await Promise.all([
      ReturnRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('user', 'name email')
        .populate('order', 'createdAt totalPrice'),
      ReturnRequest.countDocuments(filter),
    ]);

    return res.json({ returns, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};
