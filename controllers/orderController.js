const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Create a new order from cart or direct items
exports.createOrder = async (req, res, next) => {
  try {
    const { orderItems, shippingAddress, totalPrice, fromCart, paymentMethod } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    // Validate and normalise payment method
    const method = paymentMethod === 'COD' ? 'COD' : 'Razorpay';

    let itemsToUse = orderItems;
    let calculatedTotal = totalPrice;

    if (fromCart) {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      itemsToUse = cart.items.map((item) => ({
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        image: item.product.images?.[0]?.url,
        variant: item.variant,
      }));
      calculatedTotal = cart.totalPrice;
    }

    if (!itemsToUse || itemsToUse.length === 0) {
      return res.status(400).json({ message: 'No order items provided' });
    }

    const order = await Order.create({
      user: req.user._id,
      orderItems: itemsToUse,
      shippingAddress,
      totalPrice: calculatedTotal,
      orderStatus: 'Pending',
      isPaid: false,
      paymentInfo: {
        method,
        status: 'Pending',
      },
    });

    // Clear cart after order creation (regardless of payment method)
    if (fromCart) {
      await Cart.updateOne({ user: req.user._id }, { $set: { items: [], totalPrice: 0 } });
    }

    // COD: reduce stock immediately since no payment verification step needed
    if (method === 'COD') {
      await exports.reduceStockForOrder(order._id);
    }

    return res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

// Get logged-in user's orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('orderItems.product', 'name images brand')
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (error) {
    next(error);
  }
};

// Get single order (user or admin)
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name images brand');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

// Admin: get all orders
exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (error) {
    next(error);
  }
};

// Admin: update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Define the only legal forward transitions for each status.
    // Terminal states (Delivered, Cancelled) have no allowed next states.
    const ALLOWED_TRANSITIONS = {
      Pending:            ['Confirmed', 'Cancelled'],
      Confirmed:          ['Packed',    'Cancelled'],
      Packed:             ['Shipped',   'Cancelled'],
      Shipped:            ['Out for Delivery', 'Cancelled'],
      'Out for Delivery': ['Delivered'],            // locked — cannot cancel or go back
      Delivered:          [],                        // terminal
      Cancelled:          [],                        // terminal
    };

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentStatus = order.orderStatus;

    // Same status — no-op, just return
    if (currentStatus === status) {
      return res.json(order);
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(status)) {
      const isTerminal = allowed.length === 0;
      const msg = isTerminal
        ? `Order is already ${currentStatus} and cannot be changed.`
        : `Cannot change status from "${currentStatus}" to "${status}". Allowed: ${allowed.join(', ')}.`;
      return res.status(400).json({ message: msg });
    }

    order.orderStatus = status;
    if (status === 'Delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    await order.save();

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

// Helper: reduce stock after order confirmation/payment
exports.reduceStockForOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) return;

  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock = Math.max(0, product.stock - item.quantity);
      product.lowStock = product.stock <= 5;
      await product.save();
    }
  }
};

// Helper: restore stock when order is cancelled
exports.restoreStockForOrder = async (order) => {
  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock = product.stock + item.quantity;
      product.lowStock = product.stock <= 5;
      await product.save();
    }
  }
};

// User: cancel own order
exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Only the order owner can cancel
    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised to cancel this order' });
    }

    const cancellableStatuses = ['Pending', 'Confirmed'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        message: `Order cannot be cancelled once it is ${order.orderStatus}.`,
      });
    }

    // Update order
    order.orderStatus = 'Cancelled';
    order.cancelReason = reason?.trim() || 'No reason provided';
    order.cancelledAt = new Date();
    await order.save();

    // Restore product stock:
    //  - COD: stock was reduced immediately at order creation → always restore
    //  - Razorpay + isPaid: stock was reduced after payment verification → restore
    //  - Razorpay + not paid (Pending, payment never completed): stock was never reduced → skip
    const isCOD = order.paymentInfo?.method === 'COD';
    const isRazorpayPaid = order.paymentInfo?.method === 'Razorpay' && order.isPaid;
    if (isCOD || isRazorpayPaid) {
      await exports.restoreStockForOrder(order);
    }

    // Notify all admins
    try {
      const admins = await User.find({ role: 'admin' }).select('_id');
      const notifications = admins.map((admin) => ({
        user: admin._id,
        title: 'Order Cancellation',
        message: `Order #${id.slice(-8).toUpperCase()} by ${order.user.name} has been cancelled. Method: ${order.paymentInfo?.method || 'N/A'}. Reason: ${order.cancelReason}`,
        type: 'order',
        link: `/admin/orders`,
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (_) {
      // Notifications are non-critical; don't fail the request
    }

    // Notify the user — tailor message to payment method
    try {
      let userMsg;
      if (isRazorpayPaid) {
        userMsg = `Your order #${id.slice(-8).toUpperCase()} has been cancelled. A refund of ₹${order.totalPrice.toLocaleString('en-IN')} will be credited to your original payment method within 5–7 business days.`;
      } else {
        userMsg = `Your order #${id.slice(-8).toUpperCase()} has been successfully cancelled. No charge has been made.`;
      }
      await Notification.create({
        user: req.user._id,
        title: 'Order Cancelled',
        message: userMsg,
        type: 'order',
        link: `/orders/${id}`,
      });
    } catch (_) {}

    return res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    next(error);
  }
};
