import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyStatus,
  isAuthFailureCode,
  isRecoverableTransportCode,
  toApiError,
} from './errors';

// Strict error taxonomy: only AUTH_* may ever trigger session eviction.
// Timeouts, 502/503/504, and network errors must NEVER log the user out.

function axiosFailure(parts: Record<string, unknown>) {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed',
    config: { method: 'get', url: '/auth/me' },
    response: undefined,
    ...parts,
  };
}

test('only AUTH_* codes count as session failures', () => {
  assert.equal(isAuthFailureCode('AUTH_INVALID'), true);
  assert.equal(isAuthFailureCode('AUTH_REVOKED'), true);
  assert.equal(isAuthFailureCode('AUTH_EXPIRED'), true);
  for (const code of ['FORBIDDEN', 'TIMEOUT', 'NETWORK_ERROR', 'OFFLINE', 'SERVER_500', 'SERVER_502', 'SERVER_503', 'SERVER_504', 'VALIDATION_ERROR', 'CONFLICT', 'RATE_LIMITED', 'NOT_FOUND', 'UNKNOWN_ERROR', undefined]) {
    assert.equal(isAuthFailureCode(code), false, `${code} must never evict the session`);
  }
});

test('transport failures are recoverable, never logout triggers', () => {
  for (const code of ['NETWORK_ERROR', 'OFFLINE', 'TIMEOUT', 'SERVER_500', 'SERVER_502', 'SERVER_503', 'SERVER_504']) {
    assert.equal(isRecoverableTransportCode(code), true);
  }
  for (const code of ['AUTH_INVALID', 'FORBIDDEN', 'VALIDATION_ERROR', undefined]) {
    assert.equal(isRecoverableTransportCode(code), false);
  }
});

test('status codes map to the strict taxonomy', () => {
  assert.equal(classifyStatus(401, {}), 'AUTH_INVALID');
  assert.equal(classifyStatus(401, { code: 'AUTH_EXPIRED' }), 'AUTH_EXPIRED');
  assert.equal(classifyStatus(401, { code: 'AUTH_REVOKED' }), 'AUTH_REVOKED');
  assert.equal(classifyStatus(403, {}), 'FORBIDDEN');
  assert.equal(classifyStatus(404, {}), 'NOT_FOUND');
  assert.equal(classifyStatus(409, {}), 'CONFLICT');
  assert.equal(classifyStatus(400, {}), 'VALIDATION_ERROR');
  assert.equal(classifyStatus(422, {}), 'VALIDATION_ERROR');
  assert.equal(classifyStatus(429, {}), 'RATE_LIMITED');
  assert.equal(classifyStatus(500, {}), 'SERVER_500');
  assert.equal(classifyStatus(502, {}), 'SERVER_502');
  assert.equal(classifyStatus(503, {}), 'SERVER_503');
  assert.equal(classifyStatus(504, {}), 'SERVER_504');
});

test('a timeout never looks like an auth failure', () => {
  const err = toApiError(axiosFailure({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' }));
  assert.equal(err.code, 'TIMEOUT');
  assert.equal(isAuthFailureCode(err.code), false);
});

test('a 503 never looks like an auth failure', () => {
  const err = toApiError(
    axiosFailure({ response: { status: 503, data: { message: 'Service unavailable' } } })
  );
  assert.equal(err.code, 'SERVER_503');
  assert.equal(isAuthFailureCode(err.code), false);
});

test('a network failure never looks like an auth failure', () => {
  const err = toApiError(axiosFailure({ message: 'Connection refused' }));
  assert.equal(err.code, 'NETWORK_ERROR');
  assert.equal(isAuthFailureCode(err.code), false);
});

test('a 401 carries AUTH_INVALID with the server message', () => {
  const err = toApiError(
    axiosFailure({ response: { status: 401, data: { message: 'Authentication required' } } })
  );
  assert.equal(err.code, 'AUTH_INVALID');
  assert.equal(isAuthFailureCode(err.code), true);
});

test('a 403 is authorization, not a dead session', () => {
  const err = toApiError(
    axiosFailure({ response: { status: 403, data: { message: 'Forbidden' } } })
  );
  assert.equal(err.code, 'FORBIDDEN');
  assert.equal(isAuthFailureCode(err.code), false);
});

test('409/422/429 map to conflict/validation/rate-limit, never auth', () => {
  for (const [status, code] of [[409, 'CONFLICT'], [422, 'VALIDATION_ERROR'], [400, 'VALIDATION_ERROR'], [429, 'RATE_LIMITED'], [500, 'SERVER_500']] as Array<[number, string]>) {
    const err = toApiError(axiosFailure({ response: { status, data: { message: 'x' } } }));
    assert.equal(err.code, code, `status ${status}`);
    assert.equal(isAuthFailureCode(err.code), false);
  }
});

test('malformed and unknown failures fall back safely, never evict', () => {
  assert.equal(toApiError(axiosFailure({ response: { status: 418, data: null } })).code, 'UNKNOWN_ERROR');
  assert.equal(toApiError(new Error('boom')).code, 'UNKNOWN_ERROR');
  assert.equal(toApiError('string failure').code, 'UNKNOWN_ERROR');
  assert.equal(toApiError(undefined).code, 'UNKNOWN_ERROR');
  for (const err of [toApiError(new Error('boom')), toApiError('x'), toApiError(undefined)]) {
    assert.equal(isAuthFailureCode(err.code), false);
  }
});

test('backend correlation ID is captured for diagnostics', () => {
  const err = toApiError(
    axiosFailure({
      response: {
        status: 500,
        data: { message: 'Server error' },
        headers: { 'x-request-id': '9f2c4a1e-3b7d-4e5f-8a9b-0c1d2e3f4a5b' },
      },
    })
  );
  assert.equal(err.code, 'SERVER_500');
  assert.equal(err.requestId, '9f2c4a1e-3b7d-4e5f-8a9b-0c1d2e3f4a5b');
  assert.equal(isAuthFailureCode(err.code), false);
});

test('server-sent AUTH_EXPIRED code is preserved through the classifier', () => {
  const err = toApiError(
    axiosFailure({ response: { status: 401, data: { code: 'AUTH_EXPIRED', message: 'idle' } } })
  );
  assert.equal(err.code, 'AUTH_EXPIRED');
  assert.equal(isAuthFailureCode(err.code), true);
});
