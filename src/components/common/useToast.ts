/**
 * =============================================================================
 * DMR Poultries ERP — toast context + `useToast()` hook
 * =============================================================================
 * The context and the hook used to live in `ToastProvider.tsx`, which made that
 * module export a component and a hook together (react-refresh/only-export-
 * components). They now live here; `<ToastProvider>` in `./ToastProvider`
 * supplies the value, so the hook's behaviour, the error thrown outside a
 * provider and the returned API object are all unchanged.
 * =============================================================================
 */

import { createContext, useContext } from "react";
import type { NotificationTone } from "../../ui/notifications/notificationStore";

/** Public toast tone alias — identical to `ToastType` in `./ToastProvider`. */
type ToastTone = NotificationTone;

export interface ToastContextType {
  showToast: (message: string, type?: ToastTone, duration?: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  /** Raw form, matching the previous `showToast(message, type, duration)`. */
  show: (message: string, type?: ToastTone, duration?: number) => void;
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
