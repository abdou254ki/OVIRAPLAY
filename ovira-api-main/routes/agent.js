const express = require('express');
const rateLimit = require('express-rate-limit');
const AgentCredential = require('../models/AgentCredential');
const AgentSettings = require('../models/AgentSettings');
const { tokenHash } = require('../services/agentCredentialService');
const jobService = require('../services/agentJobService');
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
router.use(async (req, res, next) => {
  try {
    const h = req.get('Authorization') || '';
    const match = /^Bearer (ovira_agent_[A-Za-z0-9_-]{35,100})$/.exec(h);
    if (!match) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const credential = await AgentCredential.findOne({ tokenHash: tokenHash(match[1]), status: { $in: ['pending','active'] }, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!credential) return res.status(401).json({ success: false, code: 'REVOKED_OR_EXPIRED' });
    const config = await AgentSettings.findById('local-agent-v1').lean();
    if (config?.killSwitch) return res.status(423).json({ success: false, code: 'KILL_SWITCH' });
    req.agentCredential = credential;
    req.agentSettings = config || {};
    next();
  } catch (err) { next(err); }
});
function hasScope(req, scope) { return Array.isArray(req.agentCredential.scopes) && req.agentCredential.scopes.includes(scope); }
function enabled(req) { return process.env.AI_EXECUTION_ENABLED === 'true' && !!req.agentSettings.enabled && !!req.agentSettings.executionEnabled && !req.agentSettings.killSwitch; }
router.post('/heartbeat', async (req, res, next) => {
  try {
    if (!hasScope(req, 'agent:heartbeat')) return res.sendStatus(403);
    const version = typeof req.body?.workerVersion === 'string' ? req.body.workerVersion.slice(0, 40) : '';
    await AgentCredential.updateOne({ _id: req.agentCredential._id, status: { $in: ['pending','active'] } }, { $set: { lastHeartbeatAt: new Date(), status: 'active', workerVersion: version } });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, mode: enabled(req) ? 'assist-drafts' : 'shadow', executionEnabled: enabled(req), nextHeartbeatSeconds: 60 });
  } catch (err) { next(err); }
});
router.post('/jobs/claim', async (req, res, next) => {
  try {
    if (!hasScope(req, 'jobs:claim')) return res.sendStatus(403);
    if (!enabled(req)) return res.status(423).json({ success: false, code: 'AGENT_EXECUTION_DISABLED' });
    const job = await jobService.claim(req.agentCredential);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, job, nextPollSeconds: job ? 1 : 10 });
  } catch (e) { next(e); }
});
router.post('/jobs/:id/result', async (req, res, next) => {
  try {
    if (!hasScope(req, 'jobs:result')) return res.sendStatus(403);
    if (!enabled(req)) return res.status(423).json({ success: false, code: 'AGENT_EXECUTION_DISABLED' });
    const result = await jobService.submitResult(req.agentCredential, req.params.id, req.body);
    res.set('Cache-Control', 'no-store');
    res.status(result.status).json({ success: result.status === 200, code: result.code });
  } catch (e) { next(e); }
});
module.exports = router;
