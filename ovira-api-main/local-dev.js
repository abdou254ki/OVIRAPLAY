require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let child;

const localEnv = {
  ...process.env,
  PORT: '5001',
  CORS_ORIGINS: 'http://127.0.0.1:5511,http://localhost:5511',
  SITE_URL: 'http://127.0.0.1:5511',
  PUBLIC_URL: '',
  RENDER_EXTERNAL_URL: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_BOT_USERNAME: '',
  TELEGRAM_WEBHOOK_SECRET: '',
  TELEGRAM_ADMIN_IDS: '',
  BACKUP_KEY: '',
  BACKUP_CHAT_ID: '',
  CHARGILY_TEST_PK: '',
  CHARGILY_TEST_SK: '',
  CHARGILY_LIVE_PK: '',
  CHARGILY_LIVE_SK: '',
  WHATSAPP_INBOUND_ENABLED: 'false',
  WHATSAPP_VERIFY_TOKEN: '',
  WHATSAPP_APP_SECRET: '',
  WHATSAPP_PHONE_NUMBER_ID: '',
  RENEWAL_AUTO_REMINDERS: 'false',
  AI_CREDENTIALS_ENABLED: 'false',
  AI_EXECUTION_ENABLED: 'false',
  AI_AUTO_DECISIONS_ENABLED: 'false',
  AI_WHATSAPP_SEND_ENABLED: 'false',
  AI_SITE_AUTO_FAQ_ALLOWED: 'false',
  AI_SITE_AUTO_REPLY_ALLOWED: 'false'
};

async function main() {
  const dataPath = path.resolve(__dirname, '..', 'data', 'mongodb');
  fs.mkdirSync(dataPath, { recursive: true });

  console.log('[LOCAL] Starting isolated MongoDB for ovira_play_dev...');
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: {
      dbPath: dataPath,
      dbName: 'ovira_play_dev',
      port: 27018,
      storageEngine: 'wiredTiger'
    }
  });

  localEnv.MONGODB_URI = mongod.getUri('ovira_play_dev');

  // Seed a fake local payment method so the test site never displays real
  // bank/account identifiers and cannot send a real Chargily payment.
  await mongoose.connect(localEnv.MONGODB_URI);
  const Setting = require('./models/Setting');
  const localPaymentMethods = {
    chargily: { enabled: false, label: '', value: '', note: 'LOCAL TEST ONLY' },
    wallet: { enabled: false, label: '', value: '', note: 'LOCAL TEST ONLY' },
    baridimob: {
      enabled: true,
      label: 'TEST ONLY',
      value: 'LOCAL-TEST-ONLY',
      note: 'Ù…Ø­Ø§ÙƒØ§Ø© Ù…Ø­Ù„ÙŠØ© ÙÙ‚Ø· â€” Ù„Ø§ ØªØ±Ø³Ù„ Ø£ÙŠ Ø£Ù…ÙˆØ§Ù„.'
    },
    binance: { enabled: false, label: '', value: '', note: 'LOCAL TEST ONLY' },
    redotpay: { enabled: false, label: '', value: '', note: 'LOCAL TEST ONLY' },
    bybit: { enabled: false, label: '', value: '', note: 'LOCAL TEST ONLY' }
  };
  await Setting.findOneAndUpdate(
    { key: 'payment_methods' },
    { value: localPaymentMethods },
    { upsert: true, new: true }
  );
  await mongoose.disconnect();

  console.log('[LOCAL] MongoDB database: ovira_play_dev');
  console.log('[LOCAL] Real payment keys, Telegram and public webhooks are disabled.');
  console.log('[LOCAL] Starting API at http://127.0.0.1:5001');

  child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: localEnv,
    stdio: 'inherit'
  });

  child.on('exit', async (code) => {
    try {
      if (mongod) await mongod.stop();
    } catch (e) {
      console.error('[LOCAL] MongoDB shutdown:', e.message);
    }
    process.exit(code || 0);
  });
}

process.on('SIGINT', () => {
  if (child && !child.killed) child.kill('SIGINT');
});
process.on('SIGTERM', () => {
  if (child && !child.killed) child.kill('SIGTERM');
});

main().catch(async (err) => {
  console.error('[LOCAL] Startup failed:', err.message);
  try {
    if (mongod) await mongod.stop();
  } catch (_) {}
  process.exit(1);
});