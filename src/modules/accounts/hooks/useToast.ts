/**
 * Accounts toast hook — adapter over the global notification store.
 *
 * This previously only wrote to `console.log`, so accounts users got NO visible
 * feedback for success or failure. It now feeds the single system rendered by
 * `<NotificationHost />`.
 *
 * Return shape is unchanged (`{ success, error, info }`); `warning` and `show`
 * are additive.
 */

import { push, type NotificationTone } from "../../../ui/notifications/notificationStore";

export interface AccountsToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  show: (message: string, type?: NotificationTone, duration?: number) => void;
}

// Module constant → referentially stable, safe in dependency arrays.
const ACCOUNTS_TOAST: AccountsToastApi = {
  success: (message, duration) => push(message, "success", duration === undefined ? {} : { duration }),
  error: (message, duration) => push(message, "error", duration === undefined ? {} : { duration }),
  warning: (message, duration) => push(message, "warning", duration === undefined ? {} : { duration }),
  info: (message, duration) => push(message, "info", duration === undefined ? {} : { duration }),
  show: (message, type = "info", duration) => push(message, type, duration === undefined ? {} : { duration }),
};

export function useToast(): AccountsToastApi {
  return ACCOUNTS_TOAST;
}
