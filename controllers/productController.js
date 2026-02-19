const Product = require('../models/Product');
const Category = require('../models/Category');
const cloudinary = require('../config/cloudinary');

// Helper to upload an image buffer to Cloudinary
const uploadImageToCloudinary = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'electrical-shop/products' }, (error, result) => {
      if (error) return reject(error);
      return resolve({ public_id: result.public_id, url: result.secure_url });
    });

    stream.end(fileBuffer);
  });

// Create a new category (admin)
exports.createCategory = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    const existing = await Category.findOne({ $or: [{ name }, { slug }] });
    if (existing) {
      return res.status(400).json({ message: 'Category with this name or slug already exists' });
    }

    const category = await Category.create({ name, slug, description });
    return res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

// Get all categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.json(categories);
  } catch (error) {
    next(error);
  }
};

// Create product (admin)
exports.createProduct = async (req, res, next) => {
  try {
    const { name, description, price, category, stock, brand, variants, featured } = req.body;

    if (!name || !description || !price || !category || !stock || !brand) {
      return res.status(400).json({ message: 'Missing required product fields' });
    }

    const images = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadImageToCloudinary(file.buffer);
        images.push(uploaded);
      }
    }

    const product = await Product.create({
      name,
      description,
      price,
      category,
      stock,
      brand,
      variants,
      images,
      featured: !!featured,
      lowStock: stock <= 5,
    });

    return res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// Update product (admin)
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, stock, brand, variants, featured } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) product.category = category;
    if (stock !== undefined) product.stock = stock;
    if (brand) product.brand = brand;
    if (variants) product.variants = variants;
    if (featured !== undefined) product.featured = featured;

    if (stock !== undefined) {
      product.lowStock = stock <= 5;
    }

    // Handle new images if provided
    if (req.files && req.files.length > 0) {
      const newImages = [];
      for (const file of req.files) {
        const uploaded = await uploadImageToCloudinary(file.buffer);
        newImages.push(uploaded);
      }
      product.images = [...product.images, ...newImages];
    }

    const updated = await product.save();
    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Delete product (admin)
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.deleteOne();
    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get single product
exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    next(error);
  }
};

// Get products with filters, search, pagination
exports.getProducts = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const keyword = req.query.keyword
      ? {
          $text: { $search: req.query.keyword },
        }
      : {};

    const category = req.query.category ? { category: req.query.category } : {};
    const brand = req.query.brand ? { brand: req.query.brand } : {};

    const priceFilter = {};
    if (req.query.minPrice) priceFilter.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) priceFilter.$lte = Number(req.query.maxPrice);

    const priceQuery = Object.keys(priceFilter).length ? { price: priceFilter } : {};

    const featured = req.query.featured ? { featured: req.query.featured === 'true' } : {};

    const query = {
      ...keyword,
      ...category,
      ...brand,
      ...priceQuery,
      ...featured,
    };

    let sort = { createdAt: -1 };
    if (req.query.sort === 'price_asc') sort = { price: 1 };
    if (req.query.sort === 'price_desc') sort = { price: -1 };
    if (req.query.sort === 'rating') sort = { ratings: -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    return res.json({
      products,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get featured products
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const products = await Product.find({ featured: true }).sort({ createdAt: -1 }).limit(limit);
    return res.json(products);
  } catch (error) {
    next(error);
  }
};
