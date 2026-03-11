const cron = require('node-cron');
const https = require('https');
const http = require('http');
const sendEmail = require('./sendEmail');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

// Helper to create notification in DB and emit socket
const emitNotification = async (io, userId, data) => {
  const n = await Notification.create({ user: userId, ...data }).catch(() => null);
  if (n && io) io.to(`user_${userId}`).emit('newNotification', { ...n.toObject(), isRead: false });
};

// ─────────────────────────────────────────────
// 1. Abandoned Cart Recovery — runs every day at 10:00 AM
// ─────────────────────────────────────────────
const runAbandonedCartRecovery = async (io) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find carts updated between 24-48 hours ago (so we only email once)
    const abandonedCarts = await Cart.find({
      updatedAt: { $gte: twoDaysAgo, $lte: cutoff },
      items: { $exists: true, $not: { $size: 0 } },
    }).populate('user', 'name email notificationPrefs').populate('items.product', 'name images price');

    let recovered = 0;

    for (const cart of abandonedCarts) {
      if (!cart.user || !cart.user.email) continue;
      if (!cart.user.notificationPrefs?.promotions) continue;

      // Check if user placed an order after the cart was last updated
      const recentOrder = await Order.findOne({
        user: cart.user._id,
        createdAt: { $gt: cart.updatedAt },
      });
      if (recentOrder) continue; // User already checked out

      const itemsList = cart.items
        .slice(0, 3)
        .map((item) => `<li>${item.product?.name || 'Product'} (Qty: ${item.quantity}) — ₹${item.price}</li>`)
        .join('');

      const moreItems = cart.items.length > 3 ? `<li>+ ${cart.items.length - 3} more item(s)</li>` : '';

      await sendEmail({
        to: cart.user.email,
        subject: `${cart.user.name}, you left something behind! 🛒`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #003566;">Your cart is waiting! ⚡</h2>
            <p>Hey <strong>${cart.user.name}</strong>, you left these items in your cart:</p>
            <ul style="background: #f8f9fa; padding: 16px; border-radius: 8px; list-style: none;">
              ${itemsList}${moreItems}
            </ul>
            <a href="${process.env.CLIENT_URL}/cart" 
               style="background: #003566; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px; font-size: 16px;">
              Complete My Purchase
            </a>
            <hr style="margin-top: 24px;"/>
            <p style="font-size: 12px; color: #888;">Sri Murugan Electricals &amp; Hardwares</p>
          </div>
        `,
      }).catch(() => {});

      // In-app notification
      await emitNotification(io, cart.user._id, {
        title: 'Cart Reminder',
        message: `You have items in your cart! Complete your purchase before they sell out.`,
        type: 'promo',
        link: '/cart',
      });

      recovered++;
    }

    console.log(`[Cron] Abandoned cart recovery: ${recovered} emails sent`);
  } catch (err) {
    console.error('[Cron] Abandoned cart recovery error:', err.message);
  }
};

// ─────────────────────────────────────────────
// 2. Auto-expire flash sales — runs every hour
// ─────────────────────────────────────────────
const runFlashSaleExpiry = async () => {
  try {
    const now = new Date();
    const result = await Product.updateMany(
      { 'flashSale.isActive': true, 'flashSale.endTime': { $lt: now } },
      { $set: { 'flashSale.isActive': false, isOnFlashSale: false } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cron] Expired ${result.modifiedCount} flash sale(s)`);
    }
  } catch (err) {
    console.error('[Cron] Flash sale expiry error:', err.message);
  }
};

// ─────────────────────────────────────────────
// 4. Low stock admin alerts — runs every day at 8:00 AM
// ─────────────────────────────────────────────
const runLowStockAlerts = async (io) => {
  try {
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      stock: { $gt: 0 }, // still has some stock but below threshold
    }).select('name stock lowStockThreshold brand');

    if (lowStockProducts.length === 0) return;

    const admins = await User.find({ role: 'admin' }).select('email name');

    const tableRows = lowStockProducts
      .map((p) => `<tr><td>${p.name}</td><td>${p.brand}</td><td style="color:${p.stock <= 5 ? '#e63946' : '#f4a261'}">${p.stock}</td><td>${p.lowStockThreshold}</td></tr>`)
      .join('');

    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `⚠️ Low Stock Alert — ${lowStockProducts.length} product(s) need attention`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f4a261;">Low Stock Alert ⚠️</h2>
            <p>${lowStockProducts.length} product(s) are below their restock threshold:</p>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
              <thead style="background: #003566; color: white;">
                <tr><th>Product</th><th>Brand</th><th>Stock</th><th>Threshold</th></tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            <a href="${process.env.CLIENT_URL}/admin/products" 
               style="background: #003566; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
              Manage Inventory
            </a>
          </div>
        `,
      }).catch(() => {});

      // In-app notification for admin
      await emitNotification(io, admin._id, {
        title: 'Low Stock Alert',
        message: `${lowStockProducts.length} product(s) are running low on stock. Check inventory now.`,
        type: 'inventory',
        link: '/admin/products',
      });
    }

    console.log(`[Cron] Low stock alerts sent for ${lowStockProducts.length} product(s)`);
  } catch (err) {
    console.error('[Cron] Low stock alerts error:', err.message);
  }
};

// ─────────────────────────────────────────────
// Register all cron jobs
// ─────────────────────────────────────────────
const initCronJobs = (io) => {
  // Abandoned cart recovery: every day at 10:00 AM
  cron.schedule('0 10 * * *', () => runAbandonedCartRecovery(io), { timezone: 'Asia/Kolkata' });

  // Flash sale expiry: every hour
  cron.schedule('0 * * * *', runFlashSaleExpiry);

  // Low stock alerts: every day at 8:00 AM
  cron.schedule('0 8 * * *', () => runLowStockAlerts(io), { timezone: 'Asia/Kolkata' });

  // ── Keep-alive ping: every 14 minutes to prevent Render free tier sleep ──
  const backendUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
  if (backendUrl) {
    const pingUrl = `${backendUrl}/api/health`;
    const client = pingUrl.startsWith('https') ? https : http;
    cron.schedule('*/14 * * * *', () => {
      client.get(pingUrl, (res) => {
        console.log(`[Cron] Keep-alive ping → ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn('[Cron] Keep-alive ping failed:', err.message);
      });
    });
    console.log(`[Cron] Keep-alive ping scheduled → ${pingUrl}`);
  }

  console.log('[Cron] All scheduled jobs initialized');
};

module.exports = { initCronJobs, runAbandonedCartRecovery, runFlashSaleExpiry };
