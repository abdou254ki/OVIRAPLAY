const express=require('express');
const rateLimit=require('express-rate-limit');
const mongoose=require('mongoose');
const KnowledgeEntry=require('../models/KnowledgeEntry');
const SiteNotification=require('../models/SiteNotification');
const Customer=require('../models/Customer');
const IntegrationConfig=require('../models/IntegrationConfig');
const {safeForAI}=require('../services/agentPolicyService');
const AgentSettings=require('../models/AgentSettings');
const jobs=require('../services/agentJobService');
const {requireStepUp}=require('../services/agentCredentialService');
const router=express.Router();
router.use(rateLimit({windowMs:15*60*1000,limit:80,standardHeaders:'draft-7',legacyHeaders:false}));
const clean=(s,n)=>typeof s==='string'&&s.trim().length>=2&&s.trim().length<=n&&!/[\u0000-\u001f]/.test(s);
router.get('/',async(req,res,next)=>{try{
 const [kb,email,unread]=await Promise.all([KnowledgeEntry.find().sort({updatedAt:-1}).limit(70).lean(),IntegrationConfig.findById('email').lean(),SiteNotification.countDocuments({readAt:null})]);
 res.set('Cache-Control','no-store');res.json({success:true,knowledge:kb,email:email||{provider:'disabled',enabled:false},unreadNotifications:unread,info:'No auto sends or external email delivery'});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.get('/test-jobs',async(req,res,next)=>{try{
 const AgentJob=require('../models/AgentJob');const rows=await AgentJob.find({kind:'test_prompt'}).select('kind inputText resultText status createdAt completedAt errorCode attempts -_id').sort({createdAt:-1}).limit(18).lean();
 res.set('Cache-Control','no-store');res.json({success:true,jobs:rows});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.get('/owner-alerts',async(req,res,next)=>{try{
 const Conversation=require('../models/Conversation');
 const [conversations,reviewJobs]=await Promise.all([Conversation.countDocuments({unreadAdmin:{$gt:0},channel:'site'}),require('../models/AgentJob').countDocuments({status:'review',kind:'conversation_draft'})]);
 res.set('Cache-Control','no-store');res.json({success:true,conversations,reviewJobs});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.post('/knowledge',async(req,res,next)=>{try{
 await requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
 const {question,answer,category}=req.body||{};if(!clean(question,240)||!clean(answer,1400))return res.sendStatus(400);
 if(!['faq','sales','policy','delivery','renewal'].includes(category))return res.sendStatus(400);
 const row=await KnowledgeEntry.create({question:question.trim(),answer:answer.trim(),category,updatedBy:req.admin.id});res.status(201).json({success:true,id:row._id});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.patch('/knowledge/:id',async(req,res,next)=>{try{
 await requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
 if(!mongoose.isValidObjectId(req.params.id))return res.sendStatus(400);
 const update={};for(const k of ['question','answer'])if(req.body?.[k]!==undefined){if(!clean(req.body[k],k==='question'?240:1400))return res.sendStatus(400);update[k]=req.body[k].trim();}
 if(req.body?.active!==undefined){if(typeof req.body.active!=='boolean')return res.sendStatus(400);update.active=req.body.active;}
 if(!Object.keys(update).length)return res.sendStatus(400);
 const row=await KnowledgeEntry.findByIdAndUpdate(req.params.id,{$set:update},{new:true,runValidators:true});if(!row)return res.sendStatus(404);res.json({success:true});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.post('/test',async(req,res,next)=>{try{
 const text=String(req.body?.text||'').trim();if(text.length<2||text.length>1200||/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text))return res.status(400).json({success:false,code:'INVALID_TEST',message:'اكتب سؤالًا نصيًا حتى 1200 حرف دون أسرار حقيقية.'});
 const cfg=await AgentSettings.findById('local-agent-v1').lean();if(process.env.AI_EXECUTION_ENABLED!=='true'||!cfg?.enabled||!cfg?.executionEnabled)return res.status(423).json({success:false,code:'DRAFTS_PAUSED'});
 const row=await jobs.enqueue('test_prompt','admin-test:'+require('crypto').randomUUID(),text);res.status(201).json({success:true,jobId:row._id});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.post('/notify',async(req,res,next)=>{try{
 const {customerId,kind,title,body}=req.body||{};
 if(!mongoose.isValidObjectId(customerId)||!['order','renewal','support','offer','general'].includes(kind)||!clean(title,100)||!clean(body,600))return res.sendStatus(400);
 const c=await Customer.findById(customerId).select('_id marketingOptIn');if(!c)return res.sendStatus(404);
 if(kind==='offer'&&!c.marketingOptIn)return res.status(409).json({success:false,code:'MARKETING_OPT_IN_REQUIRED'});
 const row=await SiteNotification.create({customerId,kind,title:title.trim(),body:body.trim(),createdBy:req.admin.id});res.status(201).json({success:true,id:row._id});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
router.patch('/email-settings',async(req,res,next)=>{try{
 await requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
 const {provider,fromName,fromAddress,endpoint}=req.body||{};
 if(!['disabled','smtp','api'].includes(provider)||!clean(fromName,80)||typeof fromAddress!=='string'||fromAddress.length>150||typeof endpoint!=='string'||endpoint.length>250)return res.sendStatus(400);
 // Only nonsecret metadata; no SMTP password/API key entered or sent to browser.
 if(endpoint&&!/^https:\/\/[A-Za-z0-9.-]+(?::443)?(?:\/[A-Za-z0-9_./-]*)?$/.test(endpoint))return res.sendStatus(400);
 await IntegrationConfig.findOneAndUpdate({_id:'email'},{$set:{provider,fromName:fromName.trim(),fromAddress:fromAddress.trim(),endpoint,enabled:false,configured:false,updatedBy:req.admin.id}},{upsert:true,new:true,runValidators:true});
 res.json({success:true,message:'حُفظت الإعدادات غير السرية. الإرسال معطّل حتى تنفيذ مزود موثّق وخزنة أسرار.'});
}catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}});
module.exports=router;
