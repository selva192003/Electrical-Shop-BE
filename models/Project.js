const mongoose = require('mongoose');

const projectItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    productImage: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    projectType: {
      type: String,
      enum: ['Residential', 'Commercial', 'Industrial', 'Infrastructure', 'Other'],
      default: 'Residential',
    },
    siteAddress: { type: String, default: '' },
    status: {
      type: String,
      enum: ['planning', 'in-progress', 'ordered', 'completed'],
      default: 'planning',
    },
    items: [projectItemSchema],
    totalEstimate: { type: Number, default: 0 },
    shareToken: { type: String, unique: true, sparse: true },
    isShared: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-calculate total estimate before save
projectSchema.pre('save', function (next) {
  this.totalEstimate = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  next();
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
