require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { ensureCustomerIndexes } = require('./services/indexMigration');

// استيراد المسارات مع التحقق من سلامتها
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');
const aiControlRouter = require('./routes/aiControl');
const agentRouter = require('./routes/agent');
const whatsappRouter = require('./routes/whatsapp');
const conversationsRouter = require('./routes/conversations');
const siteNotificationsRouter=require('./routes/siteNotifications');
const adminNotificationsRouter=require('./routes/adminNotifications');
const publicAnnouncementsRouter=require('./routes/publicAnnouncements');
const adminEngagementRouter=require('./routes/adminEngagement');
const adminConversationsRouter = require('./routes/adminConversations');
const securityRouter = require('./routes/security');
const historicalSalesRouter = require('./routes/historicalSales');
const financeReadRouter = require('./routes/financeRead');
const accountRouter = require('./routes/account');
const { bot } = require('./bot/telegram');
const { initBackupJob } = require('./services/backupService');
const { initRenewalJob } = require('./services/renewalService');
const { createOrderLimiters } = require('./services/limiters');
const { mongoSanitize } = require('./middleware/sanitize');
const crypto = require('crypto');

const { PORT = 3000, MONGODB_URI, CORS_ORIGINS = '' } = process.env;
const missing = ['MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length || process.env.JWT_SECRET.length < 32) {
  console.error('Missing env vars or JWT_SECRET shorter than 32 chars:', missing.join(', '));
  process.exit(1);
}

const TG_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const defaultDomains = [
  'https://rioxstore.shop',
  'https://www.rioxstore.shop',
  'https://abdou254ki.github.io'
];
const allowedOrigins = [
  ...defaultDomains,
  ...CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
];

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('CORS_BLOCKED'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    maxAge: 86400,
  })
);

app.use(
  express.json({
    limit: '50kb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(mongoSanitize);

app.get('/health', (req, res) => res.json({ ok: true }));

if (bot && TG_SECRET) {
  app.post('/telegram/webhook', (req, res) => {
    if (!same(req.get('x-telegram-bot-api-secret-token'), TG_SECRET)) return res.sendStatus(401);
    res.sendStatus(200);
    bot.handleUpdate(req.body).catch((e) => console.error('telegram update failed:', e.message));
  });
}

// تفعيل المسارات بشرط وجودها للتأكد من عدم حدوث الخطأ
if (ordersRouter) {
  // حدّ واسع للقراءة العامة (كتالوج/تقييمات/طرق الدفع) وحدّ مشدد للكتابة (إنشاء الطلبات).
  app.use('/api/orders', ...createOrderLimiters(), ordersRouter);
}

if (adminRouter) app.use('/api/admin', adminRouter);
// Local AI is an optional outbound HTTPS integration; not an independent backend.
app.use('/api/v2/admin/ai', adminRouter.requireAdmin, adminRouter.requireRole(['owner']), aiControlRouter);
app.use('/api/v2/agent', agentRouter);
app.use('/api/v2/whatsapp', whatsappRouter);
app.use('/api/v2/conversations', conversationsRouter);
app.use('/api/v2/site-notifications',siteNotificationsRouter);
app.use('/api/v2/announcements',publicAnnouncementsRouter);
app.use('/api/v2/admin/notifications',adminRouter.requireAdmin,adminRouter.requireRole(['owner']),adminNotificationsRouter);
app.use('/api/v2/admin/engagement',adminRouter.requireAdmin,adminRouter.requireRole(['owner']),adminEngagementRouter);
app.use('/api/v2/admin/conversations', adminRouter.requireAdmin, adminRouter.requireRole(['owner','staff','viewer']), adminConversationsRouter);
app.use('/api/v2/admin/security', adminRouter.requireAdmin, adminRouter.requireRole(['owner']), securityRouter);
app.use('/api/v2/admin/historical-sales', adminRouter.requireAdmin, adminRouter.requireRole(['owner']), historicalSalesRouter);
app.use('/api/v2/admin/finance', adminRouter.requireAdmin, adminRouter.requireRole(['owner']), financeReadRouter);
if (accountRouter) app.use('/api/account', accountRouter);

app.use((req, res) => res.status(404).json({ success: false, message: 'المسار غير موجود.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message === 'CORS_BLOCKED') return res.status(403).json({ success: false, message: 'مصدر الطلب غير مسموح.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'صيغة JSON غير صحيحة.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'حجم الطلب كبير جدًا.' });
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: 'بيانات الطلب غير صالحة.' });
  console.error(err);
  res.status(500).json({ success: false, message: 'حدث خطأ داخلي، حاول لاحقًا أو تواصل مع الدعم.' });
});

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    await ensureCustomerIndexes(); // إصلاح فهارس الزبائن (آمن ولا يمس البيانات)
    const server = app.listen(PORT, () => console.log(`API running on port ${PORT}`));
    if (bot && TG_SECRET && PUBLIC_URL) {
      bot.telegram.getMe().then((info) => { bot.botInfo = info; }).catch((e) => console.error('getMe failed:', e.message));
      bot.telegram
        .setWebhook(`${PUBLIC_URL}/telegram/webhook`, { secret_token: TG_SECRET, allowed_updates: ['message', 'callback_query'] })
        .then(() => console.log('Telegram webhook set'))
        .catch((e) => console.error('setWebhook failed:', e.message));

      initBackupJob(bot);
      if (process.env.RENEWAL_AUTO_REMINDERS === 'true') initRenewalJob(bot);
    }
    const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
