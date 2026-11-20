'use strict';

const express = require('express');
const {
  adminApiLimiter,
  requireAdmin,
  requireRole,
  twoFaLimiter,
  signAdminSessionToken,
  recordAdminAudit,
  migrateOwner
} = require('./middlewares');

const authRouter = require('./auth');
const ordersRouter = require('./orders');
const productsRouter = require('./products');
const stockRouter = require('./stock');
const customersRouter = require('./customers');
const statsRouter = require('./stats');

const router = express.Router();

router.use(adminApiLimiter);

// تركيب المسارات الفرعية
router.use(authRouter);
router.use(ordersRouter);
router.use(productsRouter);
router.use(stockRouter);
router.use(customersRouter);
router.use(statsRouter);

// تصدير دوال الحماية والتوافقية
router.requireAdmin = requireAdmin;
router.requireRole = requireRole;
router.twoFaLimiter = twoFaLimiter;
router.signAdminSessionToken = signAdminSessionToken;
router.recordAdminAudit = recordAdminAudit;
router.migrateOwner = migrateOwner;

module.exports = router;
