'use strict';
// Database-free contract test for unified messages and AI drafting. No production traffic.
const assert=require('node:assert/strict');
const Module=require('node:module');
const orig=Module._load;
const conv={_id:'507f191e810c19729de860ea',channel:'site',status:'open',aiMode:'assist'};
const items=[];const jobs=[];let humanOnly=false;
let serial=0;
const Messages={
 async create(doc){
   if(doc.dedupeKey&&items.some(x=>x.dedupeKey===doc.dedupeKey)) {const e=new Error('duplicate');e.code=11000;throw e;}
   if(doc.providerMessageId&&items.some(x=>x.providerMessageId===doc.providerMessageId)){const e=new Error('duplicate');e.code=11000;throw e;}
   const x={_id:'507f191e810c19729de860e'+(++serial),createdAt:new Date(),...doc};items.push(x);return x;
 },
 async findOne(filter){return items.find(x=>Object.entries(filter).every(([k,v])=>String(x[k])===String(v)))||null;},
 find(filter){return {sort(){return this;},limit(){return this;},async lean(){return items.filter(x=>String(x.conversationId)===String(filter.conversationId));}};},
 async updateOne(filter,patch){const x=items.find(x=>String(x._id)===String(filter._id));if(x)Object.assign(x,patch.$set);}
};
const Conversation={
 async updateOne(filter,patch){if(String(filter._id)===conv._id){Object.assign(conv,patch.$set);conv.messageCount=(conv.messageCount||0)+(patch.$inc?.messageCount||0);}},
 async findOneAndUpdate(filter,patch){return conv;}
};
const mocks={
 '../models/Conversation':Conversation,
 '../models/ConversationMessage':Messages,
 '../models/AgentSettings':{findById(){return {lean:async()=>({enabled:true,executionEnabled:true,supportHumanOnly:humanOnly})};}},
 './agentPolicyService':{async reserveHourlyMessage(){return true;},safeForAI(t){return t.startsWith('مرحبا');}},
 './agentJobService':{async enqueue(kind,key,text,_r,meta){jobs.push({kind,key,text,meta});return {_id:'507f191e810c19729de860ed'};}}
};
Module._load=function(req,parent,isMain){if(parent?.filename?.endsWith('conversationService.js')&&mocks[req])return mocks[req];return orig.call(this,req,parent,isMain);};
const s=require('../services/conversationService');Module._load=orig;
(async()=>{
 assert.equal(s.validText('A'),false);assert.equal(s.validText('Hello'),true);
 const one=await s.appendMessage(conv,'guest','مرحبا كيف أشترك؟',{providerMessageId:'wa-msg-00001',delivery:'received'});
 assert.equal(one.created,true);assert.equal(conv.messageCount,1);
 const again=await s.appendMessage(conv,'guest','مرحبا كيف أشترك؟',{providerMessageId:'wa-msg-00001',delivery:'received'});
 assert.equal(again.created,false);assert.equal(conv.messageCount,1,'Webhook retries must not increment unread counters');
 const safe=s.publicMessage({...one.message,aiDraft:'DO_NOT_EXPOSE',providerMessageId:'hidden'});
 assert.equal('aiDraft' in safe,false);assert.equal('providerMessageId' in safe,false,'private provider identity not exposed');
 process.env.AI_EXECUTION_ENABLED='true';await s.maybeQueueDraft(conv,one.message,'guest:abc');
 assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'conversation_draft');
 assert.equal(jobs[0].meta.conversationId,conv._id);assert.equal(items[0].aiJobId,'507f191e810c19729de860ed');
 await s.maybeQueueDraft(conv,{text:'طلب 654321',_id:'2'},'guest:abc');
 assert.equal(jobs.length,1,'sensitive message not sent to Qwen');
 humanOnly=true;await s.maybeQueueDraft(conv,{text:'مرحبا',_id:'3'},'guest:abc');
 assert.equal(jobs.length,1,'human-only mode does not create Qwen drafts');
 assert.equal(s.digest('secret').length,64);
 console.log('PASS: safe chat input, provider dedupe, AI draft linkage, sensitive-message exclusion, non-disclosure');
})().catch(e=>{console.error(e);process.exit(1)});
