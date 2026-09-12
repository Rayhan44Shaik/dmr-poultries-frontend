// src/modules/operations/vehicle-trips/hooks/useTripDeliveryEmails.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trip, ShopDelivery } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import {
  fetchDeliveryEmailStatuses,
  sendDeliveryEmail,
  type DeliveryEmailRow,
  type DeliveryEmailStatusValue,
} from "../services/deliveryEmailService";
import { userFacingDeliveryEmailError } from "../services/deliveryEmailErrors";
import { translate } from "../../../../i18n";

export type EmailCounts = {
  sent: number;
  pending: number;
  sending: number;
  failed: number;
  total: number;
};

export type DeliveryEmailSendResult = {
  success: boolean;
  status: DeliveryEmailStatusValue;
  message: string;
  sendCount?: number;
};

const FAILURE_HIGHLIGHT_MS = 60_000;

type Options = {
  /** When true, statuses are only loaded for completed trips (default). */
  enabled?: boolean;
};

/**
 * Live per-delivery email state for the read-only Trip View.
 * - Individual send: delivery -> existing per-delivery email endpoint.
 * - Bulk send: all eligible deliveries (not already `sent`) through the same
 *   mechanism, sequentially, so each shop's status is visible as it progresses.
 * - Statuses are tracked locally per delivery and synced back from the server.
 */
