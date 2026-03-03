const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const {
  getMyWarranties,
  fileClaim,
  getAllWarranties,
} = require('../controllers/warrantyController');

router.get('/my', protect, getMyWarranties);
router.post('/claim/:id', protect, fileClaim);
router.get('/admin/all', protect, isAdmin, getAllWarranties);

module.exports = router;
