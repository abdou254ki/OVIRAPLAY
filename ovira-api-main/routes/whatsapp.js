const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const chats = require('../services/conversationService');
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

function safeEqual(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
// Official WhatsApp Cloud API webhook ONLY. Never scrape personal WhatsApp sessions.
router.get('/webhook', (req, res) => {
  if (process.env.WHATSAPP_INBOUND_ENABLED !== 'true' || !process.env.WHATSAPP_VERIFY_TOKEN) return res.sendStatus(503);
  const mode = req.query['hub.mode'], token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode !== 'subscribe' || typeof token !== 'string' || !safeEqual(token, process.env.WHATSAPP_VERIFY_TOKEN) || !/^\d{1,32}$/.test(String(challenge || ''))) return res.sendStatus(403);
  return res.type('text/plain').send(String(challenge));
});
router.post('/webhook', async (req, res, next) => {
  try {
    if (process.env.WHATSAPP_INBOUND_ENABLED !== 'true' || !process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_PHONE_NUMBER_ID) return res.sendStatus(503);
    const signature = req.get('x-hub-signature-256');
    if (!/^sha256=[0-9a-f]{64}$/i.test(signature || '') || !Buffer.isBuffer(req.rawBody)) return res.sendStatus(401);
    const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(req.rawBody).digest('hex');
    if (!safeEqual(signature, expected)) return res.sendStatus(401);
    if (req.body?.object !== 'whatsapp_business_account') return res.sendStatus(200);
    for (const entry of (req.body.entry || []).slice(0, 10)) {
      for (const change of (entry.changes || []).slice(0, 10)) {
        if (change.field !== 'messages' || String(change.value?.metadata?.phone_number_id || '') !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
        for (const message of (change.value?.messages || []).slice(0, 30)) {
          const waId = String(message.from || '');
          const messageId = String(message.id || '');
          if (!/^\d{7,20}$/.test(waId) || !/^[A-Za-z0-9._:-]{7,200}$/.test(messageId)) continue;
          const messageText = message.type === 'text' ? String(message.text?.body || '').trim().slice(0, 1200) : '';
          // All incoming messages now enter the unified conversation store exactly once.
          // No WhatsApp outbound transmission is performed by this webhook.
          const conv = await chats.getWhatsAppConversation(waId);
          const incoming = await chats.appendMessage(conv, 'whatsapp', messageText || '[رسالة غير نصية]', {providerMessageId:messageId,delivery:'received'});
          if (incoming.created && messageText) await chats.maybeQueueDraft(conv,incoming.message,'wa:'+waId);
        }
      }
    }
    res.sendStatus(200);
  } catch (e) { next(e); }
});
module.exports = router;
