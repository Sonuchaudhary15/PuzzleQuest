/**
 * auth.test.js - Unit Tests for Virtual Identity, Bcrypt Hashing & JWT Security
 * 
 * Tests:
 * 1. Password hashing non-reversibility with bcrypt
 * 2. Password verification success & failure
 * 3. JWT token creation, signature verification, and payload decoding
 * 4. Rejection of altered/tampered JWT tokens
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Virtual Identity & Authentication Security', () => {
  const secretKey = 'test_secret_key_puzzlequest_123';
  const plainPassword = 'ArcanePassword99!';

  test('Hashes passwords securely with bcrypt salt', async () => {
    const hash = await bcrypt.hash(plainPassword, 10);
    assert.notStrictEqual(hash, plainPassword, 'Hashed password must not equal plain text');
    assert.strictEqual(hash.startsWith('$2'), true, 'Must use bcrypt algorithm identifier');

    // Verify correct password
    const isMatch = await bcrypt.compare(plainPassword, hash);
    assert.strictEqual(isMatch, true, 'Original password must match generated hash');

    // Reject wrong password
    const isWrongMatch = await bcrypt.compare('WrongPassword!', hash);
    assert.strictEqual(isWrongMatch, false, 'Incorrect password must be rejected');
  });

  test('Generates and verifies valid JWT access tokens', () => {
    const payload = { userId: 'user_12345', username: 'CrystalMage' };
    const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });

    assert.ok(typeof token === 'string');
    assert.strictEqual(token.split('.').length, 3, 'JWT must contain header, payload, and signature');

    const decoded = jwt.verify(token, secretKey);
    assert.strictEqual(decoded.userId, 'user_12345');
    assert.strictEqual(decoded.username, 'CrystalMage');
  });

  test('Rejects tampered or invalid JWT signatures', () => {
    const payload = { userId: 'user_12345', username: 'CrystalMage' };
    const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });

    // Tamper with token payload section
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}abc.${parts[2]}`;

    assert.throws(() => {
      jwt.verify(tamperedToken, secretKey);
    }, 'Tampered token must throw error');

    // Verify with incorrect secret
    assert.throws(() => {
      jwt.verify(token, 'wrong_secret_key');
    }, /invalid signature/, 'Wrong secret key must reject signature');
  });
});
