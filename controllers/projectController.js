const crypto = require('crypto');
const Project = require('../models/Project');
const Product = require('../models/Product');

// Get all projects for logged-in user
exports.getMyProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ user: req.user._id })
      .populate('items.product', 'name images brand price stock isActive')
      .sort({ updatedAt: -1 });

    return res.json(projects);
  } catch (error) {
    next(error);
  }
};

// Get a single project (owner or via share token)
exports.getProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    const project = await Project.findById(id).populate(
      'items.product',
      'name images brand price stock isActive flashSale bulkPricing'
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Allow access if owner or valid share token
    const isOwner = req.user && project.user.toString() === req.user._id.toString();
    const isSharedAccess = project.isShared && token && project.shareToken === token;

    if (!isOwner && !isSharedAccess) {
      return res.status(403).json({ message: 'Not authorised to view this project' });
    }

    return res.json(project);
  } catch (error) {
    next(error);
  }
};

// Create a new project
exports.createProject = async (req, res, next) => {
  try {
    const { name, description, projectType, siteAddress, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const project = await Project.create({
      user: req.user._id,
      name,
      description,
      projectType: projectType || 'Residential',
      siteAddress,
      notes,
      items: [],
    });

    return res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

// Update project metadata
exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, projectType, siteAddress, status, notes } = req.body;

    const project = await Project.findOne({ _id: id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (projectType !== undefined) project.projectType = projectType;
    if (siteAddress !== undefined) project.siteAddress = siteAddress;
    if (status !== undefined) project.status = status;
    if (notes !== undefined) project.notes = notes;

    await project.save();
    return res.json(project);
  } catch (error) {
    next(error);
  }
};

// Delete a project
exports.deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    return res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};

// Add item to project
exports.addItemToProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { productId, quantity, notes } = req.body;

    const [project, product] = await Promise.all([
      Project.findOne({ _id: id, user: req.user._id }),
      Product.findById(productId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product already in project — update qty instead of duplicate
    const existingItem = project.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += Number(quantity) || 1;
    } else {
      project.items.push({
        product: product._id,
        productName: product.name,
        productImage: product.images?.[0]?.url || '',
        quantity: Number(quantity) || 1,
        price: product.price,
        notes: notes || '',
      });
    }

    await project.save();

    const updated = await Project.findById(id).populate(
      'items.product',
      'name images brand price stock isActive'
    );

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Update an item in project (quantity or notes)
exports.updateProjectItem = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, notes } = req.body;

    const project = await Project.findOne({ _id: id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const item = project.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in project' });
    }

    if (quantity !== undefined) item.quantity = Math.max(1, Number(quantity));
    if (notes !== undefined) item.notes = notes;

    await project.save();
    return res.json(project);
  } catch (error) {
    next(error);
  }
};

// Remove item from project
exports.removeItemFromProject = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const project = await Project.findOne({ _id: id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.items = project.items.filter((item) => item._id.toString() !== itemId);
    await project.save();

    return res.json(project);
  } catch (error) {
    next(error);
  }
};

// Generate / revoke share link
exports.toggleShare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findOne({ _id: id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.isShared) {
      project.isShared = false;
      project.shareToken = undefined;
      await project.save();
      return res.json({ message: 'Sharing disabled', shareLink: null });
    } else {
      const token = crypto.randomBytes(16).toString('hex');
      project.isShared = true;
      project.shareToken = token;
      await project.save();
      const shareLink = `${process.env.CLIENT_URL}/projects/${project._id}?token=${token}`;
      return res.json({ message: 'Share link generated', shareLink, shareToken: token });
    }
  } catch (error) {
    next(error);
  }
};

// Add all project items to cart
exports.addProjectToCart = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Cart = require('../models/Cart');

    const project = await Project.findOne({ _id: id, user: req.user._id }).populate(
      'items.product',
      'name images brand price stock isActive'
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.items.length === 0) {
      return res.status(400).json({ message: 'Project has no items' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [], totalPrice: 0 });
    }

    let added = 0;
    let skipped = 0;

    for (const projectItem of project.items) {
      const product = projectItem.product;
      if (!product || !product.isActive || product.stock <= 0) {
        skipped++;
        continue;
      }

      const cartItem = cart.items.find(
        (ci) => ci.product.toString() === product._id.toString()
      );

      if (cartItem) {
        cartItem.quantity += projectItem.quantity;
      } else {
        cart.items.push({
          product: product._id,
          quantity: projectItem.quantity,
          price: product.price,
        });
      }
      added++;
    }

    // Recalculate total
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    await cart.save();

    return res.json({
      message: `Added ${added} item(s) to cart. ${skipped} item(s) skipped (out of stock).`,
      added,
      skipped,
    });
  } catch (error) {
    next(error);
  }
};
