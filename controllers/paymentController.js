const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { reduceStockForOrder } = require('./orderController');

// Create Razorpay order for an existing order
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ message: 'Payment service not configured. Please contact support.' });
    }
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.isPaid) {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    const options = {
      amount: Math.round(order.totalPrice * 100), // amount in paise
      currency: 'INR',
      receipt: `order_rcptid_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        userId: order.user.toString(),
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    const payment = await Payment.create({
      user: order.user,
      order: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: options.amount,
      currency: options.currency,
      status: 'created',
      rawResponse: razorpayOrder,
    });

    return res.status(201).json({
      key: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: options.amount,
      currency: options.currency,
      paymentId: payment._id,
    });
  } catch (error) {
    next(error);
  }
};

// Verify Razorpay payment signature and update records
exports.verifyPayment = async (req, res, next) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ message: 'Payment service not configured. Please contact support.' });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay payment details' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id }).populate('order');

    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    if (generatedSignature !== razorpay_signature) {
      payment.status = 'failed';
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.signature = razorpay_signature;
      await payment.save();
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    payment.status = 'captured';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    await payment.save();

    const order = await Order.findById(payment.order._id);
    if (order) {
      order.isPaid = true;
      order.paidAt = new Date();
      order.orderStatus = 'Confirmed';
      order.paymentInfo = {
        method: 'Razorpay',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: 'Paid',
      };
      await order.save();

      // Reduce stock after successful payment confirmation
      await reduceStockForOrder(order._id);
    }

    return res.json({
      message: 'Payment verified and order updated successfully',
      orderId: order ? order._id.toString() : null,
    });
  } catch (error) {
    next(error);
  }
};
