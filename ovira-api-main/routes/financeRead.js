const express = require('express');
const Order = require('../models/Order');
const router=express.Router();
router.get('/summary',async(req,res,next)=>{
  try {
    // This is deliberately not a profit calculation. The legacy Order/Stock models
    // have no verified COGS matching, full settlements, expenses or refund journal.
    const end=new Date();
    const begin=new Date(end.getTime()-30*86400000);
    const rows=await Order.aggregate([
      {$match:{isPaidOnline:true,paidAt:{$gte:begin,$lte:end}}},
      {$group:{_id:null,orderCount:{$sum:1},recordedOrderTotalDzd:{$sum:'$totalPrice'}}}
    ]);
    res.set('Cache-Control','no-store');
    res.json({success:true,generatedAt:new Date().toISOString(),period:{start:begin.toISOString(),end:end.toISOString()},currency:'DZD',
      verifiedOnlineOrderCount:rows[0]?.orderCount||0,
      verifiedOnlineOrderAmount:rows[0]?.recordedOrderTotalDzd||0,
      netProfit:null,receivables:null,operatingExpenses:null,ledgerReady:false,
      dataQuality:'partial_order_payment_flags_only',
      explanation:'المبلغ مجموع قيمة الطلبات المعلمة بالدفع الإلكتروني؛ لا يمثل التدفق النقدي أو الإيراد المعترف به أو صافي الربح. يلزم دفتر مالي متوازن وتكاليف ومصاريف وتسويات.'});
  }catch(err){next(err)}
});
module.exports=router;
