/**
 * `useSafeNotification` — notification access that cannot throw.
 *
 * Previously this wrapped `useNotification()` in a `try`/`catch` and fell back
 * to `alert(message)`, which is the most blocking notification possible: it
 * freezes the tab, cannot be styled, cannot be deduplicated and is not
 * announced consistently by screen readers. It also called a hook inside a
 * `try` block, which makes hook order conditional.
 *
 * The global notification store is module-scoped and provider-independent, so
 * no hook and no fallback path are needed: this now delegates straight to the
 * single system rendered by `<NotificationHost />`.
 *
 * The returned object is module-constant, so it is referentially stable and
 * safe to include in dependency arrays.
 */

import {
  dismissLatest,
  push,
  type NotificationTone,
} from "../ui/notifications/notificationStore";

export interface SafeNotification {
  showNotification: (message: string, type?: NotificationTone, duration?: number) => void;
  hideNotification: () => void;
}

const SAFE_NOTIFICATION: SafeNotification = {
  showNotification: (message, type = "info", duration) => {
    push(message, type, duration === undefined ? {} : { duration });
  },
  hideNotification: () => {
    dismissLatest();
  },
};

export function useSafeNotification(): SafeNotification {
  return SAFE_NOTIFICATION;
}
