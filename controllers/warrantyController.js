const Warranty = require('../models/Warranty');
const Order = require('../models/Order');
const Product = require('../models/Product');
const sendEmail = require('../utils/sendEmail');

// Create warranties after order is delivered (called internally)
exports.createWarrantiesForOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate('orderItems.product', 'name images warrantyMonths');

    if (!order) return;

    const purchaseDate = new Date();

    for (const item of order.orderItems) {
      const product = item.product;
      if (!product || !product.warrantyMonths || product.warrantyMonths <= 0) continue;

      // Avoid duplicates
      const existing = await Warranty.findOne({ user: order.user, product: product._id, order: orderId });
      if (existing) continue;

      const expiryDate = new Date(purchaseDate);
      expiryDate.setMonth(expiryDate.getMonth() + product.warrantyMonths);

      await Warranty.create({
        user: order.user,
        product: product._id,
        order: orderId,
        productName: product.name,
        productImage: product.images?.[0]?.url || '',
        purchaseDate,
        warrantyMonths: product.warrantyMonths,
        expiryDate,
        status: 'active',
      });
    }
  } catch (err) {
    console.error('createWarrantiesForOrder error:', err.message);
  }
};

// Get all warranties for logged-in user
exports.getMyWarranties = async (req, res, next) => {
  try {
    const now = new Date();

    // Auto-expire warranties
    await Warranty.updateMany(
      { user: req.user._id, status: 'active', expiryDate: { $lt: now } },
      { $set: { status: 'expired' } }
    );

    const warranties = await Warranty.find({ user: req.user._id })
      .populate('product', 'name images brand warrantyTerms')
      .populate('order', 'totalPrice createdAt')
      .sort({ expiryDate: 1 });

    return res.json(warranties);
  } catch (error) {
    next(error);
  }
};

// File a warranty claim
exports.fileClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { claimDetails } = req.body;

    const warranty = await Warranty.findOne({ _id: id, user: req.user._id });
    if (!warranty) {
      return res.status(404).json({ message: 'Warranty not found' });
    }
    if (warranty.status === 'expired') {
      return res.status(400).json({ message: 'Warranty has expired and cannot be claimed' });
    }
    if (warranty.status === 'claimed') {
      return res.status(400).json({ message: 'Warranty has already been claimed' });
    }

    warranty.status = 'claimed';
    warranty.claimDetails = claimDetails || 'No details provided';
    warranty.claimedAt = new Date();
    await warranty.save();

    // Create a support ticket automatically
    const SupportTicket = require('../models/SupportTicket');
    await SupportTicket.create({
      user: req.user._id,
      subject: `Warranty Claim - ${warranty.productName}`,
      description: `Warranty claim filed for product: ${warranty.productName}. Order: ${warranty.order}. Details: ${warranty.claimDetails}`,
      category: 'warranty',
      status: 'open',
    });

    return res.json({ message: 'Warranty claim filed successfully', warranty });
  } catch (error) {
    next(error);
  }
};

// Admin: get all warranties
exports.getAllWarranties = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const warranties = await Warranty.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name brand')
      .populate('order', 'totalPrice createdAt')
      .sort({ createdAt: -1 });

    return res.json(warranties);
  } catch (error) {
    next(error);
  }
};
