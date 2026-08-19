import { useCallback, useEffect, useState } from "react";
import type { Trip } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import {
  fetchDeliveryEmailStatuses,
  sendDeliveryEmail,
  type DeliveryEmailRow,
  type DeliveryEmailStatusValue,
} from "../services/deliveryEmailService";
import {
  deliveryEmailAttemptFeedback,
  userFacingDeliveryEmailError,
} from "../services/deliveryEmailErrors";
import { generateShopPDF } from "../utils/generateShopPDF";

type Props = {
  trip: Trip;
  shops?: Shop[];
};

function statusLabel(status: DeliveryEmailStatusValue, sending: boolean): string {
  if (sending && status === "failed") return "Retrying...";
  if (sending) return "Sending...";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Email failed";
  if (status === "sending") return "Sending...";
  return "Pending";
}

export default function DeliveryEmailPanel({ trip, shops = [] }: Props) {
  const [rows, setRows] = useState<DeliveryEmailRow[]>([]);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!trip.id || trip.status !== "Completed") return;
    try {
      setRows(await fetchDeliveryEmailStatuses(trip.id));
    } catch {
      /* keep last known rows */
    }
  }, [trip.id, trip.status]);

  useEffect(() => {
    if (trip.status !== "Completed") return;
    let cancelled = false;
    void (async () => {
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.status, refresh]);

  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  const shopEmail = (shopId: number | null, statusRow?: DeliveryEmailRow) => {
    const fromMaster = statusRow?.shopEmail?.trim();
    if (fromMaster) return fromMaster;
    if (shopId) {
      const match = shops.find((s) => s.id === shopId);
      if (match?.email?.trim()) return match.email.trim();
    }
    return statusRow?.recipient?.trim() || "—";
  };

  const retry = async (deliveryId: number) => {
    if (busyIds.has(deliveryId)) return;
    const delivery = (trip.deliveries || []).find((d) => d.id === deliveryId);
    if (!delivery) return;
    const statusRow = rows.find((r) => r.deliveryId === deliveryId);
    setBusyIds((prev) => new Set(prev).add(deliveryId));
    try {
      const result = await sendDeliveryEmail({
        trip,
        delivery,
        shopEmail: statusRow?.shopEmail ?? null,
      });
      const feedback = deliveryEmailAttemptFeedback(result);
      if (feedback.toast) {
        setSuccessToast(feedback.toast);
        setLocalErrors((prev) => {
          const next = { ...prev };
          delete next[deliveryId];
          return next;
        });
      } else {
        const inlineError = feedback.inlineError ?? "Unable to send email.";
        setLocalErrors((prev) => ({ ...prev, [deliveryId]: inlineError }));
      }
    } catch (err) {
      const message = userFacingDeliveryEmailError(
        err instanceof Error ? err.message : "Unable to send email."
      );
      setLocalErrors((prev) => ({ ...prev, [deliveryId]: message }));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(deliveryId);
        return next;
      });
      await refresh();
    }
  };

  const downloadPdf = async (deliveryId: number) => {
    const delivery = (trip.deliveries || []).find((d) => d.id === deliveryId);
    if (!delivery) return;
    await generateShopPDF(
      delivery,
      trip.boxDetails || [],
      trip.tripNo,
      trip.vehicleNo,
      trip.supervisorName,
      undefined,
      trip.tripDate,
      undefined,
      undefined,
      delivery.autoCaptureTime,
      trip.driverName
    );
  };

  if (trip.status !== "Completed") return null;

  const deliveries = trip.deliveries || [];
  if (!deliveries.length) return null;

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
      {successToast ? (
        <div
          className="absolute top-2 right-2 z-20 pointer-events-none bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium"
          role="status"
          aria-live="polite"
        >
          {successToast}
        </div>
      ) : null}
      <h3 className="text-sm font-bold text-slate-800">Shop delivery emails</h3>
      <div className="space-y-2">
        {deliveries.map((delivery) => {
          const statusRow = rows.find((r) => r.deliveryId === delivery.id);
          const status = statusRow?.status ?? "pending";
          const sending = busyIds.has(delivery.id) || status === "sending";
          const failedReason =
            status === "sent"
              ? null
              : status === "failed" || localErrors[delivery.id]
                ? userFacingDeliveryEmailError(
                    statusRow?.failureReason ?? localErrors[delivery.id]
                  )
                : null;
          return (
            <div
              key={delivery.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2.5 bg-slate-50/60"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{delivery.shopName}</p>
                <p className="text-xs text-slate-500">
                  Email: {shopEmail(delivery.shopId, statusRow)}
                </p>
                {failedReason ? (
                  <p className="text-xs text-red-600 mt-0.5">{failedReason}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void downloadPdf(delivery.id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700"
                >
                  PDF
                </button>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    status === "sent"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : status === "failed"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {statusLabel(status, sending)}
                </span>
                {status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => void retry(delivery.id)}
                    disabled={sending}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? "Retrying..." : "Retry"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
