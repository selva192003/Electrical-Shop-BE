const Product = require('../models/Product');
const Project = require('../models/Project');
const Cart = require('../models/Cart');

/**
 * POST /api/calculator/match-products
 * Takes the computed shopping list from the frontend calculator and resolves
 * each generic item to real products from the catalog using text/regex search.
 *
 * Body: { items: [{ label, searchTerm, qty, unit, note }] }
 * Returns: same array with `matches` (top 3 products) and `picked` (best match)
 */
exports.matchProducts = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const results = await Promise.all(
      items.map(async (item) => {
        const { label, searchTerm, qty, unit, note } = item;

        // 1. Try MongoDB full-text search first
        let products = await Product.find(
          { $text: { $search: searchTerm }, isActive: true, stock: { $gt: 0 } },
          { score: { $meta: 'textScore' }, name: 1, price: 1, brand: 1, images: 1, stock: 1, ratings: 1, numReviews: 1 }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(3)
          .lean();

        // 2. Fallback to regex search if text search returns nothing
        if (products.length === 0) {
          const keywords = searchTerm.split(' ').filter(Boolean);
          const regexParts = keywords.map((k) => `(?=.*${k})`).join('');
          const regex = new RegExp(regexParts, 'i');

          products = await Product.find(
            { name: regex, isActive: true, stock: { $gt: 0 } },
            { name: 1, price: 1, brand: 1, images: 1, stock: 1, ratings: 1, numReviews: 1 }
          )
            .limit(3)
            .lean();
        }

        return {
          label,
          searchTerm,
          qty,
          unit,
          note: note || '',
          matches: products,
          // Best match — the first result. Frontend can let user swap.
          picked: products[0] || null,
        };
      })
    );

    return res.json({ items: results });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/calculator/add-to-cart
 * Bulk-adds a list of { productId, quantity } to the current user's cart.
 * Identical items are merged (quantity incremented).
 *
 * Body: { items: [{ productId, quantity }] }
 */
exports.addCalculatorToCart = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    // Validate all products first
    const productIds = items.map((i) => i.productId);
    const products = await Product.find(
      { _id: { $in: productIds }, isActive: true },
      { price: 1, stock: 1, name: 1 }
    ).lean();

    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [], totalPrice: 0 });
    }

    let added = 0;
    let skipped = 0;
    const skippedItems = [];

    for (const item of items) {
      const { productId, quantity = 1 } = item;
      const product = productMap[productId];

      if (!product || product.stock <= 0) {
        skipped++;
        skippedItems.push(productId);
        continue;
      }

      const existing = cart.items.find(
        (ci) => ci.product.toString() === productId
      );

      if (existing) {
        existing.quantity += Number(quantity);
      } else {
        cart.items.push({
          product: productId,
          quantity: Number(quantity),
          price: product.price,
        });
      }
      added++;
    }

    // Recalculate total
    cart.totalPrice = cart.items.reduce(
      (sum, ci) => sum + ci.price * ci.quantity,
      0
    );
    await cart.save();

    return res.json({
      message: `${added} item(s) added to cart.${skipped > 0 ? ` ${skipped} item(s) skipped (out of stock).` : ''}`,
      added,
      skipped,
      cart,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/calculator/save-as-project
 * Auto-creates a named project and populates it with the matched products.
 * The user doesn't have to do anything manual — one click, project is ready.
 *
 * Body:
 *  {
 *    name: string,            // e.g. "2 BHK - Home Wiring"
 *    projectType: string,     // "Residential" | "Commercial" | ...
 *    items: [{ productId, quantity, label }]
 *  }
 */
exports.saveCalculatorAsProject = async (req, res, next) => {
  try {
    const { name, projectType, items, description } = req.body;

    if (!name) return res.status(400).json({ message: 'Project name is required' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const productIds = items.map((i) => i.productId).filter(Boolean);
    const products = await Product.find(
      { _id: { $in: productIds } },
      { name: 1, price: 1, images: 1, isActive: 1 }
    ).lean();
    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    const projectItems = [];
    for (const item of items) {
      if (!item.productId) continue;
      const product = productMap[item.productId];
      if (!product) continue;

      projectItems.push({
        product: product._id,
        productName: product.name,
        productImage: product.images?.[0]?.url || '',
        quantity: Number(item.quantity) || 1,
        price: product.price,
        notes: item.label || '',
      });
    }

    const project = await Project.create({
      user: req.user._id,
      name,
      description: description || `Auto-generated from Electrical Load Calculator`,
      projectType: projectType || 'Residential',
      items: projectItems,
    });

    const populated = await Project.findById(project._id).populate(
      'items.product',
      'name images brand price stock isActive'
    );

    return res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};
