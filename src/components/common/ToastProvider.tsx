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
import { createContext, useCallback, useContext, useMemo } from "react";
// `useMemo` is used by the provider below to keep the context value stable.
import {
  push,
  type NotificationTone,
} from "../../ui/notifications/notificationStore";

export type ToastType = NotificationTone;

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

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

export interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  /** Raw form, matching the previous `showToast(message, type, duration)`. */
  show: (message: string, type?: ToastType, duration?: number) => void;
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const { showToast } = context;

  // Mirrors the previous shape exactly (a fresh api object per render), so
  // existing destructuring call sites behave identically.
  return {
    success: (message, duration) => showToast(message, "success", duration),
    error: (message, duration) => showToast(message, "error", duration),
    warning: (message, duration) => showToast(message, "warning", duration),
    info: (message, duration) => showToast(message, "info", duration),
    show: (message, type, duration) => showToast(message, type, duration),
  };
}
