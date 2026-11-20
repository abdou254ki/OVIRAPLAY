'use strict';
// Mocked endpoint/service contract only; MongoDB transactions on Atlas still require staging verification.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Module=require('node:module');
const original=Module._load;
const jid='507f191e810c19729de860ea', cid='507f191e810c19729de860eb',mid='507f191e810c19729de860ec';
const lease='z'.repeat(43);
const sourceTime=new Date('2026-11-08T10:00:00.000Z');
const source={_id:mid,conversationId:cid,author:'customer',text:'مرحبا ما هي خطوات الشراء؟',createdAt:sourceTime};
let current, job, sent=[];let humanOnly=false;
const query=x=>({async lean(){return x}});
const mongoose={isValidObjectId:x=>/^[a-f0-9]{24}$/.test(x),Types:{ObjectId:class{toString(){return '507f191e810c19729de860ed'}}},
 async startSession(){return {async withTransaction(fn){await fn();},async endSession(){}}}};
const jobs={
 async findOneAndUpdate(filter,update){
  if(job.status!=='leased'||filter._id!==jid||filter.leaseTokenHash!==job.leaseTokenHash)return null;
  Object.assign(job,update.$set);return {...job};
 },
 async updateOne(filter,update){
  if(String(filter._id)===String(job._id)&&job.status===filter.status)Object.assign(job,update.$set||{});
  return {modifiedCount:1};
 }
};
const conv={findById(){return query({...current})},exists(filter){return Promise.resolve(!!current&&current.aiMode==='assist'&&current.status!=='closed'&&current.lastSender==='customer'&&current.lastMessageAt.getTime()===sourceTime.getTime());},
 async updateOne(filter,update){
 if(filter.lastMessageAt && (!current || current.aiMode!=='assist'||current.lastSender!=='customer'||current.lastMessageAt.getTime()!==sourceTime.getTime()))return {modifiedCount:0};
 if(update.$set)Object.assign(current,update.$set);return {modifiedCount:1};
}};
const draftUpdates=[];
const msgs={findOne(){return query(source)},findById(){return query(source)},async updateOne(filter,update){draftUpdates.push({filter,update});return {modifiedCount:1}},async create(docs){for(const d of docs)sent.push(d);return docs}};
const settings={findById(){return query({enabled:true,executionEnabled:true,autoSiteRepliesEnabled:true,killSwitch:false,supportHumanOnly:humanOnly})}};
const mocked={mongoose,'../models/AgentJob':jobs,'../models/SupportMessage':{},'../models/Conversation':conv,
 '../models/ConversationMessage':msgs,'../models/AgentSettings':settings,
 './agentPolicyService':{APPROVED_CONTEXT:'Only public help',approvedSiteFaq(){return null},safeForAI:()=>true,eligibleSiteReply:(q,a)=>!!a&&!a.includes('secret')},
 './catalogAiContext':{async liveContext(){return ''},priceIntent:()=>false},
 './knowledgeService':{async knowledgeContext(){return ''}}};
Module._load=function(req,parent,isMain){if(parent?.filename?.endsWith('agentJobService.js')&&Object.hasOwn(mocked,req))return mocked[req];return original.call(this,req,parent,isMain)};
const service=require('../services/agentJobService');Module._load=original;
function reset(mode='assist',latest=sourceTime){current={_id:cid,channel:'site',status:'review',aiMode:mode,lastSender:'customer',lastMessageAt:latest};job={_id:jid,kind:'conversation_draft',conversationId:cid,conversationMessageId:mid,inputText:source.text,status:'leased',leaseOwner:cid,leaseTokenHash:crypto.createHash('sha256').update(lease).digest('hex')};sent=[];draftUpdates.length=0;}
async function result(){return service.submitResult({_id:cid},jid,{ok:true,leaseToken:lease,draft:'ابدأ من المتجر واختر الباقة المناسبة ثم أكمل الطلب.'});}
(async()=>{
 process.env.AI_SITE_AUTO_REPLY_ALLOWED='true';
 reset();let r=await result();assert.equal(r.status,200);assert.equal(r.code,'AUTO_SENT');assert.equal(sent.length,1,'safe public reply reaches site chat exactly once');assert.equal(sent[0].author,'ai');assert.equal(current.lastSender,'ai');assert.equal(job.status,'sent','delivered job is not left in review');assert.equal(draftUpdates.some(x=>x.update.$unset?.aiDraft!==undefined),true,'sent source message no longer exposes an approvable draft');
 reset('human');r=await result();assert.equal(r.status,200);assert.equal(sent.length,0,'human takeover blocks auto-send');
 reset('assist',new Date(sourceTime.getTime()+1000));r=await result();assert.equal(r.status,200);assert.equal(sent.length,0,'stale generated result never sent after newer customer message');
 humanOnly=true;reset();r=await result();assert.equal(r.status,200);assert.equal(sent.length,0,'global human support blocks automatic Qwen sends');humanOnly=false;
 process.env.AI_SITE_AUTO_REPLY_ALLOWED='false';reset();r=await result();assert.equal(r.status,200);assert.equal(sent.length,0,'feature flag defaults off');
 console.log('PASS: model reply opt-in, atomic customer-only send, sent status, draft cleanup, human takeover, stale-turn suppression, disabled mode');
})().catch(e=>{console.error(e);process.exitCode=1});
