const mongoose=require('mongoose');
const schema=new mongoose.Schema({question:{type:String,required:true,trim:true,maxlength:240},answer:{type:String,required:true,trim:true,maxlength:1400},category:{type:String,enum:['faq','sales','policy','delivery','renewal'],default:'faq'},active:{type:Boolean,default:true},updatedBy:{type:mongoose.Schema.Types.ObjectId,default:null}},{timestamps:true,autoIndex:false});
schema.index({active:1,category:1,updatedAt:-1});
module.exports=mongoose.model('KnowledgeEntry',schema);
