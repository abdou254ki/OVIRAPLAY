// No MongoDB connection; verify core lease and exactly-once result contracts.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Module=require('node:module');
const orig=Module._load;
const sampleId='507f191e810c19729de860ea', workerId='507f191e810c19729de860eb';
const db=new Map(), changes=[];
const clone=x=>x?structuredClone(x):null;
function wrap(x){return {then(onSuccess,onFailure){return Promise.resolve(clone(x)).then(onSuccess,onFailure)},async lean(){return clone(x)}};}
const AgentJob={
  findOneAndUpdate(filter,update,options){
    if(filter.dedupeKey){let entry=db.get(filter.dedupeKey);if(!entry){entry={_id:sampleId, attempts:0, status:'queued', createdAt:new Date(),notBefore:new Date(),...update.$setOnInsert};db.set(filter.dedupeKey,entry);}return wrap(entry);}
    if(filter.$or){const entry=[...db.values()].find(x=>x.attempts<3&&x.notBefore<=filter.notBefore.$lte&&((x.status==='queued')||(x.status==='leased'&&x.leaseExpiresAt<=filter.notBefore)));
      if(!entry)return wrap(null);Object.assign(entry,update.$set);entry.attempts++;entry.jobVersion=(entry.jobVersion||0)+1;return wrap(entry);}
    if(filter.leaseTokenHash){const entry=[...db.values()].find(x=>x._id===filter._id&&x.status==='leased'&&x.leaseOwner===filter.leaseOwner&&x.leaseTokenHash===filter.leaseTokenHash&&(filter.jobVersion===undefined||x.jobVersion===filter.jobVersion)&&x.leaseExpiresAt>filter.leaseExpiresAt.$gt);
      if(!entry)return wrap(null);Object.assign(entry,update.$set);delete entry.leaseTokenHash;return wrap(entry);}
    throw new Error('unexpected findOneAndUpdate '+JSON.stringify(filter));
  },
  async updateMany(filter,update){for(const x of db.values())if(x.status===filter.status&&x.attempts>=filter.attempts.$gte&&x.leaseExpiresAt<=filter.leaseExpiresAt.$lte)Object.assign(x,update.$set);}
};
const mocks={
  mongoose:{isValidObjectId(s){return /^[a-f0-9]{24}$/.test(s)}},
  '../models/AgentJob':AgentJob,
  '../models/SupportMessage':{async updateOne(filter,update){changes.push({filter,update});}},
  '../models/Conversation':{},
  '../models/ConversationMessage':{},
  '../models/AgentSettings':{findById(){return {lean:async()=>({autoSiteFaqEnabled:false})};}},
  './agentPolicyService':{APPROVED_CONTEXT:'أجب من المرجع المعتمد فقط',approvedSiteFaq(){return null;}}
};
Module._load=function(req,parent,isMain){if(parent?.filename?.endsWith('agentJobService.js')&&mocks[req])return mocks[req];return orig.call(this,req,parent,isMain)};
const jobs=require('../services/agentJobService');Module._load=orig;
(async()=>{
  const row=await jobs.enqueue('support_draft','wa:abc','مرحبا',sampleId);
  assert.equal(row.status,'queued');
  assert.equal((await jobs.enqueue('support_draft','wa:abc','مرحبا',sampleId))._id,sampleId,'idempotent enqueue');
  const credential={_id:workerId};
  const lease=await jobs.claim(credential);
  assert.equal(lease.id,sampleId);assert.equal(lease.text,'مرحبا');
  assert.notEqual(lease.leaseToken,crypto.createHash('sha256').update(lease.leaseToken).digest('hex'));
  assert.equal(await jobs.claim(credential),null,'cannot claim an active lease twice');
  const bad=await jobs.submitResult(credential,sampleId,{ok:true,jobVersion:lease.jobVersion,idempotencyKey:crypto.randomUUID(),leaseToken:'x'.repeat(43),draft:'اقتراح الرد'});
  assert.equal(bad.status,409,'wrong lease is rejected');
  const result=await jobs.submitResult(credential,sampleId,{ok:true,jobVersion:lease.jobVersion,idempotencyKey:crypto.randomUUID(),leaseToken:lease.leaseToken,draft:'اقتراح الرد'});
  assert.equal(result.status,200);
  assert.equal(db.get('wa:abc').status,'review');
  assert.equal(changes.at(-1).update.$set.status,'draft_ready');
  const duplicate=await jobs.submitResult(credential,sampleId,{ok:true,jobVersion:lease.jobVersion,idempotencyKey:crypto.randomUUID(),leaseToken:lease.leaseToken,draft:'اقتراح الرد'});
  assert.equal(duplicate.status,409,'replay is rejected');
  const badId=await jobs.submitResult(credential,'not-an-id',{});
  assert.equal(badId.status,400);
  // Backward compatibility with earlier Termux builds; strong lease token still required.
  const legacyRow=await jobs.enqueue('support_draft','wa:legacy','كيف يمكن إنشاء حساب؟',sampleId);
  const legacyLease=await jobs.claim(credential);
  assert.ok(legacyLease);
  const legacyResult=await jobs.submitResult(credential,sampleId,{ok:true,leaseToken:legacyLease.leaseToken,draft:'يمكنك إنشاء حساب من صفحة حسابي. لا تشارك كلمة السر أو رمز التحقق.'});
  assert.equal(legacyResult.status,200,'legacy result accepted with a valid single-use lease');
  const replayLegacy=await jobs.submitResult(credential,sampleId,{ok:true,leaseToken:legacyLease.leaseToken,draft:'مرحبا'});
  assert.equal(replayLegacy.status,409,'legacy lease remains nonreplayable');
  console.log('PASS: legacy-worker compatibility, no 400 for safe credential warnings');
  console.log('PASS: queue idempotency, single lease, owner-bound result token, nonreplay, safe review destination');
})().catch(e=>{console.error(e);process.exitCode=1});
