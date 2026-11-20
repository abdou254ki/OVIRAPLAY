const mongoose=require('mongoose');
const schema=new mongoose.Schema({_id:{type:String,default:'email'},provider:{type:String,enum:['disabled','smtp','api'],default:'disabled'},fromName:{type:String,default:'OVIRA PLAY',maxlength:80},fromAddress:{type:String,default:'',maxlength:150},endpoint:{type:String,default:'',maxlength:250},configured:{type:Boolean,default:false},enabled:{type:Boolean,default:false},updatedBy:{type:mongoose.Schema.Types.ObjectId,default:null}},{timestamps:true,autoIndex:false});
module.exports=mongoose.model('IntegrationConfig',schema);
