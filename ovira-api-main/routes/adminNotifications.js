const express=require('express');
const mongoose=require('mongoose');
const rateLimit=require('express-rate-limit');
const Customer=require('../models/Customer');
const SiteNotification=require('../models/SiteNotification');
const NotificationCampaign=require('../models/NotificationCampaign');
const SiteAnnouncement=require('../models/SiteAnnouncement');
const Audit=require('../models/Audit');
const {requireStepUp}=require('../services/agentCredentialService');
const router=express.Router();
router.use(rateLimit({windowMs:15*60*1000,limit:55,standardHeaders:'draft-7',legacyHeaders:false}));
const clean=(s,n)=>typeof s==='string'&&s.trim().length>=2&&s.trim().length<=n&&!/[\x00-\x1f]/.test(s);
const failure=(e,req,res,next)=>e.httpStatus?res.status(e.httpStatus).json({success:false,code:e.code,message:e.message}):next(e);
router.get('/',async(req,res,next)=>{try{
 const [campaigns,announcements]=await Promise.all([NotificationCampaign.find().sort({createdAt:-1}).limit(25).select('-body').lean(),SiteAnnouncement.find().sort({createdAt:-1}).limit(20).lean()]);
 res.set('Cache-Control','no-store');res.json({success:true,campaigns,announcements});
}catch(e){next(e)}});
router.get('/recipients',async(req,res,next)=>{try{
 const q=String(req.query.q||'').trim().slice(0,80);
 if(q.length<3)return res.status(400).json({success:false,code:'SEARCH_MIN_3'});
 const rx=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
 const rows=await Customer.find({$or:[{email:rx},{phone:rx},{name:rx}]}).select('name email phone marketingOptIn blocked').limit(20).lean();
 res.set('Cache-Control','no-store');res.json({success:true,recipients:rows.map(c=>({id:c._id,name:c.name,email:c.email||'',phone:c.phone||'',marketingOptIn:!!c.marketingOptIn,blocked:!!c.blocked}))});
}catch(e){next(e)}});
router.post('/send',async(req,res,next)=>{try{
 const {scope,customerId,kind,title,body,confirmation}=req.body||{};
 if(!['one','marketing','all'].includes(scope)||!['order','renewal','support','offer','general'].includes(kind)||!clean(title,100)||!clean(body,600))return res.sendStatus(400);
 if(scope==='all'&&kind!=='general')return res.status(409).json({success:false,code:'GENERAL_ONLY_FOR_ALL',message:'الإرسال لجميع الحسابات مخصص للإعلانات الخدمية العامة فقط.'});
 if(scope==='marketing'&&kind!=='offer')return res.status(409).json({success:false,code:'OFFER_ONLY_FOR_MARKETING'});
 if(scope!=='one'&&confirmation!=='SEND_TO_SELECTED_AUDIENCE')return res.status(400).json({success:false,code:'BROADCAST_CONFIRMATION_REQUIRED'});
 if(scope!=='one')await requireStepUp(req.admin.id,req.body.currentPassword,req.body.code);
 let recipients=[];
 if(scope==='one'){
  if(!mongoose.isValidObjectId(customerId))return res.sendStatus(400);
  const c=await Customer.findById(customerId).select('_id blocked marketingOptIn').lean();
  if(!c||c.blocked)return res.status(404).json({success:false,code:'RECIPIENT_NOT_FOUND'});
  if(kind==='offer'&&!c.marketingOptIn)return res.status(409).json({success:false,code:'MARKETING_OPT_IN_REQUIRED'});
  recipients=[c._id];
 }else{
  const query={blocked:{$ne:true},...(scope==='marketing'||kind==='offer'?{marketingOptIn:true}:{})};
  const count=await Customer.countDocuments(query);
  if(count>500)return res.status(409).json({success:false,code:'BATCH_LIMIT_500',message:'هناك أكثر من 500 حساب. استخدم الحملات المجدولة لاحقاً لتجنب إرسال غير مكتمل.'});
  recipients=(await Customer.find(query).select('_id').limit(501).lean()).map(c=>c._id);
 }
 const campaign=await NotificationCampaign.create({scope,kind,title:title.trim(),body:body.trim(),createdBy:req.admin.id,status:'queued'});
 let delivered=0;
 try{
  // Individual notification documents are the source of truth. Unique dedupe prevents resends.
  if(recipients.length){
   const ops=recipients.map(id=>({updateOne:{filter:{customerId:id,dedupeKey:'campaign:'+campaign._id},update:{$setOnInsert:{customerId:id,kind,title:title.trim(),body:body.trim(),link:'#/account',dedupeKey:'campaign:'+campaign._id,createdBy:req.admin.id}},upsert:true}}));
   const result=await SiteNotification.bulkWrite(ops,{ordered:false});delivered=result.upsertedCount||0;
  }
  campaign.status='completed';campaign.recipients=delivered;await campaign.save();
 }catch(err){campaign.status='partial';campaign.recipients=delivered;campaign.error=String(err.code||err.name).slice(0,60);await campaign.save();throw err;}
 await Audit.create({adminId:Number(req.admin.telegramId)||0,action:'NOTIFICATION_CAMPAIGN_SENT',entity:'NotificationCampaign',entityId:String(campaign._id),summary:`${scope}: ${kind}, recipients ${delivered}`});
 res.status(201).json({success:true,campaignId:campaign._id,recipients:delivered,channel:'in_account_only'});
}catch(e){failure(e,req,res,next)}});
router.post('/announcements',async(req,res,next)=>{try{
 const {title,body,hours}=req.body||{};
 if(!clean(title,100)||!clean(body,600)||!Number.isInteger(hours)||hours<1||hours>168)return res.sendStatus(400);
 await requireStepUp(req.admin.id,req.body.currentPassword,req.body.code);
 const row=await SiteAnnouncement.create({title:title.trim(),body:body.trim(),startsAt:new Date(),expiresAt:new Date(Date.now()+hours*3600000),createdBy:req.admin.id});
 await Audit.create({adminId:Number(req.admin.telegramId)||0,action:'SITE_ANNOUNCEMENT_CREATED',entity:'SiteAnnouncement',entityId:String(row._id),summary:'إعلان عام على الموقع'});
 res.status(201).json({success:true,id:row._id});
}catch(e){failure(e,req,res,next)}});
router.patch('/announcements/:id',async(req,res,next)=>{try{
 if(!mongoose.isValidObjectId(req.params.id)||req.body?.enabled!==false)return res.sendStatus(400);
 await requireStepUp(req.admin.id,req.body.currentPassword,req.body.code);
 const row=await SiteAnnouncement.findByIdAndUpdate(req.params.id,{$set:{enabled:false}},{new:true});if(!row)return res.sendStatus(404);
 res.json({success:true});
}catch(e){failure(e,req,res,next)}});
module.exports=router;
