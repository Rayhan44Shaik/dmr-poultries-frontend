import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { guardedReload, isChunkLoadError } from "./routes/lazyWithRetry";

// -----------------------------------------------------------------------------
// SELF-HEALING LAZY LOADS (global layer)
// -----------------------------------------------------------------------------
// Pages also retry their own dynamic imports via lazyWithRetry; these window
// handlers are the outer safety net for failures Vite surfaces before React
// (preload polyfill) or outside the lazy boundary. guardedReload performs at
// most one recovery reload per window and never loops on a genuinely broken
// module.
// -----------------------------------------------------------------------------
window.addEventListener("vite:preloadError", (event) => {
  // We control the recovery reload; don't let the default + ours fire twice.
  event.preventDefault?.();
  guardedReload();
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    typeof reason === "string"
      ? reason
      : reason?.message
        ? String(reason.message)
        : String(reason);
  if (isChunkLoadError(message)) {
    guardedReload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
