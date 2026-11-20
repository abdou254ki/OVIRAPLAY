const crypto = require('crypto');
const Conversation = require('../models/Conversation');
const ConversationMessage = require('../models/ConversationMessage');
const AgentSettings = require('../models/AgentSettings');
const { reserveHourlyMessage, safeForAI } = require('./agentPolicyService');
const jobs = require('./agentJobService');

const validText = s => typeof s === 'string' && s.trim().length >= 2 && s.trim().length <= 1500 && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(s);
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
function error(code, status=400) { const e=new Error(code);e.status=status;e.publicCode=code;return e; }
function publicConversation(x) {
  const row = x.toObject ? x.toObject() : {...x};
  delete row.guestTokenHash; delete row.providerThreadId; delete row.__v;
  return row;
}
function publicMessage(x) {
  const row = x.toObject ? x.toObject() : {...x};
  delete row.providerMessageId; delete row.dedupeKey; delete row.aiDraft; delete row.aiJobId; delete row.__v;
  return row;
}
async function appendMessage(conversation, author, text, {providerMessageId, dedupeKey, adminId, delivery}={}) {
  if (!validText(text)) throw error('INVALID_MESSAGE');
  const doc = {conversationId: conversation._id, author, text:text.trim(), delivery: delivery || 'site'};
  if (providerMessageId) doc.providerMessageId = providerMessageId;
  if (dedupeKey) doc.dedupeKey = dedupeKey;
  if (adminId) doc.sentByAdminId = adminId;
  let message;
  try { message = await ConversationMessage.create(doc); }
  catch(e) {
    if (e.code !== 11000 || (!providerMessageId && !dedupeKey)) throw e;
    const already = await ConversationMessage.findOne(providerMessageId ? { providerMessageId } : { conversationId: conversation._id, dedupeKey });
    if (!already || String(already.conversationId) !== String(conversation._id)) throw error('DUPLICATE_MESSAGE',409);
    return {message: already, created:false};
  }
  const inbound = ['customer','guest','whatsapp'].includes(author);
  await Conversation.updateOne({_id: conversation._id}, {$set:{lastMessageAt:message.createdAt,lastMessageText:message.text.slice(0,180),lastSender:author},$inc:{messageCount:1,...(inbound?{unreadAdmin:1}:{unreadCustomer:1})}});
  return { message, created:true };
}
// Batch quick consecutive messages before sending a single contextual question to Qwen.
// It costs one inference for a burst, and never sends personal account data to Termux.
async function maybeQueueDraft(conversation, message, senderKey) {
  if (conversation.aiMode !== 'assist' || process.env.AI_EXECUTION_ENABLED !== 'true') return;
  const mode=await AgentSettings.findById('local-agent-v1').lean();
  if (mode?.supportHumanOnly !== false) return;
  if (!safeForAI(message.text)) {
    // If the customer has switched to a private account problem, do not process
    // the preceding queued general question as though it were still current.
    await jobs.AgentJob?.updateMany?.({conversationId:conversation._id,kind:'conversation_draft',status:'queued'},{$set:{status:'cancelled'}});
    return;
  }
  const cfg=await AgentSettings.findById('local-agent-v1').lean();
  if (!cfg?.executionEnabled || !cfg?.enabled || cfg.killSwitch) return;
  if (conversation.channel !== 'site') {
    if (await reserveHourlyMessage('chat:'+senderKey))
      await jobs.enqueue('conversation_draft','conv:'+String(message._id),message.text,null,{conversationId:conversation._id,conversationMessageId:message._id});
    return;
  }
  // Only gather the newest messages in this conversation, not any other account.
  const recent=await ConversationMessage.find({conversationId:conversation._id,author:{$in:['customer','guest']},createdAt:{$gte:new Date(Date.now()-120000)}})
    .sort({createdAt:-1,_id:-1}).limit(8).lean();
  const entries=recent.reverse().map(x=>x.text);
  if (entries.some(t=>!safeForAI(t))) return;
  const input=(entries.length>1?'رسائل متتابعة من الزبون:\n':'')+entries.join('\n');
  const combined=input.slice(-1100);
  const notBefore=new Date(Date.now()+12000);
  const {AgentJob}=jobs;
  if (AgentJob) {
    const pending=await AgentJob.findOneAndUpdate({conversationId:conversation._id,kind:'conversation_draft',status:'queued'},
      {$set:{inputText:combined,conversationMessageId:message._id,notBefore}},{new:true}).lean();
    if(pending) {
      await ConversationMessage.updateOne({_id:message._id},{$set:{aiJobId:pending._id}});
      return;
    }
  }
  if (!await reserveHourlyMessage('chat:'+senderKey)) return;
  try {
    const job=await jobs.enqueue('conversation_draft','conv:'+String(message._id),combined,null,{conversationId:conversation._id,conversationMessageId:message._id});
    if (AgentJob) await AgentJob.updateOne({_id:job._id,status:'queued'},{$set:{notBefore}});
    await ConversationMessage.updateOne({_id:message._id},{$set:{aiJobId:job._id}});
    await Conversation.updateOne({_id:conversation._id,status:'open'},{$set:{status:'review'}});
  } catch(e) { console.error('[conversation] AI queue unavailable:', e.code || e.name); }
}

