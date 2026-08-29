// src/modules/operations/vehicle-trips/components/TripViewShopCards.tsx
// Read-only shop delivery cards for the completed Trip View.
// Communication status is intentionally represented by icons only.

import React, { useMemo, useState } from "react";
import {
  Mail,
  RotateCw,
  Box,
  Bird,
  Scale,
  Clock,
  AlertCircle,
  Package,
  Loader2,
  Search,
  X,
  CheckCircle2,
  XCircle,
  FileDown,
} from "lucide-react";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip, ShopDelivery } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import type { DeliveryEmailStatusValue } from "../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../services/deliveryWhatsAppService";

export type TripViewShopCardsProps = {
  trip: Trip;
  shops: Shop[];
  effectiveStatus: (deliveryId: number) => DeliveryEmailStatusValue;
  busyIds: Set<number>;
  isBulkSending: boolean;
  bulkProgress: { sent: number; total: number } | null;
  shopEmailFor: (delivery: ShopDelivery) => string;
  failureReasonFor: (deliveryId: number) => string | null;
  sendCountFor?: (deliveryId: number) => number;
  onSendOne: (delivery: ShopDelivery) => void;
  onDownloadPdf: (delivery: ShopDelivery) => void;
  emailCounts?: { sent: number; pending: number; sending: number; failed: number; total: number };
  whatsappEffectiveStatus?: (deliveryId: number) => DeliveryWhatsAppStatusValue;
  whatsappBusyIds?: Set<number>;
  whatsappIsBulkSending?: boolean;
  shopWhatsAppFor?: (delivery: ShopDelivery) => string;
  whatsappFailureReasonFor?: (deliveryId: number) => string | null;
  whatsappSendCountFor?: (deliveryId: number) => number;
  onSendOneWhatsApp?: (delivery: ShopDelivery) => void;
  whatsappCounts?: { sent: number; pending: number; sending: number; failed: number; total: number };
};

function ChannelIcon({
  channel,
  status,
  sending,
  onClick,
  disabled,
  title,
}: {
  channel: "mail" | "whatsapp";
  status: DeliveryEmailStatusValue | DeliveryWhatsAppStatusValue;
  sending: boolean;
  onClick: () => void;
  disabled: boolean;
  title: string;
}) {
  const isSending = sending || status === "sending";
  const isSent = status === "sent";
  const isFailed = status === "failed";
  const Icon = channel === "mail" ? Mail : WhatsAppIcon;

  const tone = isSending
    ? "border-sky-200 bg-sky-50 text-sky-600"
    : isSent
      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
      : isFailed
        ? "border-red-200 bg-red-50 text-red-600"
        : channel === "mail"
          ? "border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50"
          : "border-green-200 bg-white text-green-600 hover:bg-green-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {isSending ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      <span className="sr-only">{isSent ? "Sent" : isFailed ? "Failed" : "Pending"}</span>
    </button>
  );
}

