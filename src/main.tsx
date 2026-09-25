import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ChunkLoadError, diagnoseConnection, guardedReload, isChunkLoadError } from "./routes/lazyWithRetry";

// -----------------------------------------------------------------------------
// SELF-HEALING LAZY LOADS (global layer)
// -----------------------------------------------------------------------------
// Pages already retry + diagnose their own imports through lazyWithRetry; these
// window handlers are the outer net for failures Vite surfaces before React.
// Before reloading we probe the server so a cold tunnel is waited out instead
// of triggering a pointless reload loop.
// -----------------------------------------------------------------------------
async function recover(error: unknown): Promise<void> {
  if (!isChunkLoadError(error)) return;
  try {
    const verdict = await diagnoseConnection(error);
    if (verdict === "reload") {
      guardedReload();
    }
    // "unreachable" / "broken": lazyWithRetry's boundary owns the UI; nothing
    // else to do at the window layer.
  } catch (diagnosed) {
    if (diagnosed instanceof ChunkLoadError) return; // boundary shows details
  }
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault?.();
  void recover((event as unknown as { payload?: unknown }).payload ?? event);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    typeof reason === "string" ? reason : reason?.message ? String(reason.message) : String(reason);
  if (isChunkLoadError(message)) {
    void recover(reason);
  }
});

// Number fields retain keyboard entry but never mutate while the page is
// being scrolled. Capture handles every current and future numeric input.
document.addEventListener("wheel", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === "number" && document.activeElement === target) {
    event.preventDefault();
  }
}, { capture: true, passive: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
