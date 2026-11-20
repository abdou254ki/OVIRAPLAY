const crypto = require('crypto');

const DEFAULT_GOOGLE_CLIENT_ID = '79336176422-fohod45r2nvme8st2kdcreb53fh8q426.apps.googleusercontent.com';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID).trim();
}

// ==================== 1. Google Authenticator (TOTP RFC 6238) ====================

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function generateTotpAtStep(secretBase32, step) {
  const key = base32Decode(secretBase32);
  const counterBuf = Buffer.alloc(8);
  let tmp = BigInt(step);
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = Number(tmp & 0xffn);
    tmp >>= 8n;
  }
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

function verifyTotpToken(secretBase32, userToken) {
  const cleanToken = String(userToken || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken) || !secretBase32) return false;
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  // فحص النافذة الحالية و±30 ثانية لتفادي فرق التوقيت البسيط بين الهاتف والخادم
  for (const offset of [-1, 0, 1]) {
    const expected = generateTotpAtStep(secretBase32, currentStep + offset);
    if (expected === cleanToken) return true;
  }
  return false;
}

function buildOtpAuthUrl({ secret, accountLabel, issuer = 'OVIRA PLAY' }) {
  const cleanIssuer = encodeURIComponent(issuer);
  const cleanLabel = encodeURIComponent(accountLabel || 'User');
  return `otpauth://totp/${cleanIssuer}:${cleanLabel}?secret=${encodeURIComponent(secret)}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// ==================== 2. رموز التحقق عبر بوت تيليغرام (Telegram OTP) ====================

function hashOtpCode(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

function createOtpChallenge() {
  const code = String(crypto.randomInt(100000, 999999));
  const hash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // صالح لمدة 5 دقائق
  return { code, hash, expiresAt };
}

function verifyOtpChallenge(code, storedHash, expiresAt) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean) || !storedHash || !expiresAt) return false;
  if (new Date(expiresAt).getTime() < Date.now()) return false;
  const candidateHash = hashOtpCode(clean);
  try {
    return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

async function sendTelegramOtpMessage(bot, chatId, code, contextLabel = 'تسجيل الدخول') {
  if (!bot || !chatId) {
    throw new Error('حساب تيليغرام غير مربوط أو البوت غير متصل.');
  }
  const message = [
    `🔐 <b>رمز التحقق بخطوتين (2FA) — OVIRA PLAY</b>`,
    `العملية: <b>${contextLabel}</b>`,
    '──────────────',
    `🔢 الكود الخاص بك: <code>${code}</code>`,
    '──────────────',
    '⏳ هذا الرمز صالح لمدة 5 دقائق. لا تشاركه مع أي شخص.'
  ].join('\n');

  await bot.telegram.sendMessage(Number(chatId), message, { parse_mode: 'HTML' });
  return true;
}

// ==================== 3. التحقق من تسجيل الدخول عبر Google ====================

async function verifyGoogleIdToken(idToken) {
  if (!idToken) throw new Error('رمز الدخول من قوقل مفقود.');
  let payload;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('tokeninfo_rejected');
    payload = await res.json();
  } catch (e) {
    console.error('[google] tokeninfo failed:', e.message);
    throw new Error('تعذّر التحقق من صلاحية حساب قوقل.');
  }
  const expectedClientId = getGoogleClientId();
  if (payload.aud !== expectedClientId) {
    throw new Error('معرّف تطبيق قوقل (Client ID) غير مطابق.');
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('البريد الإلكتروني في حساب قوقل غير مؤكّد.');
  }
  return {
    googleId: payload.sub,
    email: String(payload.email || '').trim().toLowerCase(),
    name: String(payload.name || payload.given_name || 'عميل قوقل').trim(),
    picture: payload.picture || ''
  };
}

// ==================== 4. التحقق من تسجيل الدخول عبر Telegram Widget ====================

function verifyTelegramWidgetData(authData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !authData || !authData.hash || !authData.id) {
    return false;
  }
  const authDate = Number(authData.auth_date || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) {
    return false; // انتهت صلاحية التوقيع (أكثر من 24 ساعة)
  }

  const checkList = Object.keys(authData)
    .filter((k) => k !== 'hash' && authData[k] !== undefined && authData[k] !== null && authData[k] !== '')
    .sort()
    .map((k) => `${k}=${authData[k]}`);

  const dataCheckString = checkList.join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(String(authData.hash)));
  } catch {
    return false;
  }
}

module.exports = {
  getGoogleClientId,
  generateTotpSecret,
  verifyTotpToken,
  buildOtpAuthUrl,
  createOtpChallenge,
  verifyOtpChallenge,
  sendTelegramOtpMessage,
  verifyGoogleIdToken,
  verifyTelegramWidgetData
};
