const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Create a new order from cart or direct items
exports.createOrder = async (req, res, next) => {
  try {
    const { orderItems, shippingAddress, totalPrice, fromCart } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

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
    });

    // If created from cart, clear cart
    if (fromCart) {
      await Cart.updateOne({ user: req.user._id }, { $set: { items: [], totalPrice: 0 } });
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

    const allowedStatuses = [
      'Pending',
      'Confirmed',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.orderStatus = status;

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
