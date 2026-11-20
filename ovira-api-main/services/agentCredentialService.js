const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const AgentCredential = require('../models/AgentCredential');
const AgentSettings = require('../models/AgentSettings');
const Audit = require('../models/Audit');
const { verifyTotpToken, verifyOtpChallenge, createOtpChallenge, sendTelegramOtpMessage } = require('./authService');
const { bot } = require('../bot/telegram');

const POLICY = Object.freeze({ replyMode: 'assist', costPolicy: 'free', maxMessagesPerHour: 20 });
const tokenHash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safeName = (name) => typeof name === 'string' && /^[a-zA-Z0-9 _-]{3,64}$/.test(name.trim());

function fail(code, message, status = 400) { const err = new Error(message); err.code = code; err.httpStatus = status; throw err; }

async function audit(admin, action, entityId, summary) {
  // نمنع النجاح الصامت في العمليات الحساسة إذا تعذّر حفظ أثرها.
  await Audit.create({ adminId: Number(admin.telegramId) || 0, action, entity: 'LocalAgent', entityId: String(entityId), summary });
}

async function getSummary() {
  const [settings, credential] = await Promise.all([
    AgentSettings.findById('local-agent-v1').lean(),
    AgentCredential.findOne({ status: { $in: ['pending', 'active'] }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean()
  ]);
  const cfg = settings || {};
  const fresh = !!credential?.lastHeartbeatAt && Date.now() - new Date(credential.lastHeartbeatAt).getTime() < 120000;
  const status = cfg.killSwitch ? 'stopped' : !credential ? 'unpaired' : fresh ? 'connected' : credential.status === 'pending' ? 'pending' : 'offline';
  const running = process.env.AI_EXECUTION_ENABLED === 'true' && !!cfg.enabled && !!cfg.executionEnabled && !cfg.killSwitch;
  return {
    status, enabled: running, executionEnabled: running, killSwitch: !!cfg.killSwitch,
    mode: running ? 'assist' : 'shadow', replyMode: 'assist', costPolicy: 'free',
    maxMessagesPerHour: Number(cfg.maxMessagesPerHour) || POLICY.maxMessagesPerHour,
    supportHumanOnly: cfg.supportHumanOnly !== false,
    autoSiteFaqEnabled: cfg.supportHumanOnly === false && process.env.AI_SITE_AUTO_FAQ_ALLOWED === 'true' && !!cfg.autoSiteFaqEnabled,
    autoSiteRepliesEnabled: cfg.supportHumanOnly === false && process.env.AI_SITE_AUTO_REPLY_ALLOWED === 'true' && !!cfg.autoSiteRepliesEnabled,
    credential: credential ? {
      id: String(credential._id), deviceName: credential.deviceName, createdAt: credential.createdAt,
      expiresAt: credential.expiresAt, lastHeartbeatAt: credential.lastHeartbeatAt, workerVersion: credential.workerVersion || ''
    } : null,
    serverUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://ovira-api.onrender.com',
    generatedAt: new Date().toISOString(),
    note: running ? 'استنتاج Qwen يعمل للمسودات فقط؛ لا يوجد إرسال WhatsApp تلقائي أو عمليات مالية.' : 'الاتصال فقط؛ مهام Qwen تتطلب تفعيل AI_EXECUTION_ENABLED وموافقة المالك بخطوتين.'
  };
}

async function requestTelegramStepUp(adminId, password) {
  const admin = await Admin.findById(adminId);
  if (!admin?.twoFactorEnabled || admin.twoFactorMethod !== 'telegram' || !admin.telegramId)
    fail('TWO_FACTOR_REQUIRED', 'فعّل التحقق بخطوتين عبر تيليغرام أولاً.', 428);
  if (typeof password !== 'string' || !await bcrypt.compare(password, admin.passwordHash || ''))
    fail('BAD_REAUTH', 'كلمة السر الحالية غير صحيحة.', 401);
  const challenge = createOtpChallenge();
  admin.agentStepUpHash = challenge.hash;
  admin.agentStepUpExpiresAt = challenge.expiresAt;
  admin.agentStepUpAttempts = 0;
  await admin.save();
  // لا يُحفظ رمز OTP الخام في القاعدة ولا يُرسل إلى المتصفح.
  await sendTelegramOtpMessage(bot, admin.telegramId, challenge.code, 'ربط أو إلغاء وكيل الهاتف');
}

async function requireStepUp(adminId, password, code) {
  const admin = await Admin.findById(adminId);
  if (!admin || !admin.active || admin.role !== 'owner') fail('FORBIDDEN', 'للمالك فقط.', 403);
  if (!admin.twoFactorEnabled) fail('TWO_FACTOR_REQUIRED', 'يجب تفعيل 2FA قبل إدارة مفاتيح الوكيل.', 428);
  if (typeof password !== 'string' || !await bcrypt.compare(password, admin.passwordHash || ''))
    fail('BAD_REAUTH', 'كلمة السر الحالية غير صحيحة.', 401);
  let valid = false;
  if (admin.twoFactorMethod === 'totp') valid = verifyTotpToken(admin.totpSecret, code);
  else if (admin.twoFactorMethod === 'telegram' && (admin.agentStepUpAttempts || 0) < 5) {
    valid = verifyOtpChallenge(code, admin.agentStepUpHash, admin.agentStepUpExpiresAt);
    admin.agentStepUpAttempts = (admin.agentStepUpAttempts || 0) + 1;
    if (valid || admin.agentStepUpAttempts >= 5) {
      admin.agentStepUpHash = '';
      admin.agentStepUpExpiresAt = null;
    }
    await admin.save();
  }
  if (!valid) fail('BAD_OTP', 'رمز التحقق غير صحيح أو منتهي الصلاحية.', 401);
  return admin;
}

async function issueCredential(admin, deviceName) {
  if (!safeName(deviceName)) fail('BAD_NAME', 'اسم الجهاز 3–64 حرفًا لاتينيًا أو رقمًا أو - أو _.');
  const raw = 'ovira_agent_' + crypto.randomBytes(32).toString('base64url');
  // لا نسمح ببقاء توكنين صالحين؛ إذا فشل التدقيق يُلغى الجديد.
  await AgentCredential.updateMany({ status: { $in: ['pending', 'active'] } }, { $set: { status: 'revoked', revokedAt: new Date() } });
  const credential = await AgentCredential.create({
    deviceName: deviceName.trim(), tokenHash: tokenHash(raw), createdByAdminId: admin._id,
    expiresAt: new Date(Date.now() + 90 * 86400000)
  });
  try { await audit(admin, 'AI_AGENT_TOKEN_ISSUED', credential._id, 'إنشاء رمز محدود للنبضات والاستنتاج النصي فقط؛ إبطال الرموز الأقدم.'); }
  catch (err) { await AgentCredential.updateOne({ _id: credential._id }, { $set: { status: 'revoked', revokedAt: new Date() } }); throw err; }
  return { token: raw, expiresAt: credential.expiresAt }; // يظهر مرة واحدة فقط في POST
}

async function revokeCredential(admin, reason = 'owner-request') {
  const result = await AgentCredential.updateMany({ status: { $in: ['pending', 'active'] } }, { $set: { status: 'revoked', revokedAt: new Date() } });
  await audit(admin, 'AI_AGENT_TOKEN_REVOKED', 'local-agent-v1', `إلغاء مفاتيح الربط (عدد ${result.modifiedCount})؛ ${String(reason).slice(0,40)}`);
  return { revoked: result.modifiedCount };
}

async function setKillSwitch(admin) {
  await AgentSettings.findByIdAndUpdate('local-agent-v1', {
    $set: { enabled: false, executionEnabled: false, killSwitch: true, updatedByAdminId: admin._id }
  }, { upsert: true, new: true, runValidators: true });
  await AgentCredential.updateMany({ status: { $in: ['pending', 'active'] } }, { $set: { status: 'revoked', revokedAt: new Date() } });
  await audit(admin, 'AI_AGENT_KILL_SWITCH', 'local-agent-v1', 'إيقاف طارئ وإبطال جميع المفاتيح.');
}

async function enableDraftExecution(admin) {
  if (process.env.AI_EXECUTION_ENABLED !== 'true') fail('FEATURE_DISABLED', 'فعّل AI_EXECUTION_ENABLED في Render بعد الاختبارات أولاً.', 423);
  const credential = await AgentCredential.findOne({ status: 'active', expiresAt: { $gt: new Date() }, lastHeartbeatAt: { $gt: new Date(Date.now() - 120000) } });
  if (!credential) fail('AGENT_OFFLINE', 'يجب ربط الهاتف ووجود Heartbeat حديث خلال دقيقتين قبل التفعيل.', 409);
  const settings = await AgentSettings.findById('local-agent-v1');
  if (settings?.killSwitch) fail('KILL_SWITCH', 'أزل الإيقاف الطارئ وأعد إصدار رمز الهاتف أولاً.', 423);
  await audit(admin, 'AI_DRAFT_EXECUTION_ENABLED', 'local-agent-v1', 'تفعيل توليد مسودات Qwen فقط دون إرسال أو تغيير الطلبات.');
  await AgentSettings.findByIdAndUpdate('local-agent-v1', { $set: {
    enabled: true, executionEnabled: true, mode: 'assist', replyMode: 'assist', costPolicy: 'free',
    maxMessagesPerHour: 20, updatedByAdminId: admin._id
  } }, { upsert: true, runValidators: true });
}
async function pauseDraftExecution(admin) {
  await AgentSettings.findByIdAndUpdate('local-agent-v1', { $set: { enabled: false, executionEnabled: false, mode: 'shadow', updatedByAdminId: admin._id } }, { upsert: true, runValidators: true });
  await audit(admin, 'AI_DRAFT_EXECUTION_PAUSED', 'local-agent-v1', 'إيقاف المهام الجديدة مع إبقاء اقتران الهاتف.');
}
async function restoreConnection(admin) {
  // استعادة الاتصال فقط؛ لا تفعّل مهام أو ردود AI.
  await audit(admin, 'AI_AGENT_RESTORE_CONNECTION', 'local-agent-v1', 'استعادة السماح بالـHeartbeat فقط؛ AI execution يبقى معطلاً.');
  await AgentSettings.findByIdAndUpdate('local-agent-v1', {
    $set: { enabled: false, executionEnabled: false, killSwitch: false, updatedByAdminId: admin._id }
  }, { upsert: true, runValidators: true });
}
async function setSiteAutoFaq(admin, enabled) {
  if(enabled && process.env.AI_SITE_AUTO_FAQ_ALLOWED !== 'true')
    fail('FEATURE_DISABLED','فعّل AI_SITE_AUTO_FAQ_ALLOWED في Render بعد اختبار Qwen وصحة الأسئلة الشائعة.',423);
  // This does not enable WhatsApp or financial actions.
  await audit(admin,enabled?'AI_SITE_FAQ_ENABLED':'AI_SITE_FAQ_DISABLED','local-agent-v1','تم ضبط الأجوبة الآلية الثابتة للأسئلة العامة على موقع المتجر فقط.');
  await AgentSettings.findByIdAndUpdate('local-agent-v1',{$set:{autoSiteFaqEnabled:!!enabled,updatedByAdminId:admin._id}},{upsert:true,runValidators:true});
}
async function setSiteAutoReplies(admin, enabled) {
  if (enabled && process.env.AI_SITE_AUTO_REPLY_ALLOWED !== 'true')
    fail('FEATURE_DISABLED','فعّل AI_SITE_AUTO_REPLY_ALLOWED في Render بعد اختبار واجهة الرسائل والسماح للمالك.',423);
  await audit(admin,enabled?'AI_SITE_REPLY_ENABLED':'AI_SITE_REPLY_DISABLED','local-agent-v1',
    enabled?'تفعيل ردود Qwen العامة على موقع المتجر فقط مع عزل الحسابات.':'إيقاف ردود Qwen التلقائية.');
  await AgentSettings.findByIdAndUpdate('local-agent-v1',{$set:{autoSiteRepliesEnabled:!!enabled,updatedByAdminId:admin._id}},{upsert:true,runValidators:true});
}
async function setHumanSupport(admin, human) {
  if (human) {
    // Immediate global server-side cut-off. No credential revocation.
    await AgentSettings.findByIdAndUpdate('local-agent-v1',{$set:{supportHumanOnly:true,autoSiteRepliesEnabled:false,autoSiteFaqEnabled:false,updatedByAdminId:admin._id}},{upsert:true,runValidators:true});
    const Conversation=require('../models/Conversation');
    const AgentJob=require('../models/AgentJob');
    await Conversation.updateMany({channel:'site',aiMode:'assist'},{$set:{aiMode:'human'}});
    await AgentJob.updateMany({kind:'conversation_draft',status:{$in:['queued','leased']}},{$set:{status:'cancelled'}});
  } else {
    // AI connection can be re-enabled later, but each customer's chat remains human until explicitly reassigned.
    await AgentSettings.findByIdAndUpdate('local-agent-v1',{$set:{supportHumanOnly:false,updatedByAdminId:admin._id}},{upsert:true,runValidators:true});
  }
  await audit(admin,human?'SUPPORT_HUMAN_ONLY':'SUPPORT_AI_READY','local-agent-v1',human?'تم إيقاف الرد التلقائي للموقع مع إبقاء اقتران الوكيل.':'السماح بتكامل AI؛ لا تفعيل تلقائي في محادثات الزبائن.');
}
module.exports = { setHumanSupport, setSiteAutoReplies, setSiteAutoFaq, getSummary, requestTelegramStepUp, requireStepUp, issueCredential, revokeCredential, setKillSwitch, restoreConnection, enableDraftExecution, pauseDraftExecution, tokenHash, fail };
