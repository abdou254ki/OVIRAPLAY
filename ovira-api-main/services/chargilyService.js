const crypto = require('crypto');
const Setting = require('../models/Setting');

const DEFAULT_CONFIG = {
  mode: 'test',
  testPublicKey: process.env.CHARGILY_TEST_PK || '',
  testSecretKey: process.env.CHARGILY_TEST_SK || '',
  livePublicKey: process.env.CHARGILY_LIVE_PK || '',
  liveSecretKey: process.env.CHARGILY_LIVE_SK || '',
  enabled: true
};

async function getChargilyConfig() {
  const doc = await Setting.findOne({ key: 'chargily_config' }).lean();
  const cfg = doc && doc.value ? { ...DEFAULT_CONFIG, ...doc.value } : { ...DEFAULT_CONFIG };
  const isLive = cfg.mode === 'live';
  const publicKey = isLive ? cfg.livePublicKey : cfg.testPublicKey;
  const secretKey = isLive ? cfg.liveSecretKey : cfg.testSecretKey;
  const baseUrl = isLive
    ? 'https://pay.chargily.net/api/v2'
    : 'https://pay.chargily.net/test/api/v2';

  return { ...cfg, isLive, publicKey, secretKey, baseUrl };
}

async function saveChargilyConfig(newValues) {
  const current = await getChargilyConfig();
  const updated = {
    mode: newValues.mode === 'live' ? 'live' : 'test',
    testPublicKey: typeof newValues.testPublicKey === 'string' ? newValues.testPublicKey.trim() : current.testPublicKey,
    testSecretKey: typeof newValues.testSecretKey === 'string' && !newValues.testSecretKey.includes('***') ? newValues.testSecretKey.trim() : current.testSecretKey,
    livePublicKey: typeof newValues.livePublicKey === 'string' ? newValues.livePublicKey.trim() : current.livePublicKey,
    liveSecretKey: typeof newValues.liveSecretKey === 'string' && !newValues.liveSecretKey.includes('***') ? newValues.liveSecretKey.trim() : current.liveSecretKey,
    enabled: newValues.enabled !== undefined ? !!newValues.enabled : current.enabled
  };
  await Setting.findOneAndUpdate(
    { key: 'chargily_config' },
    { value: updated },
    { upsert: true, new: true }
  );
  return getChargilyConfig();
}

async function createCheckoutSession({ order, originUrl, webhookUrl }) {
  const cfg = await getChargilyConfig();
  if (!cfg.secretKey) {
    throw new Error('مفتاح شارجيلي السري غير مضبوط في الإعدادات.');
  }

  const cleanOrigin = (originUrl || process.env.SITE_URL || 'https://rioxstore.shop').replace(/\/$/, '');
  const payload = {
    amount: order.totalPrice,
    currency: 'dzd',
    success_url: `${cleanOrigin}/#/done?order=${encodeURIComponent(order.orderCode)}&paid=1`,
    failure_url: `${cleanOrigin}/#/checkout?error=payment_cancelled`,
    webhook_endpoint: webhookUrl,
    description: `طلب ${order.orderCode} - ${order.customerName}`,
    locale: 'ar',
    metadata: {
      orderCode: order.orderCode,
      orderId: String(order._id),
      customerName: order.customerName,
      whatsappNumber: order.whatsappNumber,
      customerEmail: order.customerEmail || ''
    }
  };

  const response = await fetch(`${cfg.baseUrl}/checkouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || !data.checkout_url) {
    console.error('Chargily checkout error:', data);
    throw new Error(data.message || 'فشل إنشاء رابط الدفع عبر شارجيلي.');
  }

  return {
    checkoutId: data.id,
    checkoutUrl: data.checkout_url,
    mode: cfg.mode
  };
}

async function verifyCheckoutStatus(checkoutId) {
  const cfg = await getChargilyConfig();
  if (!cfg.secretKey || !checkoutId) return null;
  const response = await fetch(`${cfg.baseUrl}/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { 'Authorization': `Bearer ${cfg.secretKey}` }
  });
  if (!response.ok) return null;
  return response.json();
}

function extractPaymentDetails(checkoutData, order) {
  const paidDate = new Date();
  const formattedTime = paidDate.toLocaleString('fr-DZ', { timeZone: 'Africa/Algiers' });
  const customerObj = (checkoutData && checkoutData.customer) || {};
  const meta = (checkoutData && checkoutData.metadata) || {};

  return {
    transactionId: (checkoutData && checkoutData.id) || order.chargilyCheckoutId || '',
    amountPaid: (checkoutData && checkoutData.amount) || order.totalPrice,
    paymentMethodUsed: (checkoutData && checkoutData.payment_method) || 'EDAHABIA / CIB',
    payerName: customerObj.name || meta.customerName || order.customerName,
    payerEmail: customerObj.email || meta.customerEmail || order.customerEmail || 'غير محدد',
    payerPhone: customerObj.phone || meta.whatsappNumber || order.whatsappNumber,
    paidAtFormatted: formattedTime
  };
}

async function verifyWebhookSignature(rawBodyBuffer, signatureHeader) {
  if (!rawBodyBuffer || !signatureHeader) return false;
  const cfg = await getChargilyConfig();
  if (!cfg.secretKey) return false;
  const computed = crypto.createHmac('sha256', cfg.secretKey).update(rawBodyBuffer).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(String(signatureHeader)));
  } catch {
    return false;
  }
}

module.exports = {
  getChargilyConfig,
  saveChargilyConfig,
  createCheckoutSession,
  verifyCheckoutStatus,
  extractPaymentDetails,
  verifyWebhookSignature
};
