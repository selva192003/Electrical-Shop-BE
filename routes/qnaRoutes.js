const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const {
  getProductQnA,
  askQuestion,
  answerQuestion,
  upvoteQuestion,
  deleteQuestion,
} = require('../controllers/qnaController');

// Public - read questions
router.get('/:productId', getProductQnA);

// Auth required
router.post('/:productId/ask', protect, askQuestion);
router.post('/answer/:qnaId', protect, answerQuestion);
router.post('/upvote/:qnaId', protect, upvoteQuestion);
router.delete('/:qnaId', protect, deleteQuestion);

module.exports = router;
