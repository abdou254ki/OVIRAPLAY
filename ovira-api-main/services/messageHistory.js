'use strict';
// Keep the newest messages, but return them in chronological order for existing clients.
// The tie-breaker makes messages with identical createdAt timestamps deterministic.
async function latestMessages(MessageModel, conversationId, limit) {
  const rows = await MessageModel.find({ conversationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  return rows.reverse();
}
module.exports = { latestMessages };
