const express = require('express');
const {
  createReturnRequest,
  getMyReturnRequests,
  getReturnRequest,
  updateReturnStatus,
  getAllReturnRequests,
} = require('../controllers/returnController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect);

// User routes
router.post('/', createReturnRequest);
router.get('/', getMyReturnRequests);
router.get('/:id', getReturnRequest);

// Admin routes
router.get('/admin/all', admin, getAllReturnRequests);
router.patch('/:id/status', admin, updateReturnStatus);

module.exports = router;
