/**
 * Fleet-operations toast hook — adapter over the global notification store.
 *
 * This previously kept the message in local component state that no consumer
 * rendered, so actions like "Exporting … as PDF" produced no visible feedback.
 * It now feeds the single system rendered by `<NotificationHost />`.
 *
 * COMPATIBILITY
 *   `showToast(message, type)` is unchanged.
 *   `toast` is retained in the return shape for existing destructuring, but it
 *   is always `null`: rendering is owned globally, so a consumer that still
 *   reads `toast` cannot accidentally draw a SECOND notification for the same
 *   action.
 */

import { useCallback } from "react";
import { push, type NotificationTone } from "../../../ui/notifications/notificationStore";

export interface FleetToastState {
  message: string;
  type: NotificationTone;
}

export function useToast(): {
  toast: FleetToastState | null;
  showToast: (message: string, type?: NotificationTone) => void;
} {
  const showToast = useCallback((message: string, type: NotificationTone = "success") => {
    push(message, type);
  }, []);

  return { toast: null, showToast };
}
