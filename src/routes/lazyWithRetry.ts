import React from "react";

// -----------------------------------------------------------------------------
// RETRYING LAZY IMPORTS + CONNECTION-AWARE RECOVERY
// -----------------------------------------------------------------------------
// React.lazy fails permanently after one failed dynamic import. In hosted
// previews a chunk fetch can fail for very different reasons, and each needs a
// different recovery:
//
//   • Cold dev server / tunnel hiccup / Vite re-bundling  -> wait + retry
//   • Open tab pointing at an old preview host (restart)  -> reload when back
//   • Module responds 404/500 (genuine build problem)     -> surface details
//
// Flow: retry the import a few times; then PROBE the failing module URL over
// the network. While the probe cannot even connect we keep waiting (Suspense
// loading stays on screen); when it responds 200 we do one guarded reload; a
// 4xx/5xx is a real build error and is reported instead of looping.
// -----------------------------------------------------------------------------

export const RELOAD_KEY = "dmr:preload-reload-at";
/** The entry module is eager and tiny — the ideal liveness probe. */
const ENTRY_PROBE = "/src/main.tsx";

export type ChunkErrorKind = "stale" | "unreachable" | "broken";

export class ChunkLoadError extends Error {
  kind: ChunkErrorKind;
  url: string;
  status?: number;
  detail?: string;
  constructor(kind: ChunkErrorKind, message: string, url: string, status?: number, detail?: string) {
    super(message);
    this.name = "ChunkLoadError";
    this.kind = kind;
    this.url = url;
    this.status = status;
    this.detail = detail;
  }
}

export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof ChunkLoadError) return true;
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
    text.includes("outdated optimize dep") ||
    /^loading chunk [a-z0-9-]+ failed/i.test(text) ||
    text.includes("dynamically imported module")
  );
}

/** Pull the module PATH (same-origin) out of a dynamic-import error. Absolute
 *  URLs from an old preview host are stripped back to the current origin. */
export function moduleUrlFromError(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String((error as { message?: unknown })?.message ?? error);
  const match = message.match(/(?:https?:\/\/[^/\s]+)?(\/src\/[^'"\s)]+\.(?:tsx?|jsx?))/);
  return match ? match[1] : ENTRY_PROBE;
}

export function guardedReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    // One automatic recovery reload per 15 s window — never a reload loop.
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage unavailable — allow the reload */
  }
  window.location.reload();
  return true;
}

/** Manual reload from the recovery screen always clears the guard first. */
export function forceReload(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface ProbeResult {
  reachable: boolean;
  ok: boolean;
  status?: number;
  detail?: string;
}

async function probeOnce(url: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "text/javascript,*/*" } });
    if (res.ok) return { reachable: true, ok: true, status: res.status };
    const body = await res.text().catch(() => "");
    return {
      reachable: true,
      ok: false,
      status: res.status,
      detail: body.slice(0, 800),
    };
  } catch {
    return { reachable: false, ok: false };
  }
}

/**
 * Repeatedly probe the app entry/module. Resolves "reload" once the server is
 * serving fresh modules, "unreachable" if it never answers, or "broken" if it
 * answers with a build/HTTP error that reloading won't fix.
 */
export async function diagnoseConnection(
  error: unknown,
  opts?: { rounds?: number; intervalMs?: number }
): Promise<"reload" | ChunkErrorKind> {
  const rounds = opts?.rounds ?? 8;
  const intervalMs = opts?.intervalMs ?? 2500;
  const target = moduleUrlFromError(error);

  for (let i = 0; i < rounds; i += 1) {
    // Liveness of the CURRENT origin first (the error URL may belong to an
    // old preview host whose tunnel is gone).
    const entry = await probeOnce(ENTRY_PROBE);
    if (!entry.reachable) {
      await wait(intervalMs); // server/tunnel down or restarting — keep waiting
      continue;
    }
    if (!entry.ok) {
      throw new ChunkLoadError("broken", "Application entry failed to load", ENTRY_PROBE, entry.status, entry.detail);
    }
    // Server is up: is the failing module a real build error or just stale?
    if (target !== ENTRY_PROBE) {
      const probe = await probeOnce(target);
      if (!probe.reachable) {
        await wait(intervalMs);
        continue;
      }
      if (!probe.ok) {
        throw new ChunkLoadError(
          "broken",
          `Module failed to load (HTTP ${probe.status ?? "?"})`,
          target,
          probe.status,
          probe.detail
        );
      }
    }
    // Module now serves cleanly -> the tab's module graph was stale.
    return "reload";
  }
  return "unreachable";
}

function neverResolve<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function retryable<M>(
  loader: () => Promise<M>,
  attemptsLeft: number,
  delayMs: number
): () => Promise<M> {
  return () =>
    loader().catch(async (error: unknown) => {
      // Network-style failure of a page chunk: back off and retry.
      if (attemptsLeft > 0) {
        await wait(delayMs);
        return retryable(loader, attemptsLeft - 1, Math.min(delayMs * 1.8, 2400))();
      }
      if (isChunkLoadError(error)) {
        // Out of quick retries — is the server down (wait for it), is the
        // module genuinely broken, or do we just need a fresh module graph?
        const verdict = await diagnoseConnection(error);
        if (verdict === "reload" && guardedReload()) {
          // Reloading to the fresh graph; keep Suspense pending meanwhile.
          return neverResolve<M>();
        }
        if (verdict === "unreachable") {
          throw new ChunkLoadError(
            "unreachable",
            "Cannot reach the application server",
            moduleUrlFromError(error)
          );
        }
        // guard blocked an automatic reload, or a broken-module error threw
        // from inside diagnoseConnection.
        if (error instanceof ChunkLoadError) throw error;
        throw new ChunkLoadError("stale", "Application modules were updated", moduleUrlFromError(error));
      }
      throw error;
    });
}

/**
 * Wrap ANY dynamic-import factory with retries + connection-aware recovery.
 * Works directly inside React.lazy (module namespace already has `default`).
 */
export function retryableImport<M>(loader: () => Promise<M>, attempts = 4): () => Promise<M> {
  return retryable(loader, attempts, 400);
}

/**
 * React.lazy equivalent whose dynamic import survives transient dev-server /
 * tunnel restarts, waits out cold starts, and auto-recovers from stale chunks.
 */
export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  loader: () => Promise<{ default: T } | T>,
  attempts = 4
): React.LazyExoticComponent<T> {
  const factory = retryable(async () => {
    const mod = await loader();
    // Normalise both `{ default: C }` (lazyShell) and module namespaces.
    const component = (mod as { default?: T }).default ?? (mod as T);
    return { default: component };
  }, attempts, 400);
  return React.lazy(factory);
}
