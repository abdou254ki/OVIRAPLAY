// Operational security posture. This is NOT a penetration test or vulnerability guarantee.
const express=require('express');
const mongoose=require('mongoose');
const router=express.Router();
router.get('/',async(req,res,next)=>{
 try{
  const origins=(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const checks=[
   {label:'قوة سر JWT',ok:(process.env.JWT_SECRET||'').length>=32,detail:'يجب استخدام قيمة عشوائية قوية بطول لا يقل عن 32 حرفًا.'},
   {label:'النطاقات المسموح لها',ok:origins.length>0&&!origins.includes('*')&&origins.every(x=>/^https:\/\/[^/\s]+$/.test(x)),detail:'CORS_ORIGINS يجب أن يحتوي HTTPS domains محددة، دون *.'},
   {label:'منع تصفير قاعدة الإنتاج',ok:process.env.ALLOW_DESTRUCTIVE_ADMIN_CLEANUP!=='true',detail:'حماية من مسح الطلبات عبر API الإدارة.'},
   {label:'إرسال WhatsApp الآلي',ok:process.env.AI_WHATSAPP_SEND_ENABLED!=='true',detail:'الإرسال الخارجي مغلق حتى تكتمل مراجعة التكلفة والموافقة.'},
   {label:'خادم Qwen منفصل',ok:true,detail:'تُنفذ الطلبات عبر HTTPS صادر من الهاتف؛ لا حاجة لكشف المنفذ 8080.'},
   {label:'حماية Webhook الرسمي',ok:process.env.WHATSAPP_INBOUND_ENABLED!=='true'||!!(process.env.WHATSAPP_APP_SECRET&&process.env.WHATSAPP_VERIFY_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID),detail:'إذا فعّلت الاستقبال، يجب التحقق من توقيع Meta وتحديد Phone ID.'},
   {label:'وضع AI للمراجعة',ok:process.env.AI_AUTO_DECISIONS_ENABLED!=='true',detail:'Qwen يكتب مسودات ولا يعدل الطلبات أو المدفوعات.'}
  ];
  // Only index names / booleans; never return credentials, env values or customer records.
  const indexes=[['conversations','channel_1_providerThreadId_1'],['conversationmessages','providerMessageId_1'],['conversationmessages','conversationId_1_dedupeKey_1'],['agentjobs','dedupeKey_1']];
  for(const [collection,name] of indexes){
   let ok=false;
   try{const exists=await mongoose.connection.db.listCollections({name:collection}).hasNext();
    if(exists)ok=(await mongoose.connection.db.collection(collection).indexes()).some(x=>x.name===name);
   }catch(_){ok=false;}
   checks.push({label:'فهرس منع التكرار '+collection+' / '+name,ok,detail:ok?'موجود في MongoDB':'طبّق الفهارس بعد النسخ الاحتياطي باستخدام scripts/prepare-v2-indexes.js'});
  }
  res.set('Cache-Control','no-store');res.json({success:true,generatedAt:new Date().toISOString(),checks});
 }catch(e){next(e);}
});
module.exports=router;
