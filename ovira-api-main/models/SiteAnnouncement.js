const mongoose=require('mongoose');
const schema=new mongoose.Schema({title:{type:String,required:true,maxlength:100},body:{type:String,required:true,maxlength:600},enabled:{type:Boolean,default:true},startsAt:{type:Date,default:Date.now},expiresAt:{type:Date,required:true},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',required:true}},{timestamps:true,autoIndex:false});
schema.index({enabled:1,startsAt:-1,expiresAt:1});module.exports=mongoose.model('SiteAnnouncement',schema);