export function TripViewShopCards({
  trip,
  effectiveStatus,
  busyIds,
  isBulkSending,
  shopEmailFor,
  failureReasonFor,
  sendCountFor,
  onSendOne,
  onDownloadPdf,
  whatsappEffectiveStatus,
  whatsappBusyIds,
  whatsappIsBulkSending,
  shopWhatsAppFor,
  whatsappFailureReasonFor,
  onSendOneWhatsApp,
}: TripViewShopCardsProps) {
  const deliveries = useMemo(
    () => (Array.isArray(trip.deliveries) ? trip.deliveries : []),
    [trip.deliveries]
  );
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filteredDeliveries = useMemo(() => {
    if (!query) return deliveries;
    return deliveries.filter(
      (delivery) =>
        (delivery.shopName || "").toLowerCase().includes(query) ||
        (delivery.birdType || "").toLowerCase().includes(query)
    );
  }, [deliveries, query]);

  if (deliveries.length === 0) return null;

  const display = (value: string | number | null | undefined) => {
    if (value == null || value === "" || (typeof value === "number" && Number.isNaN(value))) {
      return "Not entered";
    }
    return String(value);
  };

  return (
    <>
      <style>{`div:has(> .trip-view-shop-deliveries) + section { display: none !important; }`}</style>
      <div className="trip-view-shop-deliveries space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
            <Package size={16} className="text-emerald-600 shrink-0" />
            <span>Shop Deliveries</span>
            <span className="font-semibold text-[11px] text-slate-400">({deliveries.length})</span>
          </h3>
          <div className="relative w-52 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shops..."
              aria-label="Search shops by name or bird type"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear shop search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {filteredDeliveries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
            No shops match “{search.trim()}”.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredDeliveries.map((delivery) => {
              const status = effectiveStatus(delivery.id);
              const sending = busyIds.has(delivery.id) || status === "sending";
              const failedReason = status === "failed" ? failureReasonFor(delivery.id) : null;
              const sendCount = sendCountFor ? sendCountFor(delivery.id) : 0;
              const whatsappStatus = whatsappEffectiveStatus?.(delivery.id) ?? "pending";
              const whatsappSending = (whatsappBusyIds?.has(delivery.id) ?? false) || whatsappStatus === "sending";
              const whatsappFailedReason = whatsappStatus === "failed" ? whatsappFailureReasonFor?.(delivery.id) ?? null : null;

              const isWeightMode = delivery.deliveryMode === "weight";
              const selectedBoxes = Array.isArray(delivery.selectedBoxIds)
                ? delivery.selectedBoxIds
                : delivery.boxNo != null && delivery.boxNo > 0
                  ? [delivery.boxNo]
                  : [];
              const mortalityCount = delivery.mortality ?? 0;
              const mortKg = delivery.mortKg ?? 0;

              return (
                <div
                  key={delivery.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate" title={delivery.shopName}>
                        {delivery.shopName || "Not entered"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5" title={shopEmailFor(delivery)}>
                        {shopEmailFor(delivery) || "No email"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                        isWeightMode
                          ? "bg-purple-50 text-purple-700 border-purple-200/60"
                          : "bg-amber-50 text-amber-700 border-amber-200/60"
                      }`}
                    >
                      {isWeightMode ? "WEIGHT" : "BOX"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                    <div className="flex flex-col items-center justify-center text-center p-1.5 bg-white rounded-lg border border-slate-200/50">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5"><Box size={11} className="text-slate-500" /> Boxes</span>
                      <span className="text-xs font-bold text-slate-800">{display(selectedBoxes.length || delivery.boxNo)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-1.5 bg-white rounded-lg border border-slate-200/50">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5"><Bird size={11} className="text-sky-600" /> Birds</span>
                      <span className="text-xs font-bold text-slate-800">{display(delivery.birds)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-1.5 bg-white rounded-lg border border-slate-200/50">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5"><Scale size={11} className="text-emerald-600" /> Weight</span>
                      <span className="text-xs font-bold text-slate-800">{delivery.weight ? `${delivery.weight.toFixed(2)} kg` : "Not entered"}</span>
                    </div>
                  </div>

                  {(mortalityCount > 0 || mortKg > 0) && (
                    <div className="flex items-center justify-between px-2 py-1.5 bg-red-50/60 rounded-lg border border-red-100 text-[11px]">
                      <span className="text-red-600 font-semibold flex items-center gap-1"><AlertCircle size={12} className="text-rose-500" /> Mortality</span>
                      <span className="text-red-700 font-bold">{mortalityCount} birds · {mortKg ? mortKg.toFixed(2) : "0.00"} kg</span>
                    </div>
                  )}

                  {selectedBoxes.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100/60 rounded-lg border border-slate-200/40 text-[11px] overflow-x-auto scrollbar-none">
                      <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0 text-[10px] uppercase"><Package size={12} className="text-slate-500" /> Box Nos:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {selectedBoxes.map((id) => <span key={id} className="px-1.5 py-0.5 bg-white text-slate-700 font-bold rounded border border-slate-200/80 text-[10px] shrink-0">#{id}</span>)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-0.5">
                    <div className="flex items-center gap-1"><Clock size={12} className="text-slate-400" /><span>Captured {delivery.autoCaptureTime || "—"}</span></div>
                    {delivery.birdType ? <span className="px-2 py-0.5 bg-sky-50 text-sky-700 font-semibold rounded-md text-[10px] border border-sky-100">{delivery.birdType}</span> : null}
                  </div>

                  {(failedReason || whatsappFailedReason) && (
                    <p className="text-[11px] text-red-600 px-1 truncate" title={failedReason || whatsappFailedReason || undefined}>{failedReason || `WhatsApp: ${whatsappFailedReason}`}</p>
                  )}

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => onDownloadPdf(delivery)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                      title="Create PDF"
                      aria-label="Create PDF"
                    >
                      <FileDown size={13} />
                    </button>

                    <ChannelIcon
                      channel="mail"
                      status={status}
                      sending={sending}
                      onClick={() => onSendOne(delivery)}
                      disabled={sending || isBulkSending}
                      title={status === "sent" ? `Email sent${sendCount > 1 ? ` ${sendCount} times` : ""}` : status === "failed" ? "Email failed — click to retry" : "Send email"}
                    />

                    {onSendOneWhatsApp && (
                      <ChannelIcon
                        channel="whatsapp"
                        status={whatsappStatus}
                        sending={whatsappSending}
                        onClick={() => onSendOneWhatsApp(delivery)}
                        disabled={whatsappSending || whatsappIsBulkSending === true}
                        title={whatsappStatus === "sent" ? "WhatsApp sent" : whatsappStatus === "failed" ? "WhatsApp failed — click to retry" : "Send WhatsApp"}
                      />
                    )}

                    {(status === "failed" || whatsappStatus === "failed") && !sending && !whatsappSending && (
                      <button
                        type="button"
                        onClick={() => {
                          if (status === "failed") onSendOne(delivery);
                          else if (onSendOneWhatsApp) onSendOneWhatsApp(delivery);
                        }}
                        disabled={isBulkSending || whatsappIsBulkSending === true}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Retry failed delivery"
                      >
                        <RotateCw size={12} /> Retry
                      </button>
                    )}

                    <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400" aria-label="Communication status">
                      {status === "sent" ? <CheckCircle2 size={12} className="text-emerald-500" /> : status === "failed" ? <XCircle size={12} className="text-red-500" /> : null}
                      {whatsappStatus === "sent" ? <CheckCircle2 size={12} className="text-green-500" /> : whatsappStatus === "failed" ? <XCircle size={12} className="text-red-500" /> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default React.memo(TripViewShopCards);