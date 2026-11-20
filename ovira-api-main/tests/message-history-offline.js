'use strict';
// No MongoDB or network. Executes both route handlers with fake query chains.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Module=require('node:module');
const originalLoad=Module._load;
const convId='507f191e810c19729de860ea';
const guestKey='a'.repeat(64);
const messages=Array.from({length:300},(_,i)=>({
  _id:i.toString(16).padStart(24,'0'),
  conversationId:convId,
  createdAt:new Date(Date.UTC(2026,10,8,10,0,Math.floor(i/2))),
  text:'message-'+i,
  author:'guest'
}));
const doc={_id:convId,customerId:null,channel:'site',status:'open',subject:'test',unreadAdmin:0,unreadCustomer:0,
  lastMessageAt:new Date('2026-11-08T10:10:00Z'),guestTokenHash:crypto.createHash('sha256').update(guestKey).digest('hex')};
let writes=[];
const clone=x=>structuredClone(x);
const conversation={
  findById(id){return {select(){return this;},lean:async()=>String(id)===convId?clone(doc):null,then(ok){return Promise.resolve(String(id)===convId?clone(doc):null).then(ok);}};},
  async updateOne(filter,update){
    writes.push({filter:update?clone(filter):null,update:clone(update)});
    const cond=filter.lastMessageAt===undefined || new Date(filter.lastMessageAt).getTime()===doc.lastMessageAt.getTime();
    const unread=filter.unreadAdmin?.$gt!==undefined?'unreadAdmin':'unreadCustomer';
    if(cond && doc[unread]>0){Object.assign(doc,update.$set);return {modifiedCount:1};}
    return {modifiedCount:0};
  }
};
const ConversationMessage={
  find(filter){
    assert.equal(String(filter.conversationId),convId);
    let sortKeys=null,limitN=0;
    return {
      sort(spec){sortKeys=spec;return this;},
      limit(n){limitN=n;return this;},
      async lean(){
        assert.deepEqual(sortKeys,{createdAt:-1,_id:-1},'must fetch newest with deterministic tie break');
        return messages.slice().sort((a,b)=>b.createdAt-a.createdAt||b._id.localeCompare(a._id)).slice(0,limitN).map(clone);
      }
    };
  }
};
const fakeService={Conversation:conversation,ConversationMessage,
  digest(s){return crypto.createHash('sha256').update(s).digest('hex');},
  publicConversation:row=>row,
  publicMessage:row=>row
};
const handlers={};
function makeRouter(){return {use(){},get(path,...fns){handlers[path]=fns.at(-1);},post(){},patch(){}};}
const fakeRateLimit=()=>()=>{};
function loadRouter(file){
  const router=makeRouter();
  Module._load=function(request,parent,isMain){
    if(parent?.filename?.replace(/\\/g, '/')?.endsWith('/routes/'+file+'.js')){
      if(request==='express')return {Router:()=>router};
      if(request==='express-rate-limit')return fakeRateLimit;
      if(request==='mongoose')return {isValidObjectId:x=>/^[a-f0-9]{24}$/.test(x)};
      if(request==='jsonwebtoken')return {verify(){throw Error('not used')}};
      if(request==='../models/Customer')return {findById(){throw Error('not used')}};
      if(request==='../services/conversationService')return fakeService;
      if(request==='../models/Audit')return {create(){}};
      if(request==='../models/AgentJob')return {updateMany(){}};
      if(request==='../services/agentCredentialService')return {requireStepUp(){}};
    }
    return originalLoad.call(this,request,parent,isMain);
  };
  try {require('../routes/'+file);} finally {Module._load=originalLoad;}
  return handlers['/:id'];
}
const adminGet=loadRouter('adminConversations');
const customerGet=loadRouter('conversations');
async function invoke(handler){
  const result={status:0,data:null};
  const req={params:{id:convId},query:{},admin:{role:'owner'},get(k){return k==='x-conversation-key'?guestKey:'';}};
  const res={set(){return this;},json(data){result.data=data;result.status=200;return this;},sendStatus(status){result.status=status;return this;}};
  await handler(req,res,err=>{throw err;});
  assert.equal(result.status,200);assert.equal(result.data.success,true);
  return result.data;
}
(async()=>{
  const a=await invoke(adminGet);
  assert.equal(a.messages.length,200);
  assert.equal(a.messages[0].text,'message-100');
  assert.equal(a.messages.at(-1).text,'message-299');
  assert.equal(writes.length,0,'Admin idle poll must not write');
  doc.unreadAdmin=2;
  const b=await invoke(adminGet);
  assert.equal(b.conversation.unreadAdmin,0);
  assert.equal(writes.length,1,'Admin unread must be cleared only once');
  assert.ok(writes[0].filter.lastMessageAt,'Do not clear newer messages on stale poll');
  const c=await invoke(customerGet);
  assert.equal(c.messages.length,150);
  assert.equal(c.messages[0].text,'message-150');
  assert.equal(c.messages.at(-1).text,'message-299');
  assert.equal(writes.length,1,'Customer idle poll must not write');
  doc.unreadCustomer=5;
  const d=await invoke(customerGet);
  assert.equal(d.conversation.unreadCustomer,0);
  assert.equal(writes.length,2,'Customer unread must be cleared only once');
  console.log('PASS: newest admin/customer histories, chronological display, no idle writes, conditional read acknowledgement');
})().catch(err=>{console.error(err);process.exitCode=1;});
