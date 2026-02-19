const Razorpay = require('razorpay');

let razorpayInstance = null;

// Initialize Razorpay only when keys are present so that
// the app can still boot in environments where payments
// are not yet configured (e.g. local development).
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('Razorpay keys are not set in environment variables. Payment endpoints will be disabled.');
}

module.exports = razorpayInstance;
