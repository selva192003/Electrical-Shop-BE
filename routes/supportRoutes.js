const express = require('express');
const {
  createTicket,
  getMyTickets,
  getTicket,
  replyToTicket,
  updateTicketStatus,
  getAllTickets,
} = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect);

// User routes
router.post('/', createTicket);
router.get('/', getMyTickets);
router.get('/:id', getTicket);
router.post('/:id/reply', replyToTicket);

// Admin routes
router.get('/admin/all', admin, getAllTickets);
router.patch('/:id/status', admin, updateTicketStatus);

module.exports = router;
