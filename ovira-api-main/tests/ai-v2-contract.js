// Offline contract tests, no network, no MongoDB/production secrets.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('module');
const origLoad = Module._load;
process.env.JWT_SECRET = 'test_' + 'a'.repeat(50);
const users = new Map();
const fakeUsage = {
  findById(id) { return { async lean() { return users.get(id) ? structuredClone(users.get(id)) : null; } }; },
  async create(row) { if (users.has(row._id)) {const e = new Error('duplicate');e.code=11000;throw e;} users.set(row._id,structuredClone(row)); },
  async updateOne(filter, update) {
    const previous = users.get(filter._id);
    if (!previous || previous.revision !== filter.revision) return {modifiedCount:0};
    users.set(filter._id,{...previous,timestamps:update.$set.timestamps,revision:previous.revision+1});
    return {modifiedCount:1};
  }
};
const stubModules = { '../models/AgentUsage': fakeUsage };
Module._load = function(req,parent,isMain) {
  if (parent?.filename?.endsWith('agentPolicyService.js') && stubModules[req]) return stubModules[req];
  return origLoad.call(this,req,parent,isMain);
};
const policy = require('../services/agentPolicyService');
Module._load = origLoad;

async function testPolicy(){
  assert.equal(policy.safeForAI('مرحبا كيف أعرف الأسعار؟'),true);
  assert.equal(policy.safeForAI('مرحبا أريد رقم الطلب OP-123456'),false);
  assert.equal(policy.safeForAI('password:123456'),false);
  assert.equal(policy.safeForAI('السلام عليكم كيف اشترك؟'),true);
  assert.equal(policy.safeForAI('كيف يمكنني الدخول إلى حسابي؟'),true,'public account how-to must not be rejected');
  assert.equal(policy.safeForAI('كم بقي من الرصيد في حسابي؟'),false,'private account balance never goes to LLM');
  assert.equal(policy.safeForAI('OTP 888888'),false);
  assert.equal(policy.safeForAI('أريد استرجاع حسابي'),false);
  const successes = await Promise.all(Array.from({length:30},()=>policy.reserveHourlyMessage('213555123456')));
  assert.equal(successes.filter(Boolean).length,20,'20 AI attempts per rolling hour, even under contention');
  assert.equal(await policy.reserveHourlyMessage('213555123456'),false);
  assert.equal(await policy.reserveHourlyMessage('213777777777'),true,'distinct customers get distinct limits');
  assert.equal([...users.keys()].some(x=>x.includes('213555')),false,'no raw phone stored as usage key');
}

async function testWebhook(){
  let handleGet,handlePost;
  const received=[],seen=new Set();
  const fakeRouter={use(){},get(_path,fn){handleGet=fn;},post(_path,fn){handlePost=fn;}};
  const fakeExpress={Router(){return fakeRouter;}};
  const conv={_id:'507f191e810c19729de860ea',channel:'whatsapp'};
  const chats={async getWhatsAppConversation(){return conv;},async appendMessage(_conv,_author,text,options){
    if(seen.has(options.providerMessageId))return {created:false,message:{text}};
    seen.add(options.providerMessageId);received.push({text,...options});return {created:true,message:{text}};
  },async maybeQueueDraft(){received.at(-1).queued=true;}};
  Module._load=function(req,parent,isMain){
    if(parent?.filename?.endsWith('/routes/whatsapp.js')){
      if(req==='express')return fakeExpress;
      if(req==='express-rate-limit')return ()=>()=>{};
      if(req==='../services/conversationService')return chats;
    }
    return origLoad.call(this,req,parent,isMain);
  };
  require('../routes/whatsapp');Module._load=origLoad;
  process.env.WHATSAPP_INBOUND_ENABLED='true';
  process.env.WHATSAPP_VERIFY_TOKEN='verify_test';
  process.env.WHATSAPP_APP_SECRET='test-secret';
  process.env.WHATSAPP_PHONE_NUMBER_ID='phoneid';
  function res(){return {code:0,data:null,sendStatus(n){this.code=n;},type(){return this;},send(d){this.code=200;this.data=d;}};}
  const verify=res();handleGet({query:{'hub.mode':'subscribe','hub.verify_token':'verify_test','hub.challenge':'123456'}},verify);
  assert.equal(verify.data,'123456');
  const body={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'phoneid'},messages:[{id:'wamid.abcd12345',from:'213555123456',type:'text',text:{body:'مرحبا كيف أعرف الأسعار؟'}}]}}]}]};
  const raw=Buffer.from(JSON.stringify(body));
  const sig='sha256='+crypto.createHmac('sha256','test-secret').update(raw).digest('hex');
  const req={rawBody:raw,body,get(name){return name.toLowerCase()==='x-hub-signature-256'?this.sig:null;},sig:'sha256='+'0'.repeat(64)};
  const invalid=res();await handlePost(req,invalid,err=>{throw err;});
  assert.equal(invalid.code,401);assert.equal(received.length,0);
  req.sig=sig;const success=res();await handlePost(req,success,err=>{throw err;});
  assert.equal(success.code,200);assert.equal(received.length,1);assert.equal(received[0].queued,true);
  const repeat=res();await handlePost(req,repeat,err=>{throw err;});
  assert.equal(repeat.code,200);assert.equal(received.length,1,'Webhook redelivery does not create duplicate messages');
  console.log('PASS: WhatsApp webhook signature and idempotent unified inbox');
}
(async()=>{await testPolicy();await testWebhook();console.log('PASS: safe-category filtering, 20/hour rolling quota with contention, HMAC webhook verification, idempotent incoming message');})().catch(e=>{console.error(e);process.exitCode=1;});
