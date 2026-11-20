#!/usr/bin/env node
// Offline fail-closed guardrails against common dangerous changes. Not a full vulnerability scanner.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const scan=[path.join(root,'server.js'),path.join(root,'routes','conversations.js'),path.join(root,'routes','adminConversations.js'),path.join(root,'routes','whatsapp.js'),path.join(root,'routes','agent.js')];
let count=0;
function assert(ok,label){if(!ok){console.error('FAIL:',label);count++;}else console.log('PASS:',label);}
for(const file of scan) assert(fs.existsSync(file),path.relative(root,file)+' present');
const srv=fs.readFileSync(scan[0],'utf8');
assert(!/allowedOrigins\.includes\('\*'\)/.test(srv),'no wildcard CORS bypass');
assert(srv.includes("'/api/v2/admin/conversations', adminRouter.requireAdmin"),'admin inbox protected');
assert(srv.includes("'/api/v2/admin/security', adminRouter.requireAdmin"),'security endpoint owner-protected');
const chat=fs.readFileSync(scan[1],'utf8');
assert(chat.includes('timingSafeEqual')&&chat.includes('guestTokenHash'),'guest access token hashed and constant time compared');
assert(chat.includes("tok.role!=='customer'"),'customer token role verified');
const wa=fs.readFileSync(scan[3],'utf8');
assert(wa.includes('timingSafeEqual')&&wa.includes('x-hub-signature-256'),'Webhook HMAC checked');
const agent=fs.readFileSync(scan[4],'utf8');
assert(agent.includes('tokenHash')&&agent.includes('jobs:claim'),'agent bearer hash and scope checks');
const forbidden=/-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) PRIVATE KEY-----|(?:(?:OVIRA_AGENT_TOKEN|MONGODB_URI|WHATSAPP_APP_SECRET|JWT_SECRET)\s*=\s*['\"]?[^'\"\s$][^\s]{25,})/;
for(const d of ['server.js','routes/conversations.js','routes/whatsapp.js']) assert(!forbidden.test(fs.readFileSync(path.join(root,d),'utf8')),'no hardcoded secrets in '+d);
if(count){console.error(count+' security checks failed');process.exit(1);} console.log('Static checks passed. Run dependency audit and staging penetration checks separately.');
