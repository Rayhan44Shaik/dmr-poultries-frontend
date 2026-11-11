// src/modules/auth/idleSessionMeta.ts
// Non-component idle-session metadata re-exported for direct importers.
// Extracted from IdleSessionGuard.tsx so the guard module only exports components
// (react-refresh/only-export-components). Behaviour unchanged: same keys/helpers.

/** sessionStorage flag the LoginPage reads to explain the signed-out state. */
export const IDLE_SIGNOUT_KEY = "dmr:signout-reason";

export { ACTIVITY_KEY as ACTIVITY_BROADCAST_KEY } from "./authEvents";
export { isGenuineActivityEvent } from "./idleActivity";
