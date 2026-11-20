// Preflight V2 indexes; dry-run by default. Never applies implicitly at server boot.
const apply=process.argv.includes('--apply');
const inspect=process.argv.includes('--inspect');
if(apply&&inspect)throw new Error('Choose either --apply or --inspect, not both.');
const expected=[
 {collection:'conversations',index:{lastMessageAt:-1,_id:-1},options:{name:'lastMessageAt_-1__id_-1'}},
 {collection:'conversations',index:{channel:1,lastMessageAt:-1,_id:-1},options:{name:'channel_1_lastMessageAt_-1__id_-1'}},
 {collection:'conversations',index:{aiMode:1,lastMessageAt:-1},options:{name:'aiMode_1_lastMessageAt_-1'}},
 {collection:'conversations',index:{unreadAdmin:-1,lastMessageAt:-1},options:{name:'unreadAdmin_-1_lastMessageAt_-1'}},
 {collection:'conversationmessages',index:{conversationId:1,createdAt:-1,_id:-1},options:{name:'conversationId_1_createdAt_-1__id_-1'}},
 {collection:'agentjobs',index:{conversationId:1,status:1},options:{name:'conversationId_1_status_1'}},
 {collection:'agentjobs',index:{status:1,leaseExpiresAt:1},options:{name:'status_1_leaseExpiresAt_1'}},
 {collection:'agentcredentials',index:{tokenHash:1},options:{unique:true,name:'tokenHash_1'}},
 {collection:'agentjobs',index:{dedupeKey:1},options:{unique:true,name:'dedupeKey_1'}},
 {collection:'agentjobs',index:{status:1,notBefore:1,priority:-1,createdAt:1},options:{name:'status_1_notBefore_1_priority_-1_createdAt_1'}},
 {collection:'supportmessages',index:{provider:1,providerMessageId:1},options:{unique:true,name:'provider_1_providerMessageId_1'}},
 {collection:'historicalsales',index:{sourceChannel:1,externalRef:1},options:{unique:true,name:'sourceChannel_1_externalRef_1'}},
 {collection:'conversations',index:{customerId:1,lastMessageAt:-1},options:{name:'customerId_1_lastMessageAt_-1'}},
 {collection:'conversations',index:{channel:1,customerId:1,isPrimarySupportThread:1},options:{name:'channel_1_customerId_1_isPrimarySupportThread_1',unique:true,partialFilterExpression:{channel:'site',customerId:{$type:'objectId'},isPrimarySupportThread:true}}},
 {collection:'conversations',index:{status:1,lastMessageAt:-1},options:{name:'status_1_lastMessageAt_-1'}},
 {collection:'conversations',index:{channel:1,providerThreadId:1},options:{name:'channel_1_providerThreadId_1',unique:true,partialFilterExpression:{providerThreadId:{$type:'string'}}}},
 {collection:'conversations',index:{legacyComplaintId:1},options:{name:'legacyComplaintId_1',unique:true,partialFilterExpression:{legacyComplaintId:{$type:'objectId'}}}},
 {collection:'conversations',index:{legacySupportMessageId:1},options:{name:'legacySupportMessageId_1',unique:true,partialFilterExpression:{legacySupportMessageId:{$type:'objectId'}}}},
 {collection:'conversationmessages',index:{conversationId:1,createdAt:1},options:{name:'conversationId_1_createdAt_1'}},
 {collection:'conversationmessages',index:{providerMessageId:1},options:{name:'providerMessageId_1',unique:true,partialFilterExpression:{providerMessageId:{$type:'string'}}}},
 {collection:'conversationmessages',index:{conversationId:1,dedupeKey:1},options:{name:'conversationId_1_dedupeKey_1',unique:true,partialFilterExpression:{dedupeKey:{$type:'string'}}}},
 {collection:'sitenotifications',index:{customerId:1,createdAt:-1},options:{name:'customerId_1_createdAt_-1'}},
 {collection:'sitenotifications',index:{customerId:1,dedupeKey:1},options:{name:'customerId_1_dedupeKey_1',unique:true,partialFilterExpression:{dedupeKey:{$type:'string'}}}},
 {collection:'knowledgeentries',index:{active:1,category:1,updatedAt:-1},options:{name:'active_1_category_1_updatedAt_-1'}},
 {collection:'notificationcampaigns',index:{createdAt:-1},options:{name:'createdAt_-1'}},
 {collection:'siteannouncements',index:{enabled:1,startsAt:-1,expiresAt:1},options:{name:'enabled_1_startsAt_-1_expiresAt_1'}}
];
async function main(){
  console.log(JSON.stringify({mode:apply?'APPLY':inspect?'INSPECT-READ-ONLY':'DRY-RUN',database:'MongoDB Atlas (existing only)',indexes:expected},null,2));
  if (!apply && !inspect){console.log('No database connection or changes in dry-run mode.');return;}
  require('dotenv').config();
  const mongoose=require('mongoose');
  if(apply&&process.env.V2_SCHEMA_APPLY!=='I_UNDERSTAND_BACKUP_REQUIRED')throw new Error('Refusing apply: set V2_SCHEMA_APPLY=I_UNDERSTAND_BACKUP_REQUIRED after verified backup.');
  if(apply&&process.env.NODE_ENV==='production'&&process.env.V2_PRODUCTION_APPROVED!=='true')throw new Error('Production DB apply requires explicit V2_PRODUCTION_APPROVED=true and verified rollback.');
  if(!process.env.MONGODB_URI)throw new Error('Missing MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
  try {
    if(inspect){
      let missing=0,conflicts=0;
      for(const spec of expected){
        const collections=await mongoose.connection.db.listCollections({name:spec.collection}).toArray();
        if(!collections.length){console.log('MISSING_COLLECTION',spec.collection,spec.options.name);missing++;continue;}
        const indexes=await mongoose.connection.db.collection(spec.collection).listIndexes().toArray();
        const existing=indexes.find(x=>x.name===spec.options.name);
        if(!existing){console.log('MISSING_INDEX',spec.collection,spec.options.name);missing++;continue;}
        const sameKey=JSON.stringify(existing.key)===JSON.stringify(spec.index);
        const sameUnique=Boolean(existing.unique)===Boolean(spec.options.unique);
        const samePartial=JSON.stringify(existing.partialFilterExpression||null)===JSON.stringify(spec.options.partialFilterExpression||null);
        if(!sameKey||!sameUnique||!samePartial){console.log('INDEX_CONFLICT',spec.collection,spec.options.name);conflicts++;}
        else console.log('INDEX_OK',spec.collection,spec.options.name);
      }
      console.log('INSPECTION_DONE',JSON.stringify({missing,conflicts,mutations:0}));
      if(conflicts)process.exitCode=2;
      return;
    }
    // Explicit index creation; these collections are new and do not alter legacy Order/Customer.
    for(const spec of expected){
      const existing=await mongoose.connection.db.listCollections({name:spec.collection}).toArray();
      if(!existing.length)await mongoose.connection.db.createCollection(spec.collection);
      const name=await mongoose.connection.db.collection(spec.collection).createIndex(spec.index,spec.options);
      console.log('Index confirmed',spec.collection,name);
    }
  } finally { await mongoose.disconnect(); }
}
main().catch(err=>{console.error(err.message);process.exit(1)});
