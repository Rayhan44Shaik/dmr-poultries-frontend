import assert from 'node:assert/strict';
import test from 'node:test';
import { apiClient } from '../../api/client';
import { getStoredToken, storeToken } from './tokenStore';
import { loginRequest, mfaVerifyRequest } from './authApi';

// MFA login contract (desktop): a password step for an MFA-enabled account
// must return a challenge WITHOUT storing any token — no session exists
// until POST /auth/mfa/verify succeeds and the token is persisted.

type PostStub = (url: string, body?: unknown) => Promise<{ data: unknown }>;

function stubPost(impl: PostStub) {
  const original: unknown = apiClient.post;
  (apiClient as unknown as { post: PostStub }).post = impl;
  return () => {
    (apiClient as unknown as { post: PostStub }).post = original as PostStub;
  };
}

test('MFA challenge stores no token and returns the ticket', async () => {
  storeToken(null);
  const restore = stubPost(async (url) => {
    assert.equal(url, '/auth/login');
    return {
      data: {
        mfaRequired: true,
        mfaTicket: 'ticket-abc-123',
        user: { id: 7, username: 'owner1', displayName: 'Owner', role: 'owner' },
      },
    };
  });
  try {
    const result = await loginRequest('owner1', 'correct-password');
    assert.equal(result.mfaRequired, true);
    if (result.mfaRequired) {
      assert.equal(result.mfaTicket, 'ticket-abc-123');
      assert.equal(result.user.username, 'owner1');
      assert.equal(result.user.role, 'OWNER');
    }
    assert.equal(getStoredToken(), null, 'challenge must not create a session');
  } finally {
    restore();
    storeToken(null);
  }
});

test('MFA verify persists the token and adopts the session', async () => {
  storeToken(null);
  const seen: Array<{ url: string; body: unknown }> = [];
  const restore = stubPost(async (url, body) => {
    seen.push({ url, body });
    return {
      data: {
        user: { id: 7, username: 'owner1', role: 'SUPERVISOR', employeeId: 3 },
        token: 'sess-token-xyz',
        previousSessionsEnded: false,
      },
    };
  });
  try {
    const result = await mfaVerifyRequest('ticket-abc-123', '123456');
    assert.equal(result.user.username, 'owner1');
    assert.equal(result.user.displayName, 'owner1', 'falls back to username');
    assert.equal(result.user.employeeId, 3);
    assert.equal(getStoredToken(), 'sess-token-xyz');
    assert.deepEqual(seen, [{ url: '/auth/mfa/verify', body: { ticket: 'ticket-abc-123', code: '123456' } }]);
  } finally {
    restore();
    storeToken(null);
  }
});

test('non-MFA login still stores the token immediately (regression)', async () => {
  storeToken(null);
  const restore = stubPost(async (url) => {
    assert.equal(url, '/auth/login');
    return {
      data: {
        user: { id: 9, username: 'clerk', role: 'SENIOR_ACCOUNT' },
        token: 'plain-token',
        previousSessionsEnded: true,
      },
    };
  });
  try {
    const result = await loginRequest('clerk', 'pw');
    assert.ok(!result.mfaRequired);
    if (!result.mfaRequired) {
      assert.equal(result.previousSessionsEnded, true);
      assert.equal(result.user.role, 'SENIOR_ACCOUNT');
    }
    assert.equal(getStoredToken(), 'plain-token');
  } finally {
    restore();
    storeToken(null);
  }
});

test('concurrent logins for the same user share one request, MFA included', async () => {
  storeToken(null);
  let calls = 0;
  const restore = stubPost(async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { data: { mfaRequired: true, mfaTicket: 't', user: { username: 'u' } } };
  });
  try {
    const [a, b] = await Promise.all([loginRequest('u', 'p'), loginRequest('u', 'p')]);
    assert.equal(calls, 1);
    assert.ok(a.mfaRequired && b.mfaRequired);
    assert.equal(getStoredToken(), null);
  } finally {
    restore();
    storeToken(null);
  }
});
