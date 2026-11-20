const express = require('express');
const rateLimit = require('express-rate-limit');
const svc = require('../services/agentCredentialService');
const AgentJob = require('../models/AgentJob');
const SupportMessage = require('../models/SupportMessage');
const jobs = require('../services/agentJobService');
const { safeForAI } = require('../services/agentPolicyService');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const SESSION_SECONDS=15*60;
async function authorizeRoutine(req) {
  const value=req.get('x-ai-control-session')||'';
  if(value) {
    let decoded;
    try {decoded=jwt.verify(value,process.env.JWT_SECRET,{algorithms:['HS256'],audience:'ovira-ai-control',issuer:'ovira-api'});}
    catch(_){return svc.fail('CONTROL_SESSION_INVALID','جلسة التحكم انتهت. أعد التحقق مرة واحدة.',401);}
    if(decoded.sub!==String(req.admin.id)||decoded.tv!==(req.admin.tokenVersion||0)||decoded.scope!=='routine')
      return svc.fail('CONTROL_SESSION_INVALID','جلسة التحكم غير صالحة.',401);
    return Admin.findById(req.admin.id);
  }
  return svc.requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
}

const Customer = require('../models/Customer');
const Audit = require('../models/Audit');
const router = express.Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
function handle(err, req, res, next) {
  if (err.httpStatus) return res.status(err.httpStatus).json({ success: false, code: err.code, message: err.message });
  return next(err);
}
router.post('/control-session',limiter,async(req,res,next)=>{
  try{
    const admin=await svc.requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
    const controlSession=jwt.sign({scope:'routine',tv:req.admin.tokenVersion||0},process.env.JWT_SECRET,{algorithm:'HS256',subject:String(admin._id),issuer:'ovira-api',audience:'ovira-ai-control',expiresIn:SESSION_SECONDS});
    res.set('Cache-Control','no-store');res.json({success:true,controlSession,expiresIn:SESSION_SECONDS});
  }catch(e){handle(e,req,res,next)}
});
router.post('/human-support',limiter,async(req,res,next)=>{
 try{
  if(typeof req.body?.humanOnly!=='boolean')return res.sendStatus(400);
  // Turning automation OFF is immediate for an authenticated owner; enabling needs a fresh step-up session.
  const admin=req.body.humanOnly?await Admin.findById(req.admin.id):await authorizeRoutine(req);
  await svc.setHumanSupport(admin,req.body.humanOnly);
  res.json({success:true,humanOnly:req.body.humanOnly});
 }catch(e){handle(e,req,res,next)}
});
router.get('/settings', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json({ success: true, ai: await svc.getSummary() }); } catch (e) { next(e); }
});
router.get('/status', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json({ success: true, ai: await svc.getSummary() }); } catch (e) { next(e); }
});
router.post('/step-up/telegram', limiter, async (req, res, next) => {
  try {
    await svc.requestTelegramStepUp(req.admin.id, req.body?.currentPassword);
    res.json({ success: true, message: 'أُرسل رمز تحقق جديد إلى حساب تيليغرام الخاص بالمالك.' });
  } catch (e) { handle(e, req, res, next); }
});
router.post('/credentials', limiter, async (req, res, next) => {
  if (process.env.AI_CREDENTIALS_ENABLED !== 'true') return res.status(423).json({success:false,code:'FEATURE_DISABLED',message:'إصدار رمز الربط معطّل حتى تجهّز فهارس MongoDB في بيئة اختبار وتسمح بتفعيل AI_CREDENTIALS_ENABLED.'});
  try {
    const admin = await svc.requireStepUp(req.admin.id, req.body?.currentPassword, req.body?.code);
    const result = await svc.issueCredential(admin, req.body?.deviceName);
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ success: true, pairingToken: result.token, expiresAt: result.expiresAt, message: 'انسخ الرمز الآن؛ لن يُعرض مرة أخرى.' });
  } catch (e) { handle(e, req, res, next); }
});
router.post('/credentials/revoke', limiter, async (req, res, next) => {
  try {
    const admin = await svc.requireStepUp(req.admin.id, req.body?.currentPassword, req.body?.code);
    const result = await svc.revokeCredential(admin);
    res.json({ success: true, ...result });
  } catch (e) { handle(e, req, res, next); }
});
router.post('/kill-switch', limiter, async (req, res, next) => {
  try {
    const admin = await svc.requireStepUp(req.admin.id, req.body?.currentPassword, req.body?.code);
    await svc.setKillSwitch(admin);
    res.json({ success: true, message: 'تم إيقاف الربط وإبطال جميع مفاتيح الهاتف.' });
  } catch (e) { handle(e, req, res, next); }
});
router.post('/restore-connection', limiter, async (req, res, next) => {
  try {
    const admin = await svc.requireStepUp(req.admin.id, req.body?.currentPassword, req.body?.code);
    await svc.restoreConnection(admin);
    res.json({ success: true, message:'عاد السماح بربط الهاتف. يلزم إصدار رمز جديد؛ التنفيذ الآلي ما زال معطلاً.' });
  } catch (e) { handle(e, req, res, next); }
});
// Owner step-up and Render flag are mandatory. This only enables Qwen drafting (NO WhatsApp sends).
router.post('/enable-drafts', limiter, async (req, res, next) => {
  try {
    const admin = await authorizeRoutine(req)
    await svc.enableDraftExecution(admin);
    res.json({ success:true, message:'تم تفعيل إعداد مسودات Qwen فقط؛ رسائل WhatsApp تبقى للمراجعة البشرية.' });
  } catch (e) { handle(e, req, res, next); }
});
router.post('/pause-drafts', limiter, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id)
    await svc.pauseDraftExecution(admin);
    res.json({ success:true, message:'تم إيقاف توليد مسودات جديدة مؤقتًا.' });
  } catch (e) { handle(e, req, res, next); }
});
router.post('/site-auto-faq/:action', limiter, async(req,res,next)=>{
  try {
    if(!['enable','disable'].includes(req.params.action))return res.sendStatus(404);
    const admin=(req.params.action==='disable'?await Admin.findById(req.admin.id):await authorizeRoutine(req))
    await svc.setSiteAutoFaq(admin,req.params.action==='enable');
    res.json({success:true,message:req.params.action==='enable'?'تفعيل إجابات الموقع المعتمدة فقط':'تم تعطيل الإجابات الآلية للموقع'});
  }catch(e){handle(e,req,res,next);}
});
// Explicit, step-up protected opt-in for model replies to low-risk site chats.
// Owner training never sends its test output to customers.
router.post('/site-auto-replies/:action',limiter,async(req,res,next)=>{
  try {
    if(!['enable','disable'].includes(req.params.action))return res.sendStatus(404);
    const admin=(req.params.action==='disable'?await Admin.findById(req.admin.id):await authorizeRoutine(req))
    await svc.setSiteAutoReplies(admin,req.params.action==='enable');
    res.json({success:true,message:req.params.action==='enable'?'تم تفعيل ردود Qwen العامة على الموقع؛ المسائل الحساسة تبقى بشرية.':'تم تعطيل ردود Qwen التلقائية.'});
  }catch(e){handle(e,req,res,next);}
});
// One-time owner-generated account-support verification: identity proof only.
// The support token NEVER grants payment, credential, customer-write, or Qwen privileges.
router.post('/support-code',limiter,async(req,res,next)=>{
  try {
    const admin=await svc.requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
    if(!mongoose.isValidObjectId(req.body?.customerId))return res.status(400).json({success:false,code:'INVALID_CUSTOMER'});
    const customer=await Customer.findById(req.body.customerId);
    if(!customer || customer.blocked)return res.status(404).json({success:false,code:'CUSTOMER_NOT_FOUND'});
    const raw='OVS-'+crypto.randomBytes(9).toString('hex').toUpperCase();
    customer.supportCodeHash=crypto.createHash('sha256').update(raw).digest('hex');
    customer.supportCodeExpiresAt=new Date(Date.now()+15*60*1000);
    customer.supportVerifiedUntil=undefined;
    await customer.save();
    await Audit.create({adminId:Number(admin.telegramId)||0,action:'SUPPORT_CODE_ISSUED',entity:'Customer',entityId:String(customer._id),summary:'إصدار رمز دعم لمرة واحدة ولحساب محدد دون صلاحيات تغيير البيانات.'});
    // No code in logs or audit records; issue only after step-up.
    res.set('Cache-Control','no-store');res.status(201).json({success:true,code:raw,expiresAt:customer.supportCodeExpiresAt,
      message:'انسخ الرمز مرة واحدة وأرسله للزبون عبر قناة موثوقة؛ يستعمله داخل حسابه فقط.'});
  }catch(e){handle(e,req,res,next);}
});
router.get('/jobs', async (_req, res, next) => {
  try {
    const [rows, counts] = await Promise.all([
      AgentJob.find({}, { kind:1,status:1,attempts:1,createdAt:1,completedAt:1,errorCode:1,resultText:1 }).sort({createdAt:-1}).limit(30).lean(),
      AgentJob.aggregate([{ $group:{_id:'$status', count:{$sum:1}} }])
    ]);
    res.set('Cache-Control','no-store');
    res.json({success:true, jobs:rows, counts:Object.fromEntries(counts.map(x=>[x._id,x.count]))});
  } catch(e){next(e);}
});
router.post('/test-job', limiter, async (req, res, next) => {
  try {
    const cfg = await svc.getSummary();
    if (!cfg.executionEnabled) return res.status(423).json({success:false,code:'EXECUTION_DISABLED',message:'فعّل مسودات Qwen بعد الاتصال أولاً.'});
    const text = String(req.body?.text || '').trim();
    if (!text || text.length > 1200 || /[\u0000-\u0008\u000b\u000e-\u001f]/.test(text))
      return res.status(400).json({success:false,code:'INVALID_TEST_PROMPT',message:'اكتب سؤال اختبار صالحًا حتى 1200 حرف. لا تضع أسرارًا حقيقية في الاختبار.'});
    const row = await jobs.enqueue('test_prompt', 'test:' + require('crypto').randomUUID(), text);
    res.status(201).json({success:true,id:row._id,message:'تمت إضافة مهمة اختبار. راقب العامل ثم تحديث سجل المهام.'});
  } catch(e){next(e);}
});
router.get('/inbox', async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(1000, Number(req.query.page)||1));
    const status = ['review','queued','inference','draft_ready','closed'].includes(req.query.status) ? req.query.status : null;
    const rows = await SupportMessage.find(status ? { status } : {}, { providerMessageId:0, __v:0 })
      .select('+senderWaId').sort({createdAt:-1}).skip((page-1)*30).limit(30).lean();
    res.set('Cache-Control','no-store');
    res.json({success:true, messages:rows, page, noAutomaticSending:true});
  } catch(e){next(e);}
});
router.post('/inbox/:id/retry', limiter, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(400);
    const cfg = await svc.getSummary();
    if (!cfg.executionEnabled) return res.status(423).json({success:false,code:'EXECUTION_DISABLED'});
    const msg = await SupportMessage.findById(req.params.id).select('+senderWaId');
    if (!msg || msg.status !== 'review' || !safeForAI(msg.text)) return res.status(409).json({success:false, message:'هذه الرسالة لا يمكن معالجتها تلقائيًا أو معالجتها مسبقًا.'});
    // Human-initiated retry counts towards the same rolling hourly limit.
    if (msg.jobId) return res.status(409).json({success:false,message:'تم توليد أو بدء مسودة لهذه الرسالة مسبقًا.'});
    const { reserveHourlyMessage } = require('../services/agentPolicyService');
    if (!await reserveHourlyMessage(msg.senderWaId)) return res.status(429).json({success:false,message:'بلغ هذا العميل حد 20 محاولة AI خلال 60 دقيقة.'});
    const job = await jobs.enqueue('support_draft', 'wa:' + msg.providerMessageId, msg.text, msg._id);
    msg.jobId = job._id; msg.status = 'queued'; await msg.save();
    res.json({success:true,message:'تم إرسال السؤال إلى قائمة مسودات Qwen.'});
  } catch(e){next(e);}
});
router.post('/inbox/:id/close', limiter, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(400);
    const msg = await SupportMessage.findOneAndUpdate({ _id:req.params.id }, { $set:{status:'closed',reviewedAt:new Date()} }, {new:true});
    if (!msg) return res.sendStatus(404);
    if (msg.jobId) await AgentJob.updateOne({_id:msg.jobId,status:{$in:['queued','leased','review']}},{$set:{status:'cancelled'}});
    res.json({success:true,message:'أغلقت الرسالة بعد المراجعة. لم تُرسل عبر API.'});
  } catch(e){next(e);}
});
module.exports = router;
