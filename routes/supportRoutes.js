const express = require('express');
const {
  createTicket,
  getMyTickets,
  getTicket,
  replyToTicket,
  updateTicketStatus,
  getAllTickets,
  getPendingCount,
} = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect);

// Admin routes — must be declared BEFORE /:id to prevent wildcard shadowing
router.get('/admin/pending-count', admin, getPendingCount);
router.get('/admin/all', admin, getAllTickets);

// User routes
router.post('/', createTicket);
router.get('/', getMyTickets);
router.get('/:id', getTicket);
router.post('/:id/reply', replyToTicket);
router.patch('/:id/status', admin, updateTicketStatus);

module.exports = router;