// Authenticated account self-service stays on Render. Never ship order history,
// email, balance, password hashes, OTP or delivery credentials to Termux/Qwen.
async function answerAccountQuestion(conversation, message, customer) {
  // Account-related questions must be handled by a human until explicitly reenabled.
  if (!customer || conversation.channel!=='site') return null;
  const settings=await AgentSettings.findById('local-agent-v1').lean();
  if(settings?.supportHumanOnly !== false)return null;
  const text=String(message.text||'').trim();
  let response='';
  if (/(?:حالة|وين|أين|اين|ماذا\s*حدث|تابع|متابعة|أتابع|تتبع|status|track).{0,40}(?:طلب|طلباتي|orders?)|(?:طلبي|طلباتي).{0,35}(?:حالة|وين|status)/i.test(text)) {
    const Order=require('../models/Order');
    const orders=await Order.find({customerId:customer._id}).select('orderCode status -_id').sort({createdAt:-1}).limit(5).lean();
    response=orders.length?('هذه حالات آخر طلباتك المرتبطة بحسابك المسجّل:\n'+orders.map(o=>String(o.orderCode).slice(0,32)+' — '+String(o.status).slice(0,40)).join('\n')+'\nللتفاصيل افتح «حسابي ← طلباتي».')
      :'لم أجد طلبات مرتبطة بهذا الحساب. يمكنك مراجعة «حسابي ← طلباتي» أو طلب المساعدة من الموظف.';
  } else if (/(?:كيف|طريقة|كيفية).{0,38}(?:أغير|اغير|تغيير|تعديل|أبدل|change).{0,25}(?:كلمة المرور|كلمة السر|البريد|الايميل|الإيميل|email|password)/i.test(text)) {
    response='يمكنك تحديث البريد أو رقم الهاتف من «حسابي» بعد رمز تحقق مستقل، وتغيير كلمة المرور عبر إعدادات الأمان. لا ترسل أي رمز OTP أو كلمة مرور في الشات.';
  }
  if (!response) return null;
  const reply=await ConversationMessage.create({conversationId:conversation._id,author:'system',text:response,delivery:'internal',dedupeKey:'account-help:'+String(message._id)});
  await Conversation.updateOne({_id:conversation._id},{$set:{lastMessageAt:reply.createdAt,lastMessageText:reply.text.slice(0,180),lastSender:'system'},$inc:{messageCount:1,unreadCustomer:1}});
  return reply;
}
async function getWhatsAppConversation(waId) {
  // Normalized WA identity is provider-scoped; never attach to a website customer by phone number.
  try {
    return await Conversation.findOneAndUpdate({channel:'whatsapp',providerThreadId:waId},
      {$setOnInsert:{channel:'whatsapp',providerThreadId:waId,subject:'WhatsApp',status:'open',lastSender:'whatsapp'}},
      {upsert:true,new:true,setDefaultsOnInsert:true});
  } catch(e) {
    if(e.code!==11000)throw e;
    const existing=await Conversation.findOne({channel:'whatsapp',providerThreadId:waId});
    if(!existing)throw e;
    return existing;
  }
}
module.exports = {Conversation,ConversationMessage,validText,digest,error,publicConversation,publicMessage,appendMessage,maybeQueueDraft,answerAccountQuestion,getWhatsAppConversation};
