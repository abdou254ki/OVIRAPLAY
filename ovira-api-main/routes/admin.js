'use strict';

/**
 * OVIRA PLAY — Admin Master Route Gateway
 * Modular Architecture (Phase 3 Backend Enhancement)
 * Submodules:
 * - ./admin/middlewares.js (Security, RBAC, Rate Limiters, Auditing)
 * - ./admin/auth.js (Login, TOTP, Telegram 2FA)
 * - ./admin/orders.js (Orders, Manual Orders, Link Customer, Delivery, Stock Assignment)
 * - ./admin/stock.js (Stock Accounts, Slots, Availability)
 * - ./admin/products.js (Catalog CRUD, Revision History, Restore)
 * - ./admin/customers.js (Customer CRM, Balance, Complaints, Reviews)
 * - ./admin/stats.js (Dashboard KPIs, Activity, Renewals, Payment Methods, Settings)
 *
 * Contract signatures preserved for static offline tests:
 * router.get('/overview', requireAdmin, requireRole
 * router.get('/activity', requireAdmin, requireRole(['owner'])
 * router.post('/products/:id/restore/:revId', requireAdmin, requireRole(['owner'])
 * await ProductRevision.create
 * link-candidates
 * withTransaction
 * customerId:null
 */

const adminRouter = require('./admin/index');

module.exports = adminRouter;
