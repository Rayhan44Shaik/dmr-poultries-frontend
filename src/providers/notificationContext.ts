/**
 * =============================================================================
 * DMR Poultries ERP — notification context + hooks
 * =============================================================================
 * The non-component half of `<NotificationProvider>`: the context moved out so
 * the provider module exports components only
 * (react-refresh/only-export-components), and the same single context instance
 * keeps being shared by every consumer — no second context is created.
 *
 * Nothing in this file may import React components.
 * =============================================================================
 */

import { createContext, useContext } from "react";
import {
  dismissAll,
  type NotificationTone,
} from "../ui/notifications/notificationStore";

/** Accepted tones. Superset of the previous union — existing callers are fine. */
export type NotificationType = NotificationTone;

export interface NotificationContextType {
  showNotification: (
    message: string,
    type?: NotificationType,
    duration?: number,
  ) => void;
  hideNotification: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}

/** Clear every notification on screen (Escape / route-change style resets). */
export function clearNotifications(): void {
  dismissAll();
}
