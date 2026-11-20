const express=require('express');
const rateLimit=require('express-rate-limit');
const crypto=require('crypto');
const jwt=require('jsonwebtoken');
const Customer=require('../models/Customer');
const c=require('../services/conversationService');
const {latestMessages}=require('../services/messageHistory');
const router=express.Router();
// Do not throttle natural multi-message conversations like account registration attempts.
const createLimit=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
const messageLimit=rateLimit({windowMs:15*60*1000,limit:90,standardHeaders:'draft-7',legacyHeaders:false});
const readLimiter=rateLimit({windowMs:60*1000,limit:60,standardHeaders:'draft-7',legacyHeaders:false});

async function identity(req) {
  const header=req.get('authorization')||'';
  if (!header) return null;
  const m=/^Bearer (\S+)$/.exec(header);
  if (!m) throw c.error('INVALID_SESSION',401);
  let tok;
  try {tok=jwt.verify(m[1],process.env.JWT_SECRET,{algorithms:['HS256']});}catch(_){throw c.error('INVALID_SESSION',401);}
  if (tok.role!=='customer') throw c.error('INVALID_SESSION',401);
  const customer=await Customer.findById(tok.id);
  if (!customer || customer.blocked || (customer.tokenVersion||0)!==(tok.tv||0)) throw c.error('INVALID_SESSION',401);
  return customer;
}
async function access(req,row) {
  const customer=await identity(req);
  if (customer) {
    if (!row.customerId || String(row.customerId)!==String(customer._id)) throw c.error('NOT_FOUND',404);
    return { customer, actor:'customer' };
  }
  if (row.customerId || row.channel !== 'site') throw c.error('NOT_FOUND',404);
  const supplied=req.get('x-conversation-key')||'';
  if (!/^[a-f0-9]{64}$/.test(supplied)) throw c.error('NOT_FOUND',404);
  const stored=await c.Conversation.findById(row._id).select('+guestTokenHash').lean();
  const a=Buffer.from(stored?.guestTokenHash||'', 'hex'), b=Buffer.from(c.digest(supplied),'hex');
  if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) throw c.error('NOT_FOUND',404);
  return { actor:'guest' };
}
function fail(err,req,res,next) {if (err.publicCode) return res.status(err.status).json({success:false,code:err.publicCode});next(err);}
router.post('/',createLimit,async(req,res,next)=>{
  try {
    const customer=await identity(req);
    const text=req.body?.text, subject=String(req.body?.subject||'استفسار').trim().slice(0,120);
    if (!c.validText(text) || subject.length<2) throw c.error('INVALID_MESSAGE');
    const name=String(req.body?.name||'').trim();
    if (!customer && (name.length<2 || name.length>80)) throw c.error('GUEST_NAME_REQUIRED');
    const key=customer?null:crypto.randomBytes(32).toString('hex');
    // One administrative support thread per authenticated customer going forward.
    // Existing historical conversations remain readable and are not destroyed.
    let row=null;
    let existing=false;
    if(customer){
      // First prefer the unique primary thread. Existing historical threads are preserved.
      row=await c.Conversation.findOne({channel:'site',customerId:customer._id,isPrimarySupportThread:true});
      if(!row){
        const legacy=await c.Conversation.findOne({channel:'site',customerId:customer._id}).sort({lastMessageAt:-1,_id:-1});
        if(legacy){
          try {row=await c.Conversation.findOneAndUpdate({_id:legacy._id},{$set:{isPrimarySupportThread:true,subject:'الإدارة'}},{new:true});}
          catch(e){if(e.code!==11000)throw e;row=await c.Conversation.findOne({channel:'site',customerId:customer._id,isPrimarySupportThread:true});}
        }
      }
      if(!row){
        try {row=await c.Conversation.findOneAndUpdate({channel:'site',customerId:customer._id,isPrimarySupportThread:true},
          {$setOnInsert:{subject:'الإدارة',status:'open',aiMode:'human'}},{upsert:true,new:true,setDefaultsOnInsert:true});}
        catch(e){if(e.code!==11000)throw e;row=await c.Conversation.findOne({channel:'site',customerId:customer._id,isPrimarySupportThread:true});}
      }
      if(!row)throw c.error('SUPPORT_THREAD_UNAVAILABLE',503);
      // An existing row already has system acknowledgement or legacy history.
      existing=(row.messageCount||0)>0;
      if(row.status==='closed')await c.Conversation.updateOne({_id:row._id},{$set:{status:'open',aiMode:'human'}});
      row.status='open';row.aiMode='human';
    }else{
      row=await c.Conversation.create({channel:'site',subject,customerId:null,aiMode:'human',guestName:name,guestTokenHash:c.digest(key)});
    }
    const {message}=await c.appendMessage(row,customer?'customer':'guest',text);
    // Only a newly opened conversation gets an acknowledgement; never repeat on follow-up.
    if (!existing) {
      await c.ConversationMessage.create({conversationId:row._id,author:'system',delivery:'internal',
        text:'وصلتنا رسالتك. يمكنك متابعة إرسال التفاصيل، وسيرد فريق الإدارة هنا.'});
      await c.Conversation.updateOne({_id:row._id},{$inc:{messageCount:1,unreadCustomer:1}});
    }
    // Human-only support: no account auto-answer, automatic Qwen drafts or auto-sends.
    res.set('Cache-Control','no-store');res.status(201).json({success:true,conversation:c.publicConversation(row),message:c.publicMessage(message),...(key?{guestKey:key}:{})});
  }catch(e){fail(e,req,res,next);}
});
router.get('/',readLimiter,async(req,res,next)=>{
  try {
    const customer=await identity(req);
    if (!customer) throw c.error('LOGIN_REQUIRED',401);
    const rows=await c.Conversation.find({customerId:customer._id,channel:'site'}).sort({lastMessageAt:-1}).limit(50).lean();
    res.set('Cache-Control','no-store');res.json({success:true,conversations:rows.map(c.publicConversation)});
  }catch(e){fail(e,req,res,next);}
});
router.get('/:id',readLimiter,async(req,res,next)=>{
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw c.error('NOT_FOUND',404);
    const row=await c.Conversation.findById(req.params.id);
    if (!row) throw c.error('NOT_FOUND',404);
    const auth=await access(req,row);
    const messages=await latestMessages(c.ConversationMessage,row._id,150);
    // Only mark genuinely unread messages, conditional on the snapshot to
    // preserve notifications when a concurrent message arrives.
    if ((auth.customer||auth.actor==='guest') && row.unreadCustomer>0) {
      const result=await c.Conversation.updateOne({_id:row._id,unreadCustomer:{$gt:0},lastMessageAt:row.lastMessageAt},{$set:{unreadCustomer:0}});
      if(result.modifiedCount)row.unreadCustomer=0;
    }
    res.set('Cache-Control','no-store');res.json({success:true,conversation:c.publicConversation(row),messages:messages.map(c.publicMessage)});
  }catch(e){fail(e,req,res,next);}
});
router.post('/:id/messages',messageLimit,async(req,res,next)=>{
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw c.error('NOT_FOUND',404);
    const row=await c.Conversation.findById(req.params.id);
    if (!row) throw c.error('NOT_FOUND',404);
    const auth=await access(req,row);
    if (row.status==='closed') throw c.error('CONVERSATION_CLOSED',409);
    const {message,created}=await c.appendMessage(row,auth.actor,req.body?.text);
    // Human-only customer conversation; admins reply from /admin/conversations.
    res.status(201).json({success:true,message:c.publicMessage(message)});
  }catch(e){fail(e,req,res,next);}
});
module.exports=router;
