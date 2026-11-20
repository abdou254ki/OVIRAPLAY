'use strict';

const assert = require('assert');
const { encrypt, decrypt } = require('../services/cryptoService');
const { sanitizeObject } = require('../middleware/sanitize');
const { requireRole } = require('../routes/admin/middlewares');

async function runSecurityTests() {
  console.log('Running security & role authorization tests...');

  // 1. Test Crypto Service (AES-256-GCM)
  const secretPassword = 'MySuperSecretP@ssword!123';
  const encrypted = encrypt(secretPassword);
  assert.notStrictEqual(encrypted, secretPassword, 'Encrypted string must not match original');
  assert(encrypted.includes(':'), 'Encrypted string must contain IV and AuthTag segments');

  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, secretPassword, 'Decrypted text must match original');

  // Test edge cases
  assert.strictEqual(decrypt(''), '', 'Empty string should return empty');
  assert.strictEqual(decrypt(null), null, 'Null should return null');
  assert.strictEqual(decrypt('invalid:format'), 'invalid:format', 'Invalid format should return as-is');

  // 2. Test MongoSanitize (NoSQL Injection Prevention)
  const maliciousPayload = {
    username: 'admin',
    password: { $gt: '' },
    'profile.role': 'owner',
    normalField: 'hello',
    nested: {
      $where: 'sleep(5000)',
      safe: 'world'
    }
  };

  const sanitized = sanitizeObject(maliciousPayload);
  assert.strictEqual(sanitized.username, 'admin');
  assert.strictEqual(sanitized.normalField, 'hello');
  assert.strictEqual(sanitized['profile.role'], undefined, 'Keys with dot must be stripped');
  assert.strictEqual(sanitized.password.$gt, undefined, 'Keys with $ must be stripped');
  assert.strictEqual(sanitized.nested.$where, undefined, 'Nested keys with $ must be stripped');
  assert.strictEqual(sanitized.nested.safe, 'world');

  // 3. Test RBAC Middleware (requireRole)
  let allowed = false;
  const mockReqOwner = { admin: { role: 'owner', telegramId: 1 } };
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  const mockNext = () => { allowed = true; };

  // Owner allowed on owner-only route
  const ownerOnly = requireRole(['owner']);
  ownerOnly(mockReqOwner, mockRes, mockNext);
  assert.strictEqual(allowed, true, 'Owner must be allowed on owner-only route');

  // Viewer blocked on owner-only route
  allowed = false;
  let blockedCode = 0;
  const mockReqViewer = { admin: { role: 'viewer', telegramId: 2 } };
  const mockResBlocked = {
    status(code) {
      blockedCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  ownerOnly(mockReqViewer, mockResBlocked, mockNext);
  assert.strictEqual(allowed, false, 'Viewer must NOT be allowed on owner-only route');
  assert.strictEqual(blockedCode, 403, 'Must return 403 Forbidden');

  // Staff blocked on owner-only route
  allowed = false;
  const mockReqStaff = { admin: { role: 'staff', telegramId: 3 } };
  ownerOnly(mockReqStaff, mockResBlocked, mockNext);
  assert.strictEqual(allowed, false, 'Staff must NOT be allowed on owner-only route');

  // Staff and Owner allowed on staff route
  allowed = false;
  const staffRoute = requireRole(['owner', 'staff']);
  staffRoute(mockReqStaff, mockRes, mockNext);
  assert.strictEqual(allowed, true, 'Staff must be allowed on staff-enabled route');

  console.log('PASS: security-roles test suite passed 100%');
}

runSecurityTests().catch((err) => {
  console.error('FAIL: security-roles test failed:', err);
  process.exit(1);
});
