const crypto = require('crypto');
const mongoose = require('mongoose');
const AgentJob = require('../models/AgentJob');
const SupportMessage = require('../models/SupportMessage');
const Conversation = require('../models/Conversation');
const ConversationMessage = require('../models/ConversationMessage');
const { APPROVED_CONTEXT, approvedSiteFaq, safeForAI, eligibleSiteReply } = require('./agentPolicyService');
const AgentSettings = require('../models/AgentSettings');
const { liveContext, priceIntent } = require('./catalogAiContext');
const { knowledgeContext } = require('./knowledgeService');

function ensureGoodText(text, limit = 1000) {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= limit && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text);
}
async function enqueue(kind, dedupeKey, inputText, resourceId = null, meta = {}) {
  if (!['support_draft', 'conversation_draft', 'test_prompt'].includes(kind) || !ensureGoodText(inputText, 1200)) throw new Error('BAD_JOB');
  return AgentJob.findOneAndUpdate({ dedupeKey }, {
    $setOnInsert: { kind, dedupeKey, inputText: inputText.trim(), resourceId, conversationId: meta.conversationId || null, conversationMessageId: meta.conversationMessageId || null, status: 'queued', approvedContext: APPROVED_CONTEXT }
  }, { upsert: true, new: true, runValidators: true });
}
async function claim(credential) {
  const now = new Date();
  // Expired final attempt must not remain leased indefinitely.
  await AgentJob.updateMany({ status: 'leased', attempts: { $gte: 3 }, leaseExpiresAt: { $lte: now } }, { $set: { status: 'failed', errorCode: 'ATTEMPTS_EXHAUSTED', completedAt: now } });
  const leaseToken = crypto.randomBytes(32).toString('base64url');
  // A single atomic lease across Render instances. Expired leases are reclaimable.
  const job = await AgentJob.findOneAndUpdate({
    attempts: { $lt: 3 }, notBefore: { $lte: now },
    $or: [ { status: 'queued' }, { status: 'leased', leaseExpiresAt: { $lte: now } } ]
  }, {
    $set: { status: 'leased', leaseOwner: credential._id, leaseExpiresAt: new Date(now.getTime() + 120000), leaseTokenHash: crypto.createHash('sha256').update(leaseToken).digest('hex') },
    $inc: { attempts: 1, jobVersion: 1 }
  }, { new: true, sort: { priority: -1, createdAt: 1 } }).lean();
  if (!job) return null;
  if (job.kind === 'support_draft' && job.resourceId) await SupportMessage.updateOne({ _id: job.resourceId, status: { $in: ['queued', 'inference'] } }, { $set: { status: 'inference' } });
  if (job.kind === 'conversation_draft' && job.conversationId) {
    const conv = await Conversation.findById(job.conversationId).lean();
    if (!conv || conv.status === 'closed' || conv.aiMode !== 'assist') {
      await AgentJob.updateOne({_id:job._id,status:'leased',leaseTokenHash:job.leaseTokenHash}, {$set:{status:'cancelled'}});
      return null;
    }
  }
  let context=job.approvedContext || APPROVED_CONTEXT;
  // Current price data and owner-curated knowledge are retrieved fresh on every claim.
  try { const catalog=await liveContext(job.inputText); if(catalog)context+='\n'+catalog; }
  catch (_) { context+='\nتعذر التحقق من الأسعار الحية؛ لا تذكر أي سعر.'; }
  try { const knowledge=await knowledgeContext(job.inputText); if(knowledge)context+='\n'+knowledge; }
  catch (_) { /* no fabricated knowledge on DB failure */ }
  return { id: String(job._id), kind: job.kind, text: job.inputText, context: context.slice(0,4500), leaseToken, jobVersion:job.jobVersion, timeoutSeconds: 110, policyVersion: job.policyVersion };
}
async function latestCustomerMessage(job) {
  if (!job.conversationMessageId) return false;
  const source=await ConversationMessage.findOne({_id:job.conversationMessageId,conversationId:job.conversationId}).lean();
  if(!source||!['guest','customer'].includes(source.author))return false;
  return !!(await Conversation.exists({_id:job.conversationId,channel:'site',aiMode:'assist',status:{$ne:'closed'},
    lastMessageAt:source.createdAt,lastSender:{$in:['customer','guest']}}));
}
async function autoDeliverSiteReply(job,answer) {
  if (!await latestCustomerMessage(job)) return false;
  const source=await ConversationMessage.findById(job.conversationMessageId).lean();
  if(!source)return false;
  const session=await mongoose.startSession();
  try {
    await session.withTransaction(async()=>{
      const messageId=new mongoose.Types.ObjectId(),now=new Date();
      const updated=await Conversation.updateOne({_id:job.conversationId,channel:'site',aiMode:'assist',status:{$ne:'closed'},
        lastMessageAt:source.createdAt,lastSender:{$in:['customer','guest']}},
        {$set:{lastMessageAt:now,lastMessageText:answer.slice(0,180),lastSender:'ai',status:'open'},
         $inc:{messageCount:1,unreadCustomer:1}},{session});
      if(!updated.modifiedCount){const e=new Error('STALE_OR_HUMAN_TAKEOVER');e.code='STALE_OR_HUMAN_TAKEOVER';throw e;}
      await ConversationMessage.create([{_id:messageId,conversationId:job.conversationId,author:'ai',text:answer,
        dedupeKey:'auto:'+String(job._id),delivery:'site',createdAt:now}],{session});
    });
    return true;
  } finally { await session.endSession(); }
}
async function submitResult(credential, id, body) {
  if (!mongoose.isValidObjectId(id)) return { status: 400, code: 'BAD_JOB_ID' };
  const lease = body?.leaseToken;
  if (typeof lease !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(lease)) return { status: 400, code: 'BAD_LEASE' };
  // Older Termux workers sent leaseToken/ok/draft only. The cryptographic single-use
  // lease is the authority; optional jobVersion still protects against stale clients.
  if (body?.jobVersion != null && (!Number.isInteger(body.jobVersion) || body.jobVersion < 1))
    return {status:400,code:'BAD_JOB_VERSION'};
  if (body?.idempotencyKey != null && !/^[0-9a-f-]{36}$/i.test(String(body.idempotencyKey)))
    return {status:400,code:'BAD_IDEMPOTENCY_KEY'};
  const ok = body?.ok === true;
  if (ok && !ensureGoodText(body?.draft, 1000)) return {status:400,code:'BAD_DRAFT'};
  // Mentioning that an OTP or password is private is safe. Block only actual
  // credential-shaped material; redact instead of repeatedly rejecting a lease.
  const unsafeDraft = ok && /(?:ovira_agent_[A-Za-z0-9_-]{15,}|Bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9_-]{20,}|(?:password|api[_ -]?key|secret)\s*[:=]\s*\S{8,})/i.test(body.draft);
  const reviewedText = unsafeDraft ? 'تحتاج هذه الإجابة إلى مراجعة الموظف قبل إرسالها؛ تم حجب محتوى اعتماد محتمل.' : (ok ? body.draft.trim() : '');
  const now = new Date();
  const hash = crypto.createHash('sha256').update(lease).digest('hex');
  const patch = ok ? { status: 'review', resultText: reviewedText, errorCode: unsafeDraft ? 'REDACTED' : '', completedAt: now } : {
    status: 'failed', errorCode: (String(body?.errorCode || 'MODEL_ERROR').replace(/[^A-Z_]/g, '').slice(0,50) || 'MODEL_ERROR'), completedAt: now
  };
  const condition = { _id: id, status: 'leased', leaseOwner: credential._id, leaseTokenHash: hash, leaseExpiresAt: { $gt: now } };
  if (body?.jobVersion != null) condition.jobVersion = body.jobVersion;
  const job = await AgentJob.findOneAndUpdate(condition, { $set: patch, $unset: { leaseTokenHash: '' } }, { new: true });
  if (!job) return { status: 409, code: 'LEASE_EXPIRED_OR_CONSUMED' };
  if (job.kind === 'support_draft' && job.resourceId) {
    await SupportMessage.updateOne({ _id: job.resourceId, status: { $ne: 'closed' } }, { $set: ok ? { aiDraft: patch.resultText, status: 'draft_ready' } : { status: 'review' } });
  }
  let autoReplyDelivered = false;
  if (job.kind === 'conversation_draft' && job.conversationId && job.conversationMessageId) {
    const conv = await Conversation.findById(job.conversationId).lean();
    if (conv && conv.status !== 'closed' && conv.aiMode === 'assist') {
      if (ok) await ConversationMessage.updateOne({ _id:job.conversationMessageId,conversationId:conv._id }, {$set:{ aiDraft:patch.resultText }});
      // Optional owner-approved website-only model replies. Auto-delivery uses
      // an atomic MongoDB transaction and CAS on the exact latest customer message.
      // A later message, a human takeover, or any untrusted output keeps review.
      let siteReplySent = false;
      let sentReplyText = '';
      if (ok && !unsafeDraft && conv.channel === 'site' && process.env.AI_SITE_AUTO_REPLY_ALLOWED === 'true') {
        const cfg = await AgentSettings.findById('local-agent-v1').lean();
        if (cfg?.supportHumanOnly === false && cfg?.autoSiteRepliesEnabled && cfg.enabled && cfg.executionEnabled && !cfg.killSwitch && safeForAI(job.inputText)) {
          let autoText=eligibleSiteReply(job.inputText,patch.resultText)?patch.resultText:null;
          // Product prices are ONLY composed from the live MongoDB catalog;
          // never send a currency amount invented by the language model.
          if(priceIntent(job.inputText)){
            autoText=null;
            try {
              const verifiedCatalog=await liveContext(job.inputText);
              if(verifiedCatalog.startsWith('كتالوج حي من MongoDB')){
                const lines=verifiedCatalog.split('\n').slice(1).filter(x=>x.includes(' دج')).slice(0,3);
                if(lines.length) autoText=('الأسعار الموثقة حاليًا في المتجر:\n'+lines.join('\n')).slice(0,900);
              }
            }catch(_){/* no price until server confirms it */}
          }
          if(autoText){
            try {
              siteReplySent=await autoDeliverSiteReply(job,autoText);
              if(siteReplySent) sentReplyText=autoText;
            } catch(e){console.error('[AI] automatic reply left for review:',e.code||e.name);}
          }
        }
      }
      // Approved deterministic FAQ remains available as a separate policy.
      // Only predefined FAQ responses can be posted to a website conversation, after owner opt-in.
      if (ok && !siteReplySent && conv.channel === 'site' && process.env.AI_SITE_AUTO_FAQ_ALLOWED === 'true') {
        const cfg = await AgentSettings.findById('local-agent-v1').lean();
        const answer = cfg?.supportHumanOnly === false && cfg?.autoSiteFaqEnabled ? approvedSiteFaq(job.inputText) : null;
        if (answer && await latestCustomerMessage(job)) {
          try {
            siteReplySent = await autoDeliverSiteReply(job,answer);
            if(siteReplySent) sentReplyText=answer;
          } catch(e) { if(e.code!==11000) console.error('[AI] auto FAQ delivery deferred:',e.code||e.name); }
        }
      }
      if(siteReplySent) {
        autoReplyDelivered = true;
        // The source message must no longer expose an approvable draft after delivery.
        await ConversationMessage.updateOne(
          {_id:job.conversationMessageId,conversationId:conv._id},
          {$unset:{aiDraft:''}}
        );
        // Make the delivered state explicit so the admin inbox cannot present it as pending review.
        await AgentJob.updateOne({_id:job._id,status:'review'},{
          $set:{status:'sent',resultText:sentReplyText,completedAt:new Date()}
        });
      }
      await Conversation.updateOne({_id:conv._id,status:'review'},{$set:{status:'open'}});
    }
  }
  return { status: 200, code: ok ? (job.kind === 'conversation_draft' && autoReplyDelivered ? 'AUTO_SENT' : 'DRAFT_READY') : 'JOB_FAILED' };
}
module.exports = { AgentJob, enqueue, claim, submitResult };
