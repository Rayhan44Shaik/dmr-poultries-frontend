/**
 * =============================================================================
 * NOTIFICATION PROVIDER — adapter over the global notification store
 * =============================================================================
 * This provider used to render its own *blocking* centred dialog with a backdrop
 * and a "Got it" button. That was the second of two competing notification UIs
 * (the other being `components/common/ToastProvider`), it supported no
 * "warning" tone, and it froze the page behind a scrim for routine messages
 * like "Saved successfully."
 *
 * It is now a thin adapter over `src/ui/notifications/notificationStore`, which
 * is rendered once by `<NotificationHost />` in App.tsx.
 *
 * COMPATIBILITY — the public API is unchanged:
 *   • `<NotificationProvider>` still mounts where it always did
 *   • `useNotification()` still returns `{ showNotification, hideNotification }`
 *   • `showNotification(message, type?, duration?)` keeps its signature
 *   • "warning" is now additionally accepted (additive, breaks nothing)
 *
 * No call site needed to change, and no business logic is involved.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  dismissLatest,
  push,
} from "../ui/notifications/notificationStore";
import {
  NotificationContext,
  type NotificationContextType,
} from "./notificationContext";

/** Accepted tones — the public alias lives in ./notificationContext so this
 *  module exports components only. */
export type { NotificationType } from "./notificationContext";

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Stable identity: the value never changes, so consumers never re-render
  // because of this provider and the tree below it never remounts.
  const value = useMemo<NotificationContextType>(
    () => ({
      showNotification: (message, type = "info", duration) => {
        push(message, type, duration === undefined ? {} : { duration });
      },
      hideNotification: () => {
        // Legacy behaviour hid the single visible notification. With a stack we
        // retire the most recent one; `dismissAll` remains available to callers
        // that genuinely want to clear everything.
        dismissLatest();
      },
    }),
    [],
  );

  // Rendering is owned exclusively by <NotificationHost /> so that one action
  // can never produce two notifications from two providers.
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
