// Fast2SMS — free Indian SMS service (requires API key from fast2sms.com)
// Free tier: trial credits on signup, DLT-free Quick SMS route for transactional use.
// API key: Account → Dev API → API KEY in Fast2SMS dashboard.

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

/**
 * Send an SMS via Fast2SMS Quick SMS route.
 * @param {string} phone  - 10-digit Indian mobile number (without +91)
 * @param {string} message - Text message to send (max 160 chars)
 */
const sendSms = async (phone, message) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) throw new Error('FAST2SMS_API_KEY is not set in .env');

  // Normalise: strip +91 or 0 prefix, keep only 10 digits
  const normalised = phone.replace(/^\+91|^91|^0/, '').replace(/\D/g, '');
  if (normalised.length !== 10) {
    throw new Error(`Invalid phone number: ${phone}`);
  }

  const params = new URLSearchParams({
    route: 'q',          // Quick SMS (no DLT registration required)
    message,
    numbers: normalised,
    flash: '0',
  });

  const response = await fetch(`${FAST2SMS_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      authorization: apiKey,
      'Cache-Control': 'no-cache',
    },
  });

  const data = await response.json();

  if (!response.ok || data.return !== true) {
    throw new Error(`Fast2SMS error: ${data.message || JSON.stringify(data)}`);
  }

  return data;
};

/**
 * Send cancel OTP via SMS.
 */
const sendCancelOtpSms = async ({ phone, otp, orderId }) => {
  const message = `Your OTP to cancel Order #${orderId} on Electrical Shop is ${otp}. Valid for 10 minutes. Do not share with anyone.`;
  return sendSms(phone, message);
};

module.exports = { sendSms, sendCancelOtpSms };
