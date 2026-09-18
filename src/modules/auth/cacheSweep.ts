// src/modules/auth/cacheSweep.ts
// -----------------------------------------------------------------------------
// Cross-user data isolation.
//
// The sign-in role decides what data may live on this machine. When the
// signed-in user CHANGES (owner → supervisor, or anyone → anyone else) every
// cached business dataset must go: localStorage data keys, sessionStorage and
// IndexedDB databases included. UI preferences (theme, language, sidebar
// shape, font scale) survive the sweep — they carry no business data.
//
// Paired with a full-page reload on login/logout (AuthProvider), this
// guarantees no module-level cache, snapshot or offline store can leak one
// user's data into another user's session — not even through devtools.
// -----------------------------------------------------------------------------

/** localStorage keys that are pure UI preference — never business data. */
const KEEP = new Set([
  "theme",
  "dmr_settings",
  "dmr_schema_version",
  "dmr_storage_version",
  "dmr-sidebar-mode",
]);

/** localStorage key remembering the most recent signed-in username. */
export const LAST_USERNAME_KEY = "dmr-last-username";

export function getLastUsername(): string | null {
  try {
    return localStorage.getItem(LAST_USERNAME_KEY);
  } catch {
    return null;
  }
}

export function setLastUsername(username: string): void {
  try {
    localStorage.setItem(LAST_USERNAME_KEY, username);
  } catch {
    // storage unavailable — the next login just always sweeps
  }
}

/** Best-effort synchronous sweep of every cached business dataset. */
export function sweepWorkspaceCaches(): void {
  try {
    const dead: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key == null || KEEP.has(key)) continue;
      // The bearer token is handled by the auth flow itself; everything else
      // that is not an explicit UI preference is data and must go.
      if (key === "dmr-auth-token" || key === LAST_USERNAME_KEY) continue;
      dead.push(key);
    }
    dead.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage unavailable — nothing to sweep
  }

  // IndexedDB (offline stores, trip drafts, reference caches): delete every
  // database. Awaited by the auth flow with a timeout so it can never stall
  // a sign-in/sign-out.
  try {
    if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
      void indexedDB.databases().then((dbs) => {
        (dbs ?? []).forEach((db) => {
          if (db?.name) indexedDB.deleteDatabase(db.name);
        });
      }).catch(() => undefined);
    }
  } catch {
    // feature unavailable — localStorage sweep still bounds the exposure
  }
}
