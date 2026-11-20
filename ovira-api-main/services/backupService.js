const crypto = require('crypto');
const zlib = require('zlib');
const mongoose = require('mongoose');
const Setting = require('../models/Setting');

const { BACKUP_KEY, BACKUP_CHAT_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_IDS } = process.env;

async function sendDocumentNative(chatId, buffer, filename, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId).trim());
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  form.append('document', blob, filename);

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: form
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `HTTP ${res.status}`);
  }
  return true;
}

async function performBackup() {
  if (!BACKUP_KEY || BACKUP_KEY.length !== 64 || !TELEGRAM_BOT_TOKEN) {
    console.error('Backup skipped: Invalid BACKUP_KEY or missing TELEGRAM_BOT_TOKEN');
    return false;
  }
  try {
    const db = {};
    for (const modelName of mongoose.modelNames()) {
      db[modelName] = await mongoose.model(modelName).find({}).lean();
    }
    const jsonStr = JSON.stringify(db);
    const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'));

    const iv = crypto.randomBytes(12);
    const key = Buffer.from(BACKUP_KEY, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(compressed);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([iv, authTag, encrypted]);
    const hash = crypto.createHash('sha256').update(finalBuffer).digest('hex').slice(0, 8);
    const filename = `ovira_backup_${new Date().toISOString().slice(0, 10)}_${hash}.enc`;
    const caption = `💾 <b>نسخة احتياطية مشفرة</b>\n📅 ${new Date().toLocaleString('fr-DZ', { timeZone: 'Africa/Algiers' })}\n📦 الحجم: ${(finalBuffer.length / 1024).toFixed(2)} KB`;

    const primaryAdmin = (TELEGRAM_ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)[0];
    const targetChat = BACKUP_CHAT_ID ? BACKUP_CHAT_ID.trim() : primaryAdmin;

    try {
      await sendDocumentNative(targetChat, finalBuffer, filename, caption);
    } catch (channelErr) {
      // إذا فشل الإرسال للقناة نرسلها مباشرة لحساب المدير الخاص حتى لا تضيع أبداً
      if (primaryAdmin && String(primaryAdmin) !== String(targetChat)) {
        await sendDocumentNative(primaryAdmin, finalBuffer, filename, caption);
      } else {
        throw channelErr;
      }
    }

    await Setting.findOneAndUpdate({ key: 'last_backup' }, { value: Date.now() }, { upsert: true });
    return true;
  } catch (e) {
    console.error('Backup failed:', e.message);
    return false;
  }
}

function initBackupJob(bot) {
  setInterval(async () => {
    const last = await Setting.findOne({ key: 'last_backup' }).lean();
    const lastTime = last ? Number(last.value) || 0 : 0;
    if (Date.now() - lastTime > 24 * 60 * 60 * 1000) {
      await performBackup(bot);
    }
  }, 60 * 60 * 1000);
}

module.exports = { performBackup, initBackupJob };
