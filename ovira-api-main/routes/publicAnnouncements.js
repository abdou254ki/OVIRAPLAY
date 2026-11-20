const express=require('express');
const rateLimit=require('express-rate-limit');
const SiteAnnouncement=require('../models/SiteAnnouncement');
const router=express.Router();router.use(rateLimit({windowMs:60*1000,limit:100,standardHeaders:'draft-7',legacyHeaders:false}));
router.get('/',async(req,res,next)=>{try{const now=new Date();const rows=await SiteAnnouncement.find({enabled:true,startsAt:{$lte:now},expiresAt:{$gt:now}}).sort({createdAt:-1}).limit(5).select('title body expiresAt createdAt').lean();res.set('Cache-Control','public, max-age=30');res.json({success:true,announcements:rows});}catch(e){next(e)}});
module.exports=router;
