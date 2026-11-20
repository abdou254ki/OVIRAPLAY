const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function renderKnowledge(rows,question,maxChars=1450){
 const words=norm(question).split(' ').filter(w=>w.length>=3);
 const scored=(rows||[]).filter(x=>x.active!==false).map(x=>({x,score:words.filter(w=>norm(x.question).includes(w)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
 let out='';for(const {x} of scored){const line=`السؤال المعتمد: ${String(x.question).slice(0,240)}\nالإجابة المعتمدة: ${String(x.answer).slice(0,1400)}\n`;if(out.length+line.length>maxChars)break;out+=line;}
 return out?`معرفة رسمية يحررها مالك المتجر، لا تتجاوزها ولا تخترع ما لم يرد فيها:\n${out}`:'';
}
async function knowledgeContext(question){const KnowledgeEntry=require('../models/KnowledgeEntry');const docs=await KnowledgeEntry.find({active:true}).select('question answer category active -_id').limit(100).lean();return renderKnowledge(docs,question);}
module.exports={renderKnowledge,knowledgeContext};
