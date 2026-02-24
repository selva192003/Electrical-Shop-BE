const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Recalculate total price of cart
const recalculateTotal = (cart) => {
  cart.totalPrice = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
};

// Get current user's cart
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [], totalPrice: 0 });
    }
    return res.json(cart);
  } catch (error) {
    next(error);
  }
};

// Add item to cart
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, variant } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [], totalPrice: 0 });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId && JSON.stringify(item.variant || {}) === JSON.stringify(variant || {})
    );

    if (existingItem) {
      existingItem.quantity += Number(quantity);
    } else {
      cart.items.push({
        product: productId,
        quantity: Number(quantity),
        price: product.price,
        variant,
      });
    }

    recalculateTotal(cart);
    await cart.save();

    return res.status(201).json(cart);
  } catch (error) {
    next(error);
  }
};

// Update quantity of a cart item
exports.updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    item.quantity = Number(quantity);
    recalculateTotal(cart);

    await cart.save();

    return res.json(cart);
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    cart.items.pull({ _id: itemId });
    recalculateTotal(cart);

    await cart.save();

    return res.json(cart);
  } catch (error) {
    next(error);
  }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = [];
    cart.totalPrice = 0;
    await cart.save();

    return res.json({ message: 'Cart cleared', cart });
  } catch (error) {
    next(error);
  }
};
