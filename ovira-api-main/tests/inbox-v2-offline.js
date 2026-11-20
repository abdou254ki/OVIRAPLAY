'use strict';
// No npm deps / no DB: exercise v2 list, pagination, read ack and privacy contracts.
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
const {encodeCursor,decodeCursor,olderThan,escapedSearch}=require('../services/inboxPaging');
const {pageMessages}=require('../services/inboxMessages');
const ids=['507f191e810c19729de860e1','507f191e810c19729de860e2','507f191e810c19729de860e3'];
const start=Date.parse('2026-11-08T10:00:00.000Z');
const conversations=ids.map((id,i)=>({_id:id,customerId:i===0?'507f191e810c19729de860ef':null,guestName:i===1?'زائر خاص':'',channel:'site',status:'open',aiMode:i===1?'human':'assist',lastMessageAt:new Date(start-i*60000),unreadAdmin:i===0?2:0,lastSender:'customer',lastMessageText:'مرحباً',subject:'استفسار'}));
const messages=Array.from({length:93},(_,i)=>({_id:i.toString(16).padStart(24,'0'),conversationId:ids[0],text:'رسالة '+i,author:'customer',createdAt:new Date(start+i*1000)}));
const captured={get:{},post:{}};let readWrites=0,customerQueries=0;
const fakeService={
 Conversation:{
   find(filter){return {sort(spec){assert.equal(spec._id,-1);return this;},limit(n){this.n=n;return this;},async lean(){
    let rows=conversations.slice();
    if(filter?.$and){const cur=filter.$and[0]?.$or;const eq=cur?.[1];if(eq)rows=rows.filter(x=>x.lastMessageAt<cur[0].lastMessageAt.$lt || (x.lastMessageAt.getTime()===eq.lastMessageAt.getTime() && x._id<eq._id.$lt));}
    if(filter?.unreadAdmin)rows=rows.filter(x=>x.unreadAdmin>0);
    if(filter?.aiMode)rows=rows.filter(x=>x.aiMode===filter.aiMode);
    return rows.slice(0,this.n);
   }};},
   findById(id){return {select(){return this;},lean:async()=>conversations.find(x=>x._id===id)||null,then(resolve){return Promise.resolve(conversations.find(x=>x._id===id)||null).then(resolve);}};},
   async updateOne(){readWrites++;return {modifiedCount:1};},
   async countDocuments(){return 3;}
 },
 ConversationMessage:{
   find(filter){return {sort(){return this;},limit(n){this.n=n;return this;},async lean(){
    let rows=messages.slice();
    if(filter.$and){const cond=filter.$and[1].$or;
      rows=rows.filter(m=>m.createdAt<cond[0].createdAt.$lt || (m.createdAt.getTime()===cond[1].createdAt.getTime()&&m._id<cond[1]._id.$lt));
    }
    return rows.sort((a,b)=>b.createdAt-a.createdAt||b._id.localeCompare(a._id)).slice(0,this.n);
   }};}
 },
 publicConversation:row=>row, publicMessage:m=>{const {_id,author,text,createdAt}=m;return {_id,author,text,createdAt};},
};
const fakeCustomer={async exists(){return null;},find(filter){customerQueries++;assert.deepEqual(filter._id.$in,['507f191e810c19729de860ef']);return {select(fields){assert.equal(fields,'name');return this;},async lean(){return [{_id:'507f191e810c19729de860ef',name:'زبون اختباري',passwordHash:'MUST_NOT_LEAK'}];}};}};
Module._load=(name,parent,isMain)=>{
 if(parent?.filename?.replace(/\\/g, '/')?.endsWith('/routes/adminConversations.js')){
  if(name==='express')return {Router:()=>({use(){},get(path,...args){captured.get[path]=args.at(-1);},post(path,...args){captured.post[path]=args.at(-1);},patch(){}})};
  if(name==='express-rate-limit')return ()=>()=>{};
  if(name==='mongoose')return {isValidObjectId:id=>/^[a-f0-9]{24}$/i.test(id)};
  if(name==='../services/conversationService')return fakeService;
  if(name==='../models/Customer')return fakeCustomer;
  if(name==='../models/Audit')return {create(){}};
  if(name==='../models/AgentJob')return {};
  if(name==='../services/agentCredentialService')return {requireStepUp(){}};
 }
 return original.call(this,name,parent,isMain);
};
require('../routes/adminConversations');
async function request(handler,{query={},params={},body={},admin={role:'owner'}}={}){
 const result={};const req={query,params,body,admin,get(){return '';}};
 const res={set(){return this;},json(x){result.body=x;return this;},status(n){result.status=n;return this;},sendStatus(n){result.status=n;return this;}};
 await handler(req,res,e=>{throw e;});return result;
}
(async()=>{
 assert.equal(escapedSearch('a.(x)*'),'a\\.\\(x\\)\\*');
 assert.equal(decodeCursor('not a cursor'),null);
 assert.deepEqual(Object.keys(olderThan(decodeCursor(encodeCursor(conversations[0])),'lastMessageAt')),['$or']);
 const list=await request(captured.get['/'],{query:{v:'2',limit:'2'}});
 assert.equal(list.body.conversations.length,2);assert.equal(list.body.hasMore,true);assert.ok(list.body.nextCursor);
 assert.equal(list.body.conversations[0].displayName,'زبون اختباري');
 assert.equal(list.body.conversations[1].displayName,'زائر خاص');
 assert.equal(JSON.stringify(list.body).includes('MUST_NOT_LEAK'),false);
 assert.equal(customerQueries,1,'batched one query per page');
 const second=await request(captured.get['/'],{query:{v:'2',limit:'2',cursor:list.body.nextCursor}});
 assert.equal(second.body.conversations.length,1);assert.equal(second.body.hasMore,false);
 const unread=await request(captured.get['/'],{query:{v:'2',filter:'unread'}});
 assert.equal(unread.body.conversations.length,1);
 const bad=await request(captured.get['/'],{query:{v:'2',cursor:'invalid'}});
 assert.equal(bad.status,400);
 const detail=await request(captured.get['/:id'],{params:{id:ids[0]},query:{v:'2',limit:'40'}});
 assert.equal(detail.body.messages.length,40);
 assert.equal(detail.body.messages[0].text,'رسالة 53');
 assert.equal(detail.body.messages.at(-1).text,'رسالة 92');
 assert.equal(readWrites,0,'v2 GET must never mutate unread counters');
 const older=await request(captured.get['/:id/messages'],{params:{id:ids[0]},query:{before:detail.body.nextBefore,limit:'40'}});
 assert.equal(older.body.messages.length,40);
 assert.equal(older.body.messages[0].text,'رسالة 13');
 assert.equal(older.body.messages.at(-1).text,'رسالة 52');
 const ack=await request(captured.post['/:id/read'],{params:{id:ids[0]},body:{seenAt:conversations[0].lastMessageAt.toISOString()}});
 assert.equal(ack.body.updated,true);assert.equal(readWrites,1);
 const badRead=await request(captured.post['/:id/read'],{params:{id:ids[0]},body:{seenAt:'not-date'}});
 assert.equal(badRead.status,400);
 Module._load=original;
 console.log('PASS: v2 cursor list, newest-first pages, batched names, explicit read ack, privacy, filters');
})().catch(e=>{console.error(e);process.exitCode=1;});
