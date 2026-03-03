const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    watt: { type: String },
    voltage: { type: String },
    brand: { type: String },
  },
  { _id: false }
);

const bulkPricingSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true },
    maxQty: { type: Number, default: null }, // null = no upper limit
    pricePerUnit: { type: Number, required: true },
  },
  { _id: false }
);

const flashSaleSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: false },
    salePrice: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
    maxQuantity: { type: Number, default: null },
    soldCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const restockSubscriberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscribedAt: { type: Date, default: Date.now },
    notified: { type: Boolean, default: false },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    public_id: { type: String, default: '' },
    url: { type: String, required: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    stock: { type: Number, required: true, min: 0 },
    brand: { type: String, required: true },
    variants: [variantSchema],
    images: [imageSchema],
    ratings: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    lowStock: { type: Boolean, default: false },
    specifications: { type: Map, of: String, default: {} },
    isActive: { type: Boolean, default: true },
    // Flash sale
    flashSale: { type: flashSaleSchema, default: () => ({}) },
    // Bulk / B2B pricing tiers
    bulkPricing: [bulkPricingSchema],
    // Restock notification subscribers
    restockSubscribers: [restockSubscriberSchema],
    // Warranty
    warrantyMonths: { type: Number, default: 0 },
    warrantyTerms: { type: String, default: '' },
    // Inventory
    sku: { type: String, unique: true, sparse: true, trim: true },
    lowStockThreshold: { type: Number, default: 10 },
    reorderPoint: { type: Number, default: 5 },
    warehouseLocation: { type: String, default: '' },
    costPrice: { type: Number, default: 0 },
    supplierName: { type: String, default: '' },
    supplierContact: { type: String, default: '' },
    leadTimeDays: { type: Number, default: 0 },
    // Computed flash sale flag for quick queries
    isOnFlashSale: { type: Boolean, default: false },
    // Tags for better search/discovery
    tags: [{ type: String, lowercase: true, trim: true }],
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
