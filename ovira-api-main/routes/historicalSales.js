const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const HistoricalSale = require('../models/HistoricalSale');
const Audit = require('../models/Audit');
const { requireStepUp } = require('../services/agentCredentialService');
const router = express.Router();
// Disabled by default until an isolated DB snapshot and schema approval exist.
router.use((req, res, next) => process.env.HISTORICAL_SALES_ENABLED === 'true'
  ? next() : res.status(423).json({ success:false, code:'FEATURE_DISABLED', message:'المبيعات الخارجية غير مفعّلة. يلزم اختبار النسخ الاحتياطية قبل استعمالها.' }));
router.get('/', async (req, res, next) => {
  try {
    const page = Math.min(1000,Math.max(1,parseInt(req.query.page,10)||1));
    const pageSize = 20;
    const filter = {};
    if (req.query.source && ['instagram','facebook','whatsapp','telegram','offline','other'].includes(req.query.source)) filter.sourceChannel = req.query.source;
    const [rows,total] = await Promise.all([
      HistoricalSale.find(filter).select('sourceChannel externalRef occurredAt createdAt customerLabel description amountMinor costMinor currency status linkStatus sourceEvidenceNote')
        .sort({occurredAt:-1}).skip((page-1)*pageSize).limit(pageSize).lean(),
      HistoricalSale.countDocuments(filter)
    ]);
    res.set('Cache-Control','no-store');
    res.json({success:true,generatedAt:new Date().toISOString(),page,pageSize,total,pages:Math.max(1,Math.ceil(total/pageSize)),currency:'DZD',status:'draft_only',sales:rows});
  } catch(err){next(err)}
});
router.post('/',rateLimit({windowMs:600000,limit:15,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res,next)=>{
  try {
    const body=req.body||{};
    const channels=['instagram','facebook','whatsapp','telegram','offline','other'];
    const dateText=String(body.occurredAt||'');
    const date=/^\d{4}-\d{2}-\d{2}$/.test(dateText) ? new Date(dateText+'T12:00:00.000Z') : new Date(dateText);
    // Account journal entries are owner-entered drafts only. The date is user chosen.
    const earliest=new Date('1900-01-01T00:00:00.000Z'),latest=new Date('2100-12-31T23:59:59.999Z');
    const invalidDay=/^\d{4}-\d{2}-\d{2}$/.test(dateText) && (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==dateText);
    if (!channels.includes(body.sourceChannel) || typeof body.externalRef!=='string' || !/^[\p{L}0-9 _-]{3,80}$/u.test(body.externalRef) ||
        typeof body.customerLabel!=='string' || !body.customerLabel.trim() || body.customerLabel.length>100 ||
        typeof body.description!=='string' || !body.description.trim() || body.description.length>300 ||
        !Number.isSafeInteger(body.amountMinor) || body.amountMinor<=0 || body.amountMinor>1e11 ||
        invalidDay || Number.isNaN(date.getTime()) || date>latest || date<earliest) {
      return res.status(400).json({success:false,message:'بيانات البيع التاريخي غير صالحة؛ تحقق من المرجع والمبلغ والتاريخ.'});
    }
    // No approval/link/financial posting here; owner + recent 2FA are required for safe staging.
    const admin=await requireStepUp(req.admin.id,body.currentPassword,body.code);
    const sale=await HistoricalSale.create({
      sourceChannel:body.sourceChannel,externalRef:body.externalRef.trim(),occurredAt:date,
      customerLabel:body.customerLabel.trim(),description:body.description.trim(),amountMinor:body.amountMinor,
      sourceEvidenceNote:typeof body.sourceEvidenceNote==='string'?body.sourceEvidenceNote.slice(0,300):'',
      createdByAdminId:admin._id
    });
    try {await Audit.create({adminId:Number(admin.telegramId)||0,action:'HISTORICAL_SALE_DRAFT_CREATED',entity:'HistoricalSale',entityId:String(sale._id),summary:'سجل بيع خارجي للمراجعة فقط دون ربط حساب أو ترحيل مالي'});}
    catch(err) { await HistoricalSale.deleteOne({_id:sale._id,status:'draft'});throw err; }
    res.status(201).json({success:true,id:String(sale._id),status:'draft',linkStatus:'unlinked',message:'سُجلت مسودة البيع. لا تُحسب في الأرباح ولا ترتبط بعميل حتى التحقق والموافقة.'});
  }catch(err){
    if(err.httpStatus)return res.status(err.httpStatus).json({success:false,message:err.message,code:err.code});
    if(err.code===11000)return res.status(409).json({success:false,message:'يوجد بيع بنفس قناة المصدر والمرجع؛ منعنا التكرار.'});
    next(err);
  }
});
module.exports=router;
