// Preserve all legacy records. Idempotent import to the unified inbox; dry-run without --apply.
require('dotenv').config();
const mongoose = require('mongoose');
const apply = process.argv.includes('--apply');
async function main() {
  if (!apply) {
    console.log('DRY-RUN: no connection and no data changes. --apply needs a verified backup, SUPPORT_MIGRATION_APPROVED=yes and DB credentials.');
    console.log('Legacy Complaint documents become admin-visible archived conversations; never silently linked to a customer by phone.');
    return;
  }
  if(process.env.SUPPORT_MIGRATION_APPROVED !== 'yes') throw new Error('SUPPORT_MIGRATION_APPROVED=yes required after backup');
  if(process.env.NODE_ENV==='production' && process.env.V2_PRODUCTION_APPROVED!=='true') throw new Error('V2_PRODUCTION_APPROVED=true required in production');
  if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI missing');
  const Complaint=require('../models/Complaint');
  const SupportMessage=require('../models/SupportMessage');
  const {Conversation,ConversationMessage}=require('../services/conversationService');
  await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
  let cCount=0,wCount=0;
  try {
    for await(const x of Complaint.find({}).sort({_id:1}).cursor()) {
      const conv=await Conversation.findOneAndUpdate({legacyComplaintId:x._id},{ $setOnInsert:{channel:'legacy',legacyComplaintId:x._id,subject:x.subject||'شكوى قديمة',guestName:x.customerName||'',guestPhone:x.whatsappNumber||'',status:x.status==='مغلقة'?'closed':'open',lastMessageAt:x.createdAt||new Date(),lastMessageText:String(x.message||'').slice(0,180),lastSender:'guest'} },{upsert:true,new:true,setDefaultsOnInsert:true});
      // Save the original thread without touching the old row. Imported records are admin-only.
      const firstKey='legacy:complaint:'+x._id;
      if(x.message)await ConversationMessage.updateOne({conversationId:conv._id,dedupeKey:firstKey},{$setOnInsert:{conversationId:conv._id,dedupeKey:firstKey,author:'guest',text:String(x.message).slice(0,2000),delivery:'internal',createdAt:x.createdAt||new Date()}},{upsert:true});
      if(x.adminReply)await ConversationMessage.updateOne({conversationId:conv._id,dedupeKey:firstKey+':reply'},{$setOnInsert:{conversationId:conv._id,dedupeKey:firstKey+':reply',author:'admin',text:String(x.adminReply).slice(0,2000),delivery:'internal',createdAt:x.repliedAt||new Date()}},{upsert:true});
      cCount++;
    }
    for await(const x of SupportMessage.find({}).select('+senderWaId').sort({_id:1}).cursor()) {
      const id=String(x.senderWaId||'');
      if(!/^\d{7,20}$/.test(id))continue;
      const conv=await Conversation.findOneAndUpdate({channel:'whatsapp',providerThreadId:id},{$setOnInsert:{channel:'whatsapp',providerThreadId:id,subject:'WhatsApp',status:'open',lastMessageAt:x.createdAt||new Date(),lastMessageText:String(x.text||'').slice(0,180),lastSender:'whatsapp'}},{upsert:true,new:true,setDefaultsOnInsert:true});
      await ConversationMessage.updateOne({providerMessageId:x.providerMessageId},{$setOnInsert:{conversationId:conv._id,providerMessageId:x.providerMessageId,author:'whatsapp',text:String(x.text||'[رسالة غير نصية]').slice(0,2000),delivery:'received',createdAt:x.createdAt||new Date()}},{upsert:true});
      wCount++;
    }
    console.log('Migration complete. Legacy complaints:',cCount,'legacy WhatsApp messages:',wCount,'Original documents preserved.');
  } finally {await mongoose.disconnect();}
}
main().catch(e=>{console.error('Migration error:',e.message);process.exit(1)});
