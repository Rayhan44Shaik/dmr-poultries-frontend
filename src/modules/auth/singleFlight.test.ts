import assert from 'node:assert/strict';
import test from 'node:test';
import { singleFlight } from './authApi';

// The deduplication primitive behind loginRequest (per-username), the shared
// /auth/me probe, and logoutRequest: concurrent callers share one promise.

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('concurrent callers share one in-flight request', async () => {
  const slots = new Map<string, Promise<string>>();
  let starts = 0;
  const gate = deferred<string>();
  const starter = () => {
    starts++;
    return gate.promise;
  };
  const a = singleFlight(slots, 'k', starter);
  const b = singleFlight(slots, 'k', starter);
  const c = singleFlight(slots, 'other', starter);
  assert.equal(starts, 2, 'one start per key, not per caller');
  gate.resolve('ok');
  assert.deepEqual(await Promise.all([a, b, c]), ['ok', 'ok', 'ok']);
});

test('slot clears after success so legitimate retries are never blocked', async () => {
  const slots = new Map<string, Promise<number>>();
  let starts = 0;
  const first = await singleFlight(slots, 'k', async () => {
    starts++;
    return 1;
  });
  assert.equal(first, 1);
  const second = await singleFlight(slots, 'k', async () => {
    starts++;
    return 2;
  });
  assert.equal(second, 2);
  assert.equal(starts, 2);
  assert.equal(slots.size, 0);
});

test('slot clears after failure and every waiter sees the same error', async () => {
  const slots = new Map<string, Promise<string>>();
  let starts = 0;
  const gate = deferred<string>();
  const a = singleFlight(slots, 'k', () => {
    starts++;
    return gate.promise;
  });
  const b = singleFlight(slots, 'k', () => {
    starts++;
    return gate.promise;
  });
  gate.reject(new Error('nope'));
  await assert.rejects(a, /nope/);
  await assert.rejects(b, /nope/);
  assert.equal(starts, 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(slots.size, 0, 'rejected slot is released for the next attempt');
  const retry = await singleFlight(slots, 'k', async () => {
    starts++;
    return 'recovered';
  });
  assert.equal(retry, 'recovered');
  assert.equal(starts, 2);
});

test('rapid repeated logins collapse but a later login starts fresh', async () => {
  const slots = new Map<string, Promise<string>>();
  let starts = 0;
  const slow = (id: number) => async () => {
    starts++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return `session-${id}`;
  };
  // Simulate double-click + Enter-repeat: 5 concurrent attempts, one request.
  const burst = await Promise.all([0, 1, 2, 3, 4].map(() => singleFlight(slots, 'user', slow(starts))));
  assert.equal(starts, 1);
  assert.ok(burst.every((value) => value === burst[0]));
  // After settle, a genuinely new attempt proceeds.
  const next = await singleFlight(slots, 'user', slow(99));
  assert.equal(next, 'session-99');
  assert.equal(starts, 2);
});
