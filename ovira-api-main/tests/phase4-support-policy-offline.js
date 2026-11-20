'use strict';
// Offline policy checks for owner's training freedom, customer privacy boundaries,
// grounded live price formatting, and non-disclosure in auto site replies.
const assert=require('node:assert/strict');
const Module=require('module');
const orig=Module._load;
Module._load=function(req,parent,isMain){
 if(parent?.filename?.endsWith('/services/agentPolicyService.js') && req==='../models/AgentUsage')return {};
 return orig.call(this,req,parent,isMain);
};
const policy=require('../services/agentPolicyService');Module._load=orig;
const catalog=require('../services/catalogAiContext');
assert.equal(policy.safeForAI('مرحبًا، ممكن تفهمني كيف يعمل الموقع؟'),true);
assert.equal(policy.safeForAI('ما هو معنى الحوسبة السحابية؟'),true,'no arbitrary shop keyword limit on general questions');
assert.equal(policy.safeForAI('كم بقي من الرصيد في حسابي؟'),false,'no private account data to the local model');
assert.equal(policy.safeForAI('أريد تغيير إيميلي الآن'),false,'account write requests stay server-side');
assert.equal(policy.safeForAI('رمز التحقق: 123456'),false,'actual OTP must not leave server');
assert.equal(policy.eligibleSiteReply('كيف أشتري؟','يمكنك الدخول إلى قسم المتجر لاختيار باقة.'),true);
assert.equal(policy.eligibleSiteReply('كيف أشتري؟','password=actual_password_secret'),false);
assert.equal(policy.eligibleSiteReply('كيف أشتري؟','تم تأكيد دفعك وتغيير كلمة السر.'),false);
assert.equal(policy.eligibleSiteReply('كم سعر الاشتراك؟','اشتراكك 1299 دج.'),false,'model-invented price is not automatically delivered');
const verified=catalog.renderCatalog([{title:'منتج اختباري',active:true,plans:[{months:1,price:1000}]}],'كم سعر منتج اختباري؟');
assert.ok(verified.includes('1000 دج'),'live catalog formats server-backed public prices only');
assert.ok(!verified.includes('password'),'no secrets in catalog context');
console.log('PASS: general Qwen prompts, PII boundaries, sensitive-action rejection, safe auto text, grounded catalog prices');
