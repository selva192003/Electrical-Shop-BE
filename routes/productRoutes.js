const express = require('express');
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getFeaturedProducts,
  createCategory,
  getCategories,
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Categories
router.get('/categories', getCategories);
router.post('/categories', protect, admin, createCategory);

// Products
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/:id', getProductById);

router.post('/', protect, admin, upload.array('images', 5), createProduct);
router.put('/:id', protect, admin, upload.array('images', 5), updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

module.exports = router;
