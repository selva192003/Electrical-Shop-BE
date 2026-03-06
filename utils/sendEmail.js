// Brevo (formerly Sendinblue) HTTPS API — works even when SMTP ports are blocked.
// No domain verification needed. Just verify your sender email in Brevo dashboard.
// Free tier: 300 emails/day, sends to ANY recipient.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Basic reusable email sender
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set in .env');

  const senderEmail = process.env.EMAIL_FROM_ADDRESS || 'srimuruganelectricals75@gmail.com';
  const senderName  = process.env.EMAIL_FROM_NAME    || 'Electrical Shop';

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Brevo error ${response.status}: ${errBody.message || response.statusText}`);
  }
};

// Build and send an order confirmation email
const sendOrderConfirmationEmail = async ({ email, name, order }) => {
  const orderId = order._id.toString().slice(-8).toUpperCase();
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const addr = order.shippingAddress;
  const addressLine = [
    addr.fullName,
    addr.addressLine1,
    addr.addressLine2,
    `${addr.city}, ${addr.state} - ${addr.postalCode}`,
    addr.country,
    `Phone: ${addr.phone}`,
  ]
    .filter(Boolean)
    .join('<br>');

  const itemRows = order.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${item.name}${item.variant && (item.variant.watt || item.variant.voltage || item.variant.brand) ? ` <span style="color:#6b7280;font-size:12px;">(${[item.variant.watt, item.variant.voltage, item.variant.brand].filter(Boolean).join(', ')})</span>` : ''}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>`
    )
    .join('');

  const paymentBadgeColor = order.paymentInfo?.method === 'COD' ? '#f59e0b' : '#10b981';
  const paymentLabel = order.paymentInfo?.method === 'COD' ? 'Cash on Delivery' : 'Paid via Razorpay';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">⚡ Electrical Shop</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Your one-stop electrical store</p>
            </td>
          </tr>

          <!-- Success banner -->
          <tr>
            <td style="background:#ecfdf5;padding:20px 40px;text-align:center;border-bottom:1px solid #d1fae5;">
              <p style="margin:0;font-size:22px;">✅</p>
              <h2 style="margin:8px 0 0;color:#065f46;font-size:20px;font-weight:700;">Order Placed Successfully!</h2>
              <p style="margin:6px 0 0;color:#047857;font-size:14px;">Thank you for shopping with us, ${name}!</p>
            </td>
          </tr>

          <!-- Order meta -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;width:50%;">
                    <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Order ID</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e40af;">#${orderId}</p>
                  </td>
                  <td width="16"></td>
                  <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;width:50%;">
                    <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Order Date</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#111827;">${orderDate}</p>
                  </td>
                </tr>
                <tr><td height="12" colspan="3"></td></tr>
                <tr>
                  <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;width:50%;">
                    <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Payment</p>
                    <p style="margin:4px 0 0;"><span style="display:inline-block;background:${paymentBadgeColor};color:#fff;font-size:13px;font-weight:600;padding:3px 10px;border-radius:20px;">${paymentLabel}</span></p>
                  </td>
                  <td width="16"></td>
                  <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;width:50%;">
                    <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Order Status</p>
                    <p style="margin:4px 0 0;"><span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:13px;font-weight:600;padding:3px 10px;border-radius:20px;">${order.orderStatus}</span></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items table -->
          <tr>
            <td style="padding:24px 40px 0;">
              <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">Order Items</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>
                    <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Unit Price</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:16px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:12px;">
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;">Items Subtotal</td>
                  <td style="padding:4px 0;text-align:right;color:#1f2937;font-size:14px;">₹${(order.totalPrice - order.deliveryCharge).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;">Delivery Charge</td>
                  <td style="padding:4px 0;text-align:right;color:#1f2937;font-size:14px;">${order.deliveryCharge === 0 ? '<span style="color:#10b981;font-weight:600;">FREE</span>' : `₹${order.deliveryCharge}`}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 4px;font-size:17px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">Grand Total</td>
                  <td style="padding:12px 0 4px;text-align:right;font-size:17px;font-weight:700;color:#1e40af;border-top:1px solid #e5e7eb;">₹${order.totalPrice.toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping address -->
          <tr>
            <td style="padding:24px 40px 0;">
              <h3 style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827;">Shipping Address</h3>
              <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;border:1px solid #e5e7eb;font-size:14px;color:#374151;line-height:1.7;">
                ${addressLine}
              </div>
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                  📦 We will notify you as your order progresses through each stage.<br>
                  For any queries, reply to this email or visit our support center.
                </p>
              </div>
            </td>
          </tr>

          <!-- Bottom bar -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Electrical Shop. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

  await sendEmail({
    to: email,
    subject: `Order Confirmed – #${orderId} | Electrical Shop`,
    html,
  });
};

// Send OTP email for cancel verification
const sendCancelOtpEmail = async ({ email, name, otp, orderId }) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">⚡ Electrical Shop</h1>
              <p style="margin:8px 0 0;color:#fecaca;font-size:13px;">Order Cancellation Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hi <strong>${name}</strong>,</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
                We received a request to cancel order <strong>#${orderId}</strong>.<br>
                Use the OTP below to confirm the cancellation.
              </p>

              <!-- OTP box -->
              <div style="display:inline-block;background:#fef2f2;border:2px dashed #fca5a5;border-radius:12px;padding:24px 48px;margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Your OTP</p>
                <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#dc2626;">${otp}</p>
              </div>

              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
                This OTP is valid for <strong style="color:#374151;">10 minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                If you did not request this, please ignore this email — your order will remain active.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Electrical Shop. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

  await sendEmail({
    to: email,
    subject: `${otp} is your OTP to cancel Order #${orderId} | Electrical Shop`,
    html,
  });
};

module.exports = sendEmail;
module.exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
module.exports.sendCancelOtpEmail = sendCancelOtpEmail;
