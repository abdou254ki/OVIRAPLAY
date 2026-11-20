const mongoose=require('mongoose');
const schema=new mongoose.Schema({customerId:{type:mongoose.Schema.Types.ObjectId,ref:'Customer',required:true},kind:{type:String,enum:['order','renewal','support','offer','general'],required:true},title:{type:String,required:true,maxlength:100},body:{type:String,required:true,maxlength:600},link:{type:String,default:'#/account',maxlength:120},dedupeKey:{type:String,default:undefined},readAt:{type:Date,default:null},createdBy:{type:mongoose.Schema.Types.ObjectId,default:null}},{timestamps:true,autoIndex:false});
schema.index({customerId:1,createdAt:-1});schema.index({customerId:1,dedupeKey:1},{unique:true,partialFilterExpression:{dedupeKey:{$type:'string'}}});
module.exports=mongoose.model('SiteNotification',schema);
