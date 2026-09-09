/**
 * Settings toast hook — adapter over the global notification store.
 *
 * This previously accumulated toasts in local state that no consumer rendered,
 * so settings actions gave no visible feedback. It now feeds the single system
 * rendered by `<NotificationHost />`.
 *
 * COMPATIBILITY
 *   `showToast(message, type)` is unchanged and additionally accepts "warning".
 *   `toasts` is retained for existing destructuring but is always an empty
 *   array: rendering is owned globally, so a consumer that still maps over
 *   `toasts` cannot draw a SECOND notification for the same action.
 */

import { useCallback } from "react";
import { push, type NotificationTone } from "../../../ui/notifications/notificationStore";

export interface SettingsToastItem {
  id: number;
  message: string;
  type: NotificationTone;
}

/** Frozen constant: a new `[]` each render would invalidate memo/effect deps. */
const NO_TOASTS: readonly SettingsToastItem[] = Object.freeze([]) as readonly SettingsToastItem[];

export const useToast = () => {
  const showToast = useCallback(
    (message: string, type: NotificationTone = "info", duration?: number) => {
      push(message, type, duration === undefined ? {} : { duration });
    },
    [],
  );

  return { toasts: NO_TOASTS, showToast };
};
