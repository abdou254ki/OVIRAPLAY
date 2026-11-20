'use strict';

/**
 * NoSQL Injection Sanitizer & Input Sanitizer
 * Strips keys beginning with $ or containing . from req.body and req.query
 */
function sanitizeObject(target) {
  if (!target || typeof target !== 'object') return target;
  if (Array.isArray(target)) {
    return target.map(sanitizeObject);
  }
  const clean = {};
  for (const key of Object.keys(target)) {
    // Strip keys with $ or . which could be used for MongoDB operators injection
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeObject(target[key]);
  }
  return clean;
}

function mongoSanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

module.exports = {
  sanitizeObject,
  mongoSanitize,
};
