import React from "react";

// -----------------------------------------------------------------------------
// RETRYING LAZY IMPORTS
// -----------------------------------------------------------------------------
// React.lazy fails permanently if a dynamic import() fails ONCE. In hosted
// previews that happens for transient, non-code reasons: the dev tunnel hiccups
// while the sandbox dev server restarts, the browser raced an optimizeDeps
// re-bundle, or an already-open tab holds chunk URLs from the previous server
// instance ("Failed to fetch dynamically imported module …").
//
// This wrapper:
//   1. retries the import a few times with a short back-off — most blips heal
//      with no user action at all;
//   2. recognises stale-chunk errors and performs a GUARDED single reload to
//      pick up the fresh module graph (shared guard with main.tsx);
//   3. only then rethrows so the ErrorBoundary can show a recovery screen.
// -----------------------------------------------------------------------------

export const RELOAD_KEY = "dmr:preload-reload-at";

export function isChunkLoadError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String((error as { message?: unknown })?.message ?? error);
  const text = message.toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("error loading dynamically imported module") ||
    text.includes("importing a module script failed") ||
    // Vite surfaces an expired dep optimizer hash as a re-load error.
    text.includes("outdated optimize dep") ||
    /^loading chunk [a-z0-9-]+ failed/i.test(text) ||
    text.includes("dynamically imported module")
  );
}

export function guardedReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    // One recovery reload per 15 s window — never a reload loop.
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage unavailable — allow the reload */
  }
  window.location.reload();
  return true;
}

function retryable<T>(
  loader: () => Promise<T>,
  attemptsLeft: number,
  delayMs: number
): () => Promise<T> {
  return () =>
    loader().catch((error: unknown) => {
      // Network-style failure of a page chunk: back off and retry.
      if (attemptsLeft > 0) {
        return new Promise((resolve) => window.setTimeout(resolve, delayMs)).then(() =>
          retryable(loader, attemptsLeft - 1, Math.min(delayMs * 1.8, 2500))()
        );
      }
      // Out of retries. A stale-chunk/deploy error is fixed by one guarded
      // reload; anything else is a genuine module error and must surface.
      if (isChunkLoadError(error) && guardedReload()) {
        // The reload is navigating away; keep the promise pending meanwhile.
        return new Promise<T>(() => {});
      }
      throw error;
    });
}

/**
 * Wrap ANY dynamic-import factory with retries + guarded stale-chunk reload.
 * Works directly inside React.lazy (the module namespace already carries
 * `default`).
 */
export function retryableImport<M>(loader: () => Promise<M>, attempts = 3): () => Promise<M> {
  return retryable(loader, attempts, 500);
}

/**
 * React.lazy equivalent whose dynamic import survives transient dev-server /
 * tunnel restarts and auto-recovers from stale chunk URLs.
 */
export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  loader: () => Promise<{ default: T } | T>,
  attempts = 3
): React.LazyExoticComponent<T> {
  const factory = retryable(async () => {
    const mod = await loader();
    // Normalise both `{ default: C }` (lazyShell) and module namespaces.
    const component = (mod as { default?: T }).default ?? (mod as T);
    return { default: component };
  }, attempts, 500);
  return React.lazy(factory);
}
