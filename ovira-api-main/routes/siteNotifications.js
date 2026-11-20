const express=require('express');
const rateLimit=require('express-rate-limit');
const jwt=require('jsonwebtoken');
const Customer=require('../models/Customer');
const SiteNotification=require('../models/SiteNotification');
const router=express.Router();
router.use(rateLimit({windowMs:60*1000,limit:60,standardHeaders:'draft-7',legacyHeaders:false}));
router.use(async(req,res,next)=>{try{
 const m=/^Bearer (\S+)$/.exec(req.get('authorization')||'');if(!m)return res.sendStatus(401);
 const tok=jwt.verify(m[1],process.env.JWT_SECRET,{algorithms:['HS256']});if(tok.role!=='customer')return res.sendStatus(403);
 const customer=await Customer.findById(tok.id);if(!customer||customer.blocked||(customer.tokenVersion||0)!==(tok.tv||0))return res.sendStatus(401);
 req.customer=customer;next();
}catch(_){res.status(401).json({success:false,code:'INVALID_SESSION'});}});
router.get('/',async(req,res,next)=>{try{
 const rows=await SiteNotification.find({customerId:req.customer._id}).sort({createdAt:-1}).limit(50).lean();
 const unread=await SiteNotification.countDocuments({customerId:req.customer._id,readAt:null});
 res.set('Cache-Control','no-store');res.json({success:true,notifications:rows,unread,marketingOptIn:!!req.customer.marketingOptIn});
}catch(e){next(e)}});
router.patch('/preferences',async(req,res,next)=>{try{
 if(typeof req.body?.marketingOptIn!=='boolean')return res.sendStatus(400);
 await Customer.updateOne({_id:req.customer._id},{$set:{marketingOptIn:req.body.marketingOptIn}});
 res.json({success:true,marketingOptIn:req.body.marketingOptIn});
}catch(e){next(e)}});
router.post('/:id/read',async(req,res,next)=>{try{
 if(!/^[a-f0-9]{24}$/i.test(req.params.id))return res.sendStatus(400);
 const row=await SiteNotification.findOneAndUpdate({_id:req.params.id,customerId:req.customer._id},{$set:{readAt:new Date()}},{new:true});
 if(!row)return res.sendStatus(404);res.json({success:true});
}catch(e){next(e)}});
module.exports=router;
