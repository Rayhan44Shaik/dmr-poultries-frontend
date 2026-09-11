import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// -----------------------------------------------------------------------------
// SELF-HEALING LAZY LOADS
// -----------------------------------------------------------------------------
// Every page is code-split (React.lazy + dynamic import). When the dev server
// restarts, a sandbox preview is replaced, or a new deploy lands while a tab
// is already open, the old tab holds stale chunk URLs and the dynamic import
// fails with "Failed to fetch dynamically imported module …". Vite emits
// `vite:preloadError` for exactly that case. We reload ONCE to pick up the
// fresh module graph; a 10s guard prevents a reload loop when a module is
// genuinely broken.
// -----------------------------------------------------------------------------
const PRELOAD_RELOAD_KEY = "dmr:preload-reload-at";

function isStaleChunkError(message?: string): boolean {
  const text = String(message ?? "").toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("error loading dynamically imported module") ||
    text.includes("importing a module script failed")
  );
}

function reloadOnceForStaleChunks(): boolean {
  try {
    const last = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage unavailable — reload anyway, the guard is best-effort */
  }
  window.location.reload();
  return true;
}

window.addEventListener("vite:preloadError", (event) => {
  // We control the recovery reload; don't let the default + ours fire twice.
  event.preventDefault?.();
  reloadOnceForStaleChunks();
});

// Safety net for lazy-import rejections that do not flow through Vite's
// preload polyfill (some React.lazy + native import() paths).
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    typeof reason === "string"
      ? reason
      : reason?.message
        ? String(reason.message)
        : String(reason);
  if (isStaleChunkError(message)) {
    reloadOnceForStaleChunks();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
