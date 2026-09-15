// src/shared/ui/viewLayer.ts
//
// ============================================================================
// VIEW LAYER — "a full-screen view is open right now"
// ============================================================================
// The app shell's full-screen views (Trip List view, Driver/Supervisor
// Performance details, Rate Entry view, …) all render through AppShellModal,
// which portals them onto <body>. Two shell pieces need to know that:
//
//   • the Header — so it stays usable (search, language, notifications) while a
//     view is open instead of being swallowed by the view's overlay;
//   • the notification host — so its toasts move out of the view's way.
//
// A tiny external store beats a DOM observer: AppShellModal is the single
// mount point, so it just counts how many views are open and every reader uses
// `useSyncExternalStore`. Depth (not a boolean) because a view can open another.
// ============================================================================

import { useSyncExternalStore } from "react";

let depth = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Called by AppShellModal while it is mounted open. Returns the undo. */
export function enterViewLayer(): () => void {
  depth += 1;
  emit();
  return () => {
    depth = Math.max(0, depth - 1);
    emit();
  };
}

export function getViewLayerDepth(): number {
  return depth;
}

export function subscribeViewLayer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while at least one full-screen view is open. */
export function useViewLayerOpen(): boolean {
  return useSyncExternalStore(subscribeViewLayer, () => depth > 0, () => false);
}
