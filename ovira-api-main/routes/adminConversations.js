const express=require('express');
const rateLimit=require('express-rate-limit');
const mongoose=require('mongoose');
const c=require('../services/conversationService');
const Audit=require('../models/Audit');
const AgentJob=require('../models/AgentJob');
const {latestMessages}=require('../services/messageHistory');
const {pageMessages}=require('../services/inboxMessages');
const {boundedLimit,decodeCursor,encodeCursor,olderThan,escapedSearch}=require('../services/inboxPaging');
const {requireStepUp}=require('../services/agentCredentialService');
const router=express.Router();
router.use((req,res,next)=> { if(req.method!=='GET' && req.admin.role==='viewer')return res.sendStatus(403);next(); });
const writeLimit=rateLimit({windowMs:60*1000,limit:35,standardHeaders:'draft-7',legacyHeaders:false});
const isId=x=>mongoose.isValidObjectId(x);
function fail(err,req,res,next){if(err.publicCode)return res.status(err.status).json({success:false,code:err.publicCode});next(err);}
async function log(req,action,id) {await Audit.create({adminId:Number(req.admin.telegramId)||0,action,entity:'Conversation',entityId:String(id),summary:action});}
router.get('/',async(req,res,next)=>{
 try {
  const status=['open','review','closed'].includes(req.query.status)?req.query.status:null;
  const channel=['site','whatsapp','legacy'].includes(req.query.channel)?req.query.channel:null;
  if(req.query.v==='2'){
    const size=boundedLimit(req.query.limit,30);
    const filter={...(status?{status}:{}),...(channel?{channel}:{})};
    const group=String(req.query.filter||'all');
    if(group==='unread')filter.unreadAdmin={$gt:0};
    else if(group==='needs_reply') {filter.lastSender={$in:['customer','guest','whatsapp']};filter.status={$ne:'closed'};}
    else if(group==='agent')filter.aiMode='assist';
    else if(group==='human')filter.aiMode='human';
    else if(group==='closed')filter.status='closed';
    else if(group!=='all')return res.status(400).json({success:false,code:'INVALID_FILTER'});
    const term=escapedSearch(req.query.q);
    if(term){
      // Search customer display names as well as conversation subject/guest name.
      // Query customer IDs once, never return private customer fields.
      const Customer=require('../models/Customer');
      const matched=await Customer.find({name:{$regex:term,$options:'i'}}).select('_id').limit(50).lean();
      filter.$or=[{subject:{$regex:term,$options:'i'}},{guestName:{$regex:term,$options:'i'}},
        {customerId:{$in:matched.map(x=>x._id)}}];
    }
    if(req.query.cursor){
      const decoded=decodeCursor(req.query.cursor);
      if(!decoded)return res.status(400).json({success:false,code:'INVALID_CURSOR'});
      filter.$and=[olderThan(decoded,'lastMessageAt')];
    }
    const rows=await c.Conversation.find(filter).sort({lastMessageAt:-1,_id:-1}).limit(size+1).lean();
    const hasMore=rows.length>size;
    const pageRows=rows.slice(0,size);
    // One batched name lookup; never return a customer object or private fields.
    const ids=[...new Set(pageRows.filter(x=>x.customerId).map(x=>String(x.customerId)))];
    let names=new Map();
    if(ids.length){
      const Customer=require('../models/Customer');
      const customers=await Customer.find({_id:{$in:ids}}).select('name').lean();
      names=new Map(customers.map(x=>[String(x._id),String(x.name||'').slice(0,80)]));
    }
    res.set('Cache-Control','no-store');
    return res.json({success:true,conversations:pageRows.map(x=>({
      ...c.publicConversation(x),displayName:x.customerId?(names.get(String(x.customerId))||'زبون المتجر'):(x.guestName||({whatsapp:'WhatsApp',legacy:'سجل سابق'}[x.channel])||'زائر'),
      needsReply:x.status!=='closed'&&['customer','guest','whatsapp'].includes(x.lastSender)
    })),hasMore,nextCursor:hasMore&&pageRows.length?encodeCursor(pageRows[pageRows.length-1]):null});
  }
  // Original endpoint remains compatible with older deployed frontends.
  const page=Math.max(1,Math.min(100,Number(req.query.page)||1));
  const filter={...(status?{status}:{}),...(channel?{channel}:{})};
  const [rows,total]=await Promise.all([c.Conversation.find(filter).sort({lastMessageAt:-1}).skip((page-1)*30).limit(30).lean(),c.Conversation.countDocuments(filter)]);
  res.set('Cache-Control','no-store');res.json({success:true,conversations:rows.map(c.publicConversation),total,page});
 }catch(e){next(e);}
});
router.get('/:id',async(req,res,next)=>{
 try {
  if(!isId(req.params.id))return res.sendStatus(404);
  const row=await c.Conversation.findById(req.params.id).select('+providerThreadId').lean();if(!row)return res.sendStatus(404);
  const paged=req.query.v==='2'?await pageMessages(c.ConversationMessage,row._id,{limit:req.query.limit}):null;
  const messages=paged?.rows||await latestMessages(c.ConversationMessage,row._id,200);
  // Avoid a write on every poll; do not clear unread if a new message arrived
  // after the conversation snapshot was loaded.
  if(req.query.v!=='2' && row.unreadAdmin>0) {
    const result=await c.Conversation.updateOne({_id:row._id,unreadAdmin:{$gt:0},lastMessageAt:row.lastMessageAt},{$set:{unreadAdmin:0}});
    if(result.modifiedCount) row.unreadAdmin=0;
  }
  let supportVerified=false;
  if(row.customerId){const Customer=require('../models/Customer');supportVerified=!!(await Customer.exists({_id:row.customerId,supportVerifiedUntil:{$gt:new Date()}}));}
  res.set('Cache-Control','no-store');res.json({success:true,conversation:{...c.publicConversation(row),supportVerified,...(row.channel==='whatsapp'&&/^\d{7,20}$/.test(row.providerThreadId||'')?{contactUrl:'https://wa.me/'+row.providerThreadId}:{})},messages:messages.map(x=>({...c.publicMessage(x),aiDraft:x.aiDraft||''})),...(paged?{hasMore:paged.hasMore,nextBefore:paged.nextBefore}:{})});
 }catch(e){next(e);}
});
// A read acknowledgement is explicit in v2, not a write from a GET request.
router.post('/:id/read',writeLimit,async(req,res,next)=>{
 try {
  if(!isId(req.params.id))return res.sendStatus(404);
  const seen=new Date(req.body?.seenAt);
  if(!Number.isFinite(seen.getTime()) || seen.getTime()>Date.now()+60000)return res.status(400).json({success:false,code:'INVALID_SEEN_AT'});
  const update=await c.Conversation.updateOne({_id:req.params.id,unreadAdmin:{$gt:0},lastMessageAt:{$lte:seen}},{$set:{unreadAdmin:0}});
  res.set('Cache-Control','no-store');res.json({success:true,updated:!!update.modifiedCount});
 }catch(e){next(e);}
});
// Read older messages without changing unread counters or the conversation state.
router.get('/:id/messages',async(req,res,next)=>{
 try {
  if(!isId(req.params.id))return res.sendStatus(404);
  const row=await c.Conversation.findById(req.params.id).select('_id');
  if(!row)return res.sendStatus(404);
  const page=await pageMessages(c.ConversationMessage,row._id,{before:req.query.before,limit:req.query.limit});
  res.set('Cache-Control','no-store');res.json({success:true,messages:page.rows.map(x=>({...c.publicMessage(x),aiDraft:x.aiDraft||''})),hasMore:page.hasMore,nextBefore:page.nextBefore});
 }catch(e){fail(e,req,res,next);}
});
router.post('/:id/reply',writeLimit,async(req,res,next)=>{
 try {
  if(!isId(req.params.id))return res.sendStatus(404);
  const row=await c.Conversation.findById(req.params.id);if(!row)return res.sendStatus(404);
  if(row.status==='closed')return res.status(409).json({success:false,code:'CONVERSATION_CLOSED'});
  if(row.channel==='whatsapp')return res.status(409).json({success:false,code:'WHATSAPP_DELIVERY_DISABLED',message:'رد WhatsApp المباشر غير متاح دون تحقق مستقل من التكلفة والنافذة؛ يمكنك نسخ المسودة والتواصل رسميًا.'});
  const key=String(req.body?.idempotencyKey||'');
  if(!/^[a-f0-9-]{36}$/.test(key))return res.status(400).json({success:false,code:'IDEMPOTENCY_KEY_REQUIRED'});
  // The human takes the conversation before replying. Pending agent work is cancelled.
  await c.Conversation.updateOne({_id:row._id},{$set:{aiMode:'human'}});
  await AgentJob.updateMany({conversationId:row._id,status:{$in:['queued','leased']}},{$set:{status:'cancelled'}});
  const result=await c.appendMessage(row,'admin',req.body?.text,{adminId:req.admin.id,dedupeKey:'admin:'+String(req.admin.id)+':'+key});
  await log(req,'CONVERSATION_ADMIN_REPLY',row._id);
  res.status(201).json({success:true,message:c.publicMessage(result.message)});
 }catch(e){fail(e,req,res,next);}
});
router.post('/:id/ai-draft/send',writeLimit,async(req,res,next)=>{
 try {
  if(!isId(req.params.id)||!isId(req.body?.messageId))return res.sendStatus(400);
  const row=await c.Conversation.findById(req.params.id);if(!row)return res.sendStatus(404);
  if(row.channel!=='site'||row.status==='closed')return res.status(409).json({success:false,code:'NOT_SENDABLE'});
  const draft=await c.ConversationMessage.findOne({_id:req.body.messageId,conversationId:row._id});
  if(!draft?.aiDraft) return res.status(409).json({success:false,code:'DRAFT_NOT_READY'});
  const result=await c.appendMessage(row,'admin',draft.aiDraft,{adminId:req.admin.id,dedupeKey:'approved-draft:'+draft._id});
  await log(req,'CONVERSATION_AI_DRAFT_APPROVED',row._id);
  res.status(201).json({success:true,message:c.publicMessage(result.message)});
 }catch(e){fail(e,req,res,next);}
});
router.patch('/:id',writeLimit,async(req,res,next)=>{
 try {
  if(!isId(req.params.id))return res.sendStatus(404);
  const update={};
  if(['open','review','closed'].includes(req.body?.status))update.status=req.body.status;
  if(['assist','human'].includes(req.body?.aiMode)) {
    if(req.body.aiMode==='assist') {
      // Enabling automation is privileged; pausing it is deliberately immediate.
      if(req.admin.role!=='owner')return res.sendStatus(403);
      await requireStepUp(req.admin.id,req.body?.currentPassword,req.body?.code);
    }
    update.aiMode=req.body.aiMode;
  }
  if(!Object.keys(update).length)return res.sendStatus(400);
  const row=await c.Conversation.findByIdAndUpdate(req.params.id,{$set:update},{new:true,runValidators:true});
  if(!row)return res.sendStatus(404);
  if(update.aiMode==='human'||update.status==='closed')
    await AgentJob.updateMany({conversationId:row._id,status:{$in:['queued','leased']}},{$set:{status:'cancelled'}});
  await log(req,'CONVERSATION_STATUS_UPDATED',row._id);
  res.json({success:true,conversation:c.publicConversation(row)});
 }catch(e){if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e);}
});
module.exports=router;
