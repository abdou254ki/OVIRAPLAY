'use strict';
const {boundedLimit,encodeCursor,decodeCursor,olderThan}=require('./inboxPaging');
async function pageMessages(Message, conversationId, {before,limit=40}={}) {
  const size=boundedLimit(limit,40);
  let query={conversationId};
  if(before){
    const cursor=decodeCursor(before);
    if(!cursor){const e=new Error('INVALID_CURSOR');e.publicCode='INVALID_CURSOR';e.status=400;throw e;}
    query={$and:[query,olderThan(cursor,'createdAt')]};
  }
  const desc=await Message.find(query).sort({createdAt:-1,_id:-1}).limit(size+1).lean();
  const hasMore=desc.length>size;
  const rows=desc.slice(0,size).reverse();
  const nextBefore=hasMore && rows.length?encodeCursor(rows[0],'createdAt'):null;
  return {rows,hasMore,nextBefore};
}
module.exports={pageMessages};
