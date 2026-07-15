// ── M-Pesa / Daraja API Helper (Tanzania) ────────────────────────────────────
// Weka kwenye .env:
//   DARAJA_CONSUMER_KEY=xxx
//   DARAJA_CONSUMER_SECRET=xxx
//   DARAJA_SHORTCODE=xxx         (Business Shortcode)
//   DARAJA_PASSKEY=xxx           (Lipa Na M-Pesa passkey)
//   DARAJA_CALLBACK_URL=https://yourdomain.com/mpesa/callback
//
// Jiandikishe Daraja: https://developer.safaricom.co.ke

const COMMISSION_RATE = 0.10; // 10% ya kamisheni ya jukwaa

/**
 * Pata Access Token kutoka Daraja API.
 */
async function getAccessToken() {
  if (!process.env.DARAJA_CONSUMER_KEY) {
    console.warn('[M-Pesa] Daraja credentials hazijapatikana. Tumia placeholder mode.');
    return 'PLACEHOLDER_TOKEN';
  }
  try {
    const axios = require('axios');
    const auth = Buffer.from(
      `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
    ).toString('base64');
    const res = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return res.data.access_token;
  } catch (err) {
    console.error('[M-Pesa] Token error:', err.message);
    return null;
  }
}

/**
 * Tuma STK Push kwa mtumiaji kumwomba alipe.
 * @param {string} phone   - Namba ya simu (mfano: 0712345678)
 * @param {number} amount  - Kiasi cha malipo (TZS)
 * @param {number} jobId   - ID ya kazi
 */
async function initiateSTKPush(phone, amount, jobId) {
  // Badilisha format ya namba: 0712... → 255712...
  const formattedPhone = phone.replace(/^0/, '255');

  if (!process.env.DARAJA_CONSUMER_KEY) {
    // ── PLACEHOLDER MODE ──────────────────────────────────────────────────
    console.log(`[M-Pesa PLACEHOLDER] STK Push → ${formattedPhone} | TZS ${amount} | Job #${jobId}`);
    return { success: true, checkoutRequestId: `MOCK_${Date.now()}`, mode: 'placeholder' };
  }

  try {
    const axios = require('axios');
    const token = await getAccessToken();
    if (!token) return { success: false };

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`
    ).toString('base64');

    const res = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: formattedPhone,
        PartyB: process.env.DARAJA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.DARAJA_CALLBACK_URL,
        AccountReference: `GigLink-Job-${jobId}`,
        TransactionDesc: `GigLink Job #${jobId}`
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true, checkoutRequestId: res.data.CheckoutRequestID };
  } catch (err) {
    console.error('[M-Pesa] STK Push error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Hesabu kamisheni na kiasi cha Freelancer.
 */
function calculateCommission(amount) {
  const commission = parseFloat((amount * COMMISSION_RATE).toFixed(2));
  const freelancerAmount = parseFloat((amount - commission).toFixed(2));
  return { commission, freelancerAmount };
}

module.exports = { initiateSTKPush, calculateCommission, COMMISSION_RATE };
