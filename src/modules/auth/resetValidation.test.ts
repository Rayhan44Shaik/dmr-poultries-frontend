import assert from 'node:assert/strict';
import test from 'node:test';
import { validateResetComplete, validateResetRequest } from './resetValidation';

test('reset request needs a plausible username', () => {
  assert.deepEqual(validateResetRequest('  owner1 '), { ok: true, username: 'owner1' });
  assert.equal(validateResetRequest('').ok, false);
  assert.equal(validateResetRequest('   ').ok, false);
  assert.equal(validateResetRequest('x'.repeat(101)).ok, false);
});

test('reset completion enforces token + 12-char matching passwords', () => {
  assert.equal(validateResetComplete('', 'long-enough-password', 'long-enough-password').ok, false);
  assert.equal(validateResetComplete('tok', 'short', 'short').ok, false);
  assert.equal(validateResetComplete('tok', 'long-enough-password', 'different').ok, false);
  const good = validateResetComplete('  tok  ', 'long-enough-password-123', 'long-enough-password-123');
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.token, 'tok');
    assert.equal(good.newPassword, 'long-enough-password-123');
  }
});
