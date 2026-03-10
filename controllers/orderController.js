const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const { sendOrderConfirmationEmail, sendCancelOtpEmail } = require('../utils/sendEmail');

// Delivery within Tamil Nadu only.
// Erode city or order >= ₹100 → FREE. Otherwise ₹40.
function calcDeliveryCharge(shippingAddress, subtotal) {
  const city = (shippingAddress.city || '').trim().toLowerCase();
  if (city === 'erode') return 0;
  if (subtotal >= 100)  return 0;
  return 40;
}

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

    const deliveryCharge = calcDeliveryCharge(shippingAddress, calculatedTotal);
    const grandTotal = Number((calculatedTotal + deliveryCharge).toFixed(2));

    const order = await Order.create({
      user: req.user._id,
      orderItems: itemsToUse,
      shippingAddress,
      deliveryCharge,
      totalPrice: grandTotal,
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

    // Send order confirmation email — fire-and-forget (never block the response)
    User.findById(req.user._id).select('name email').then((user) => {
      if (user && user.email) {
        sendOrderConfirmationEmail({ email: user.email, name: user.name, order })
          .then(() => console.log(`[Email] Order confirmation sent to ${user.email}`))
          .catch((err) => console.error('[Email] Failed to send order confirmation:', err.message));
      }
    }).catch((err) => console.error('[Email] Could not fetch user for email:', err.message));

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
    // Cancellation is a user-only action (via OTP flow) — admin moves orders forward only
    const ALLOWED_TRANSITIONS = {
      Pending:            ['Confirmed'],
      Confirmed:          ['Packed'],
      Packed:             ['Shipped'],
      Shipped:            ['Out for Delivery'],
      'Out for Delivery': ['Delivered'],            // locked — cannot go back
      Delivered:          [],                        // terminal
      Cancelled:          [],                        // terminal (set by user cancel flow)
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
      // COD is paid on delivery — mark as paid when delivered
      if (order.paymentInfo?.method === 'COD' && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = new Date();
        order.paymentInfo.status = 'Paid';
      }
    }

    await order.save();

    // Re-populate user so the frontend receives the full order (same shape as getAllOrders)
    await order.populate('user', 'name email');

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

// User: request OTP to cancel order — supports method: 'email' | 'sms'
exports.requestCancelOtp = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    const cancellableStatuses = ['Pending', 'Confirmed'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        message: `Order cannot be cancelled once it is ${order.orderStatus}.`,
      });
    }

    // Generate 6-digit OTP valid for 10 min
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    order.cancelOtp = otp;
    order.cancelOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await order.save();

    const user = await User.findById(req.user._id).select('name email');
    if (!user || !user.email) return res.status(500).json({ message: 'Could not retrieve user email' });

    const orderId = id.slice(-8).toUpperCase();

    // ── Email OTP ──
    sendCancelOtpEmail({ email: user.email, name: user.name, otp, orderId })
      .then(() => console.log(`[Email] Cancel OTP sent to ${user.email}`))
      .catch((err) => console.error('[Email] Cancel OTP email failed:', err.message));

    const [localPart, domain] = user.email.split('@');
    const masked = localPart.slice(0, 2) + '***@' + domain;
    return res.json({ message: `OTP sent to ${masked}`, via: 'email' });

  } catch (error) {
    next(error);
  }
};

// User: verify OTP and confirm cancellation
exports.verifyCancelOtp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otp, reason } = req.body;

    // Must select OTP fields explicitly (they have select:false)
    const order = await Order.findById(id)
      .select('+cancelOtp +cancelOtpExpires')
      .populate('user', 'name email');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised to cancel this order' });
    }

    if (!order.cancelOtp || !order.cancelOtpExpires) {
      return res.status(400).json({ message: 'No OTP found. Please request a new OTP.' });
    }

    if (new Date() > order.cancelOtpExpires) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    if (order.cancelOtp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }

    // OTP valid — clear it and proceed with cancellation
    order.cancelOtp = undefined;
    order.cancelOtpExpires = undefined;

    const cancellableStatuses = ['Pending', 'Confirmed'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        message: `Order cannot be cancelled once it is ${order.orderStatus}.`,
      });
    }

    order.orderStatus = 'Cancelled';
    order.cancelReason = reason?.trim() || 'No reason provided';
    order.cancelledAt = new Date();
    await order.save();

    // Restore stock
    const isCOD = order.paymentInfo?.method === 'COD';
    const isRazorpayPaid = order.paymentInfo?.method === 'Razorpay' && order.isPaid;
    if (isCOD || isRazorpayPaid) {
      await exports.restoreStockForOrder(order);
    }

    // Notify all admins
    try {
      const io = req.app.get('io');
      const admins = await User.find({ role: 'admin' }).select('_id');
      const notifications = admins.map((admin) => ({
        user: admin._id,
        title: 'Order Cancellation',
        message: `Order #${id.slice(-8).toUpperCase()} by ${order.user.name} has been cancelled. Method: ${order.paymentInfo?.method || 'N/A'}. Reason: ${order.cancelReason}`,
        type: 'order',
        link: `/admin/orders`,
      }));
      if (notifications.length > 0) {
        const saved = await Notification.insertMany(notifications);
        if (io) saved.forEach((n) => io.to(`user_${n.user}`).emit('newNotification', { ...n.toObject(), isRead: false }));
      }
    } catch (_) {}

    // Notify the user
    try {
      const userMsg = isRazorpayPaid
        ? `Your order #${id.slice(-8).toUpperCase()} has been cancelled. A refund of ₹${order.totalPrice.toLocaleString('en-IN')} will be credited within 5–7 business days.`
        : `Your order #${id.slice(-8).toUpperCase()} has been successfully cancelled. No charge has been made.`;
      await createNotification({ userId: req.user._id, title: 'Order Cancelled', message: userMsg, type: 'order', link: `/orders/${id}` }, req.app.get('io'));
    } catch (_) {}

    return res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    next(error);
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
      const io = req.app.get('io');
      const admins = await User.find({ role: 'admin' }).select('_id');
      const notifications = admins.map((admin) => ({
        user: admin._id,
        title: 'Order Cancellation',
        message: `Order #${id.slice(-8).toUpperCase()} by ${order.user.name} has been cancelled. Method: ${order.paymentInfo?.method || 'N/A'}. Reason: ${order.cancelReason}`,
        type: 'order',
        link: `/admin/orders`,
      }));
      if (notifications.length > 0) {
        const saved = await Notification.insertMany(notifications);
        if (io) saved.forEach((n) => io.to(`user_${n.user}`).emit('newNotification', { ...n.toObject(), isRead: false }));
      }
    } catch (_) {}

    // Notify the user — tailor message to payment method
    try {
      let userMsg;
      if (isRazorpayPaid) {
        userMsg = `Your order #${id.slice(-8).toUpperCase()} has been cancelled. A refund of ₹${order.totalPrice.toLocaleString('en-IN')} will be credited to your original payment method within 5–7 business days.`;
      } else {
        userMsg = `Your order #${id.slice(-8).toUpperCase()} has been successfully cancelled. No charge has been made.`;
      }
      await createNotification({ userId: req.user._id, title: 'Order Cancelled', message: userMsg, type: 'order', link: `/orders/${id}` }, req.app.get('io'));
    } catch (_) {}

    return res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    next(error);
  }
};
