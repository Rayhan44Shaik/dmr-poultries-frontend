/**
 * =============================================================================
 * TOAST PROVIDER — adapter over the global notification store
 * =============================================================================
 * Kept as the compatibility surface for `useToast()` call sites
 * (OrdersPage, PendingCollectionsPage, …). Rendering is owned by the single
 * `<NotificationHost />` mounted in App.tsx, so one action can never produce
 * two toasts from two competing systems.
 *
 * WHAT CHANGED FOR THE USER
 *   • Toasts are now subtle (white surface + coloured icon) instead of fully
 *     saturated green/red/blue slabs.
 *   • A `warning` tone exists.
 *   • Duplicate (tone + message) notifications collapse into one and refresh
 *     their timer, instead of stacking.
 *   • The entrance animation uses a real keyframe (`animate-toast-in`); the
 *     previous `animate-in slide-in-from-top` classes came from
 *     `tailwindcss-animate`, which is not installed, so they did nothing.
 *
 * API is unchanged and `warning` is additive.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { ToastContext, type ToastContextType } from "./useToast";
// `useMemo` is used by the provider below to keep the context value stable.
import {
  push,
  type NotificationTone,
} from "../../ui/notifications/notificationStore";

export type ToastType = NotificationTone;

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      push(message, type, duration === undefined ? {} : { duration });
    },
    [],
  );

  // Stable identity so consumers never re-render because of this provider.
  const value = useMemo<ToastContextType>(() => ({ showToast }), [showToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
