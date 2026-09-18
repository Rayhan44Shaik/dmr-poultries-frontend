// src/modules/auth/signOutGate.ts
// -----------------------------------------------------------------------------
// While a deliberate sign-out is in progress, companion 401s from in-flight
// requests must not trigger another hard navigation / splash cycle.
// -----------------------------------------------------------------------------

let signingOutUntil = 0;

/** Mark the next few seconds as a deliberate sign-out window. */
export function beginSignOut(holdMs = 8_000): void {
  signingOutUntil = Date.now() + holdMs;
}

export function isSigningOut(): boolean {
  return Date.now() < signingOutUntil;
}

export function endSignOut(): void {
  signingOutUntil = 0;
}
