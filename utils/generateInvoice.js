// Generate basic invoice data object from order
const generateInvoice = (order) => {
  return {
    invoiceNumber: `INV-${order._id}`,
    date: order.createdAt,
    customer: {
      name: order.user?.name,
      email: order.user?.email,
    },
    shippingAddress: order.shippingAddress,
    items: order.orderItems,
    total: order.totalPrice,
    paymentStatus: order.isPaid ? 'Paid' : 'Unpaid',
    orderStatus: order.orderStatus,
  };
};

module.exports = generateInvoice;
