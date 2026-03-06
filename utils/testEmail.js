/**
 * Run this to test email sending:
 *   node utils/testEmail.js your@email.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const to = process.argv[2];
if (!to) {
  console.error('Usage: node utils/testEmail.js <recipient@email.com>');
  process.exit(1);
}

if (!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY === 'your_brevo_api_key_here') {
  console.error('❌ BREVO_API_KEY is not set in .env — add your real key first.');
  process.exit(1);
}

const senderEmail = process.env.EMAIL_FROM_ADDRESS || 'srimuruganelectricals75@gmail.com';
const senderName  = process.env.EMAIL_FROM_NAME    || 'Electrical Shop';

console.log(`\nSending test email to: ${to}`);
console.log(`From: ${senderName} <${senderEmail}>`);
console.log(`Using Brevo API key: ${process.env.BREVO_API_KEY.slice(0, 8)}...`);

fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: '✅ Email Test — Electrical Shop',
    htmlContent: '<h2>Email is working correctly!</h2><p>Your order confirmation emails will be delivered to customers.</p>',
  }),
})
  .then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`\n❌ FAILED (${res.status}): ${body.message || res.statusText}`);
      console.error('Full error:', JSON.stringify(body, null, 2));
    } else {
      console.log('\n✅ SUCCESS! Email sent. ID:', body.messageId || JSON.stringify(body));
      console.log('Check your inbox (and spam folder).');
    }
  })
  .catch((err) => console.error('\n❌ Exception:', err.message));
