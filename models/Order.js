const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    image: { type: String },
    variant: {
      watt: { type: String },
      voltage: { type: String },
      brand: { type: String },
    },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const paymentInfoSchema = new mongoose.Schema(
  {
    // 'Razorpay' | 'COD'
    method: { type: String, enum: ['Razorpay', 'COD'], default: 'Razorpay' },
    razorpayOrderId:  { type: String },
    razorpayPaymentId: { type: String },
    // 'Pending' | 'Paid' | 'Failed'
    status: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderItems: { type: [orderItemSchema], required: true, validate: v => v.length > 0 },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentInfo: paymentInfoSchema,
    totalPrice: { type: Number, required: true, min: 0 },
    orderStatus: {
      type: String,
      enum: [
        'Pending',
        'Confirmed',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
      ],
      default: 'Pending',
      index: true,
    },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    cancelReason: { type: String, default: '' },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
