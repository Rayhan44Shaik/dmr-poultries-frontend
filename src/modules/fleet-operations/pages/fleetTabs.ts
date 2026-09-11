// Fleet tab chunk loaders + warm-up helper (kept out of FleetPages.tsx so
// that file only exports components for React Fast Refresh).
import type { ComponentType } from "react";
import type { VisibleFleetTab } from "../activeFleetScope";

export type FleetTabComponent = ComponentType<{
  embedded?: boolean;
  active?: boolean;
}>;

export const tabLoaders: Record<
  VisibleFleetTab,
  () => Promise<{ default: FleetTabComponent }>
> = {
  entry: () => import("./MaintenanceEntryPage"),
  history: () => import("./MaintenanceHistoryPage"),
  permits: () => import("./DocumentsExpiryPage"),
  emi: () => import("./EmiLoansPage"),
  analytics: () => import("./VehicleAnalyticsPage"),
  fastag: () => import("./FastagDashboardPage"),
};

const warmed = new Set<VisibleFleetTab>();

/** Kick off a tab's chunk; dynamic imports are de-duped by the bundler. */
export function preloadFleetTab(tab: VisibleFleetTab) {
  if (warmed.has(tab)) return;
  warmed.add(tab);
  void tabLoaders[tab]().catch(() => warmed.delete(tab));
}

/** Run a callback during the browser's idle time (timeout fallback). */
export function onIdle(cb: () => void): number | ReturnType<typeof setTimeout> {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    return window.requestIdleCallback(cb, { timeout: 3000 });
  }
  return setTimeout(cb, 1500);
}

export function cancelIdle(handle: number | ReturnType<typeof setTimeout>) {
  if (typeof window !== "undefined" && window.cancelIdleCallback && typeof handle === "number") {
    window.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
}
