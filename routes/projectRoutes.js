const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getMyProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addItemToProject,
  updateProjectItem,
  removeItemFromProject,
  toggleShare,
  addProjectToCart,
} = require('../controllers/projectController');

// All project routes require auth
router.get('/', protect, getMyProjects);
router.post('/', protect, createProject);

router.get('/:id', protect, getProject);
router.put('/:id', protect, updateProject);
router.delete('/:id', protect, deleteProject);

router.post('/:id/items', protect, addItemToProject);
router.put('/:id/items/:itemId', protect, updateProjectItem);
router.delete('/:id/items/:itemId', protect, removeItemFromProject);

router.post('/:id/share', protect, toggleShare);
router.post('/:id/add-to-cart', protect, addProjectToCart);

module.exports = router;