export function useTripDeliveryEmails(trip: Trip | null, shops: Shop[] = [], options: Options = {}) {
  const { enabled = true } = options;
  const completed = Boolean(trip && trip.status === "Completed" && enabled);

  const [rows, setRows] = useState<DeliveryEmailRow[]>([]);
  const [localStatus, setLocalStatus] = useState<Record<number, DeliveryEmailStatusValue>>({});
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});
  const [localSendCounts, setLocalSendCounts] = useState<Record<number, number>>({});
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; total: number } | null>(null);
  const bulkRunRef = useRef(0);
  const failureResetTimersRef = useRef<Record<number, number>>({});

  const tripId = trip?.id ?? 0;

  const clearFailureReset = useCallback((deliveryId: number) => {
    const timeoutId = failureResetTimersRef.current[deliveryId];
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
      delete failureResetTimersRef.current[deliveryId];
    }
  }, []);

  const clearAllFailureResets = useCallback(() => {
    Object.values(failureResetTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    failureResetTimersRef.current = {};
  }, []);

  const scheduleFailureReset = useCallback(
    (deliveryId: number) => {
      clearFailureReset(deliveryId);
      failureResetTimersRef.current[deliveryId] = window.setTimeout(() => {
        setLocalStatus((prev) => {
          if (prev[deliveryId] !== "failed") return prev;
          return { ...prev, [deliveryId]: "pending" as const };
        });
        setLocalErrors((prev) => {
          if (!(deliveryId in prev)) return prev;
          const next = { ...prev };
          delete next[deliveryId];
          return next;
        });
        delete failureResetTimersRef.current[deliveryId];
      }, FAILURE_HIGHLIGHT_MS);
    },
    [clearFailureReset]
  );

  useEffect(() => () => clearAllFailureResets(), [clearAllFailureResets]);

  const refresh = useCallback(async () => {
    if (!completed || !tripId) return;
    try {
      const next = await fetchDeliveryEmailStatuses(tripId);
      setRows(next);
    } catch {
      /* keep last known rows */
    }
  }, [completed, tripId]);

  useEffect(() => {
    if (!completed) {
      clearAllFailureResets();
      setRows([]);
      setLocalStatus({});
      setLocalErrors({});
      setLocalSendCounts({});
      setBusyIds(new Set());
      setBulkProgress(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [completed, refresh, clearAllFailureResets]);

  const effectiveStatus = useCallback(
    (deliveryId: number): DeliveryEmailStatusValue => {
      const local = localStatus[deliveryId];
      if (local) return local;
      const row = rows.find((r) => r.deliveryId === deliveryId);
      return row?.status ?? "pending";
    },
    [localStatus, rows]
  );

  const shopEmailFor = useCallback(
    (delivery: ShopDelivery): string => {
      const row = rows.find((r) => r.deliveryId === delivery.id);
      const fromMaster = row?.shopEmail?.trim();
      if (fromMaster) return fromMaster;
      if (delivery.shopId) {
        const match = shops.find((s) => s.id === delivery.shopId);
        if (match?.email?.trim()) return match.email.trim();
      }
      return row?.recipient?.trim() || "—";
    },
    [rows, shops]
  );

  const failureReasonFor = useCallback(
    (deliveryId: number): string | null => {
      const localStatusOverride = localStatus[deliveryId];
      if (localStatusOverride && localStatusOverride !== "failed") return null;
      const local = localErrors[deliveryId];
      if (local) return local;
      const row = rows.find((r) => r.deliveryId === deliveryId);
      if (!row || row.status !== "failed") return null;
      return userFacingDeliveryEmailError(row.failureReason);
    },
    [localStatus, localErrors, rows]
  );

  const sendCountFor = useCallback(
    (deliveryId: number): number => {
      const row = rows.find((r) => r.deliveryId === deliveryId);
      return Math.max(row?.sendCount ?? 0, localSendCounts[deliveryId] ?? 0);
    },
    [rows, localSendCounts]
  );

  const counts: EmailCounts = useMemo(() => {
    const deliveries = trip?.deliveries ?? [];
    const total = deliveries.length;
    let sent = 0;
    let pending = 0;
    let sending = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      const status = effectiveStatus(delivery.id);
      if (status === "sent") sent += 1;
      else if (status === "sending") sending += 1;
      else if (status === "failed") failed += 1;
      else pending += 1;
    }
    return { sent, pending, sending, failed, total };
  }, [trip, effectiveStatus]);

  const setBusy = useCallback((deliveryId: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(deliveryId);
      else next.delete(deliveryId);
      return next;
    });
  }, []);

  /** Send a single shop's delivery email (no-op while that shop is sending). */
  const sendOne = useCallback(
    async (delivery: ShopDelivery): Promise<DeliveryEmailSendResult> => {
      if (!trip || !completed) {
        return {
          success: false,
          status: "failed",
          message: translate("ops.trip.unable_send_email"),
        };
      }
      if (busyIds.has(delivery.id) || isBulkSending) {
        return {
          success: false,
          status: "sending",
          message: translate("ops.trip.sending_email"),
        };
      }
      const row = rows.find((r) => r.deliveryId === delivery.id);
      const currentCount = Math.max(row?.sendCount ?? 0, localSendCounts[delivery.id] ?? 0);
      let outcome: DeliveryEmailSendResult;
      clearFailureReset(delivery.id);
      setBusy(delivery.id, true);
      setLocalStatus((prev) => ({ ...prev, [delivery.id]: "sending" as const }));
      setLocalErrors((prev) => {
        const next = { ...prev };
        delete next[delivery.id];
        return next;
      });
      try {
        const result = await sendDeliveryEmail({
          trip,
          delivery,
          shopEmail: row?.shopEmail ?? null,
        });
        if (result.status === "sent") {
          const nextCount = Math.max(currentCount + 1, Number(result.sendCount) || 0);
          setLocalStatus((prev) => ({ ...prev, [delivery.id]: "sent" as const }));
          setLocalSendCounts((prev) => ({
            ...prev,
            [delivery.id]: Math.max(prev[delivery.id] ?? 0, nextCount),
          }));
          outcome = {
            success: true,
            status: "sent",
            message: translate("ops.trip.email_sent_toast"),
            sendCount: nextCount,
          };
        } else {
          const message = userFacingDeliveryEmailError(result.message);
          setLocalStatus((prev) => ({ ...prev, [delivery.id]: "failed" as const }));
          setLocalErrors((prev) => ({
            ...prev,
            [delivery.id]: message,
          }));
          scheduleFailureReset(delivery.id);
          outcome = { success: false, status: "failed", message };
        }
      } catch (err) {
        const message = userFacingDeliveryEmailError(
          err instanceof Error ? err.message : translate("ops.trip.unable_send_email")
        );
        setLocalStatus((prev) => ({ ...prev, [delivery.id]: "failed" as const }));
        setLocalErrors((prev) => ({
          ...prev,
          [delivery.id]: message,
        }));
        scheduleFailureReset(delivery.id);
        outcome = { success: false, status: "failed", message };
      } finally {
        setBusy(delivery.id, false);
        await refresh();
      }
      return outcome;
    },
    [trip, completed, busyIds, isBulkSending, rows, localSendCounts, setBusy, refresh, clearFailureReset, scheduleFailureReset]
  );

  /**
   * Bulk send to all eligible deliveries (anything not already `sent`).
   * Sequential so the UI shows live Pending -> Sending -> Sent/Failed per shop.
   */
  const sendAll = useCallback(async (): Promise<void> => {
    if (!trip || !completed) return;
    if (isBulkSending) return;
    const run = ++bulkRunRef.current;
    const deliveries = trip.deliveries ?? [];
    const eligible = deliveries.filter((d) => effectiveStatus(d.id) !== "sent");
    if (eligible.length === 0) return;

    setIsBulkSending(true);
    setBulkProgress({ sent: 0, total: eligible.length });
    let sentCount = 0;

    for (const delivery of eligible) {
      if (bulkRunRef.current !== run) break;
      const status = effectiveStatus(delivery.id);
      if (status === "sent") {
        sentCount += 1;
        setBulkProgress({ sent: sentCount, total: eligible.length });
        continue;
      }
      const row = rows.find((r) => r.deliveryId === delivery.id);
      clearFailureReset(delivery.id);
      setLocalStatus((prev) => ({ ...prev, [delivery.id]: "sending" as const }));
      setLocalErrors((prev) => {
        const next = { ...prev };
        delete next[delivery.id];
        return next;
      });
      let succeeded = false;
      try {
        const result = await sendDeliveryEmail({
          trip,
          delivery,
          shopEmail: row?.shopEmail ?? null,
        });
        if (result.status === "sent") {
          const currentCount = Math.max(row?.sendCount ?? 0, localSendCounts[delivery.id] ?? 0);
          const nextCount = Math.max(currentCount + 1, Number(result.sendCount) || 0);
          succeeded = true;
          setLocalStatus((prev) => ({ ...prev, [delivery.id]: "sent" as const }));
          setLocalSendCounts((prev) => ({
            ...prev,
            [delivery.id]: Math.max(prev[delivery.id] ?? 0, nextCount),
          }));
        } else {
          setLocalStatus((prev) => ({ ...prev, [delivery.id]: "failed" as const }));
          setLocalErrors((prev) => ({
            ...prev,
            [delivery.id]: userFacingDeliveryEmailError(result.message),
          }));
          scheduleFailureReset(delivery.id);
        }
      } catch (err) {
        setLocalStatus((prev) => ({ ...prev, [delivery.id]: "failed" as const }));
        setLocalErrors((prev) => ({
          ...prev,
          [delivery.id]: userFacingDeliveryEmailError(
            err instanceof Error ? err.message : translate("ops.trip.unable_send_email")
          ),
        }));
        scheduleFailureReset(delivery.id);
      } finally {
        if (succeeded) sentCount += 1;
        setBulkProgress({ sent: sentCount, total: eligible.length });
      }
    }

    setIsBulkSending(false);
    setBulkProgress(null);
    await refresh();
  }, [trip, completed, isBulkSending, effectiveStatus, rows, localSendCounts, refresh, clearFailureReset, scheduleFailureReset]);

  return {
    rows,
    counts,
    isBulkSending,
    bulkProgress,
    busyIds,
    effectiveStatus,
    shopEmailFor,
    failureReasonFor,
    sendCountFor,
    sendOne,
    sendAll,
    refresh,
  };
}