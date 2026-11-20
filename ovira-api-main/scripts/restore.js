const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
require('dotenv').config();

const filePath = process.argv[2];
const isLive = process.argv[3];
const BACKUP_KEY = process.env.BACKUP_KEY;

if (!filePath || !BACKUP_KEY) {
  console.log('الاستعمال: node scripts/restore.js <file.enc> [--live]');
  process.exit(1);
}

try {
  const data = fs.readFileSync(filePath);
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const key = Buffer.from(BACKUP_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let compressed = decipher.update(encrypted);
  compressed = Buffer.concat([compressed, decipher.final()]);
  const jsonStr = zlib.gunzipSync(compressed).toString('utf8');
  const db = JSON.parse(jsonStr);
  
  console.log('✅ تم فك التشفير بنجاح. المجموعات المحفوظة:');
  Object.keys(db).forEach(k => console.log(` - ${k}: ${db[k].length} سجل`));
  
  if (isLive === '--live') {
    console.log('⚠️ لإعادة البيانات، يجب مسح القاعدة الحالية وإدخال هذه المجموعات يدوياً لحماية بياناتك من الكتابة العكسية الخاطئة.');
    fs.writeFileSync('restored_data.json', jsonStr);
    console.log('تم حفظ البيانات في ملف restored_data.json');
  } else {
    console.log('\n💡 هذا وضع المعاينة (dry-run). البيانات سليمة 100%.');
  }
} catch (e) {
  console.error('❌ فشل فك التشفير. تأكد من أن مفتاح BACKUP_KEY متطابق وأن الملف لم يتلف:', e.message);
}
