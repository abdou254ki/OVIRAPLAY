# OVIRA PLAY API incremental update (7 November 2026)

Same Express/Render + Mongoose/MongoDB Atlas architecture. Existing `/api/orders`, `/api/admin`, `/api/account` remain mounted. New versioned routes `/api/v2/admin/ai`, `/api/v2/agent`, `/api/v2/admin/historical-sales`, `/api/v2/admin/finance` are additive.

Security changes: Google unverified legacy email must not auto-claim customer/order; staff-created phone starts unverified; viewer order list masks delivered secrets; dashboard reports timestamps; customer order stats use customerId; old destructive cleanup endpoint disabled unless explicitly allowed.

Default flags: AI_CREDENTIALS_ENABLED=false, HISTORICAL_SALES_ENABLED=false, AI execution disabled by code. See `.env.example`, `scripts/prepare-v2-indexes.js`, and `../docs/` in the combined package before deploying.

Offline-only tests that can run without Mongo or installed packages: `node tests/ai-security-mocked.js`, `node scripts/prepare-v2-indexes.js --dry-run`.

Production read/write integration test and Chargily webhook regression tests were **not** run. No live Mongo migration or deployment performed.
