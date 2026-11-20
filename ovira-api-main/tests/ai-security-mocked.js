// Dependency-free contract tests: stubs DB boundary; never connects to production.
const assert = require('node:assert/strict');
const Module = require('module');
const crypto = require('crypto');
const origLoad = Module._load;
const stored = [];
let audits = [];
const dbAdmin = {
  _id:'owner1', telegramId:123456, role:'owner',active:true,
  twoFactorEnabled:true,twoFactorMethod:'totp',totpSecret:'TEST_SECRET',passwordHash:'stubhash',
  async save(){ return this; }
};
const query = (getter) => ({
  sort(){return this;}, select(){return this;},
  async lean(){return getter();},
  then(resolve,reject){return Promise.resolve(getter()).then(resolve,reject);}
});
const fakeCredential = {
  findOne(filter){return query(()=>stored.find(x=>filter.status?.$in?.includes(x.status) && new Date(x.expiresAt)>new Date()) || null);},
  async updateMany(filter,update){let count=0;for(const x of stored){if(filter.status.$in.includes(x.status)){Object.assign(x,update.$set);count++}}return {modifiedCount:count};},
  async updateOne(filter, update){const x=stored.find(x=>x._id===filter._id);if(x)Object.assign(x,update.$set);},
  async create(values){const row={status:'pending',...values,_id:'id'+(stored.length+1),createdAt:new Date()};stored.push(row);return row;}
};
const fakeSettings = {findById(){return query(()=>null)},async findByIdAndUpdate(){return true;}};
const fakes = {
  '../models/Admin':{findById:async()=>dbAdmin},
  '../models/AgentCredential':fakeCredential,
  '../models/AgentSettings':fakeSettings,
  '../models/Audit':{async create(entry){audits.push(entry);}},
  'bcryptjs':{async compare(plain,hash){return plain==='correct-password'&&hash==='stubhash';}},
  '../bot/telegram':{bot:null}
};
const authReal = require('../services/authService');
fakes['./authService']={...authReal,verifyTotpToken(_secret,code){return code==='123456';}};
Module._load=function(request,parent,isMain){if(parent?.filename?.endsWith('agentCredentialService.js')&&fakes[request])return fakes[request];return origLoad.call(this,request,parent,isMain);};
const svc=require('../services/agentCredentialService');
Module._load=origLoad;
(async()=>{
  assert.equal((await svc.getSummary()).status,'unpaired');
  await assert.rejects(svc.requireStepUp('owner1','wrong','123456'),e=>e.httpStatus===401);
  await assert.rejects(svc.requireStepUp('owner1','correct-password','111111'),e=>e.httpStatus===401);
  const owner=await svc.requireStepUp('owner1','correct-password','123456');
  const a=await svc.issueCredential(owner,'OVIRA-PHONE-01');
  assert.match(a.token,/^ovira_agent_[A-Za-z0-9_-]+$/);
  assert.notEqual(stored[0].tokenHash,a.token);
  assert.equal(stored[0].tokenHash,crypto.createHash('sha256').update(a.token).digest('hex'));
  assert.equal((await svc.getSummary()).status,'pending');
  assert.equal('token' in await svc.getSummary(),false);
  const b=await svc.issueCredential(owner,'OVIRA-PHONE-02');
  assert.notEqual(a.token,b.token);
  assert.equal(stored[0].status,'revoked');
  assert.equal(stored[1].status,'pending');
  await svc.revokeCredential(owner);
  assert.equal(stored[1].status,'revoked');
  assert.equal((await svc.getSummary()).status,'unpaired');
  assert.equal(audits.length,3);
  await assert.rejects(svc.issueCredential(owner,'../../secrets'),e=>e.code==='BAD_NAME');
  console.log('PASS: owner 2FA step-up, token hashing, one-time response, rotation, revocation, audit, unsafe device name');
})().catch(e=>{console.error(e);process.exit(1)});
