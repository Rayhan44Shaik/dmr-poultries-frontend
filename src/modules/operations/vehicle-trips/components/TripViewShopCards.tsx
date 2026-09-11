// src/modules/operations/vehicle-trips/components/TripViewShopCards.tsx
// Read-only shop delivery cards for the completed Trip View.
// Compact, production-ready UI with icon-only communication controls.

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
  FileDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip, ShopDelivery } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import type { DeliveryEmailStatusValue } from "../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../services/deliveryWhatsAppService";
import { useI18n } from "../../../../i18n";
import { uiSearchInputWithClearClass } from "../../../../shared/ui/uiTokens";

export type TripViewShopCardsProps = {
  trip: Trip;
  shops: Shop[];
  effectiveStatus: (deliveryId: number) => DeliveryEmailStatusValue;
  busyIds: Set<number>;
  isBulkSending: boolean;
  bulkProgress: { sent: number; total: number } | null;
  shopEmailFor: (delivery: ShopDelivery) => string;
  sendCountFor?: (deliveryId: number) => number;
  onSendOne: (delivery: ShopDelivery) => void;
  onDownloadPdf: (delivery: ShopDelivery) => void;
  emailCounts?: { sent: number; pending: number; sending: number; failed: number; total: number };
  whatsappEffectiveStatus?: (deliveryId: number) => DeliveryWhatsAppStatusValue;
  whatsappBusyIds?: Set<number>;
  whatsappIsBulkSending?: boolean;
  shopWhatsAppFor?: (delivery: ShopDelivery) => string;
  whatsappSendCountFor?: (deliveryId: number) => number;
  onSendOneWhatsApp?: (delivery: ShopDelivery) => void;
  whatsappCounts?: { sent: number; pending: number; sending: number; failed: number; total: number };
  failureReasonFor?: (deliveryId: number) => string | null;
  whatsappFailureReasonFor?: (deliveryId: number) => string | null;
};

function CommunicationIcon({
  channel,
  status,
  sending,
  sendCount = 0,
  onClick,
  disabled,
  onRetry,
  className = "",
}: {
  channel: "mail" | "whatsapp";
  status: DeliveryEmailStatusValue | DeliveryWhatsAppStatusValue;
  sending: boolean;
  sendCount?: number;
  onClick?: () => void;
  disabled?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const isFailed = status === "failed" && !sending;
  const isSent = status === "sent";
  const isSending = status === "sending" || sending;

  const isWhatsApp = channel === "whatsapp";
  const pendingIconColor = isWhatsApp ? "text-green-500" : "text-slate-400";
  const pendingBgColor = isWhatsApp ? "bg-green-50 hover:bg-green-100" : "bg-slate-100 hover:bg-slate-200";
  const pendingBorderColor = isWhatsApp ? "border-green-200" : "border-slate-200";

  let iconColor = pendingIconColor;
  let bgColor = pendingBgColor;
  let borderColor = pendingBorderColor;
  let tooltip = channel === "mail" ? t("ops.trip.send_email") : t("ops.trip.send_whatsapp");
  let ariaLabel = tooltip;

  if (isSending) {
    iconColor = "text-sky-600";
    bgColor = "bg-sky-50 hover:bg-sky-100";
    borderColor = "border-sky-200";
    tooltip = channel === "mail" ? t("ops.trip.sending_email") : t("ops.trip.sending_whatsapp");
    ariaLabel = tooltip;
  } else if (isSent) {
    iconColor = "text-emerald-600";
    bgColor = "bg-emerald-50 hover:bg-emerald-100";
    borderColor = "border-emerald-200";
    tooltip = channel === "mail"
      ? t("ops.trip.email_sent_times", { count: sendCount })
      : t("ops.trip.whatsapp_sent_times", { count: sendCount });
    ariaLabel = tooltip;
  } else if (isFailed) {
    iconColor = "text-red-600";
    bgColor = "bg-red-50 hover:bg-red-100";
    borderColor = "border-red-200";
    tooltip = channel === "mail" ? t("ops.trip.email_failed_retry") : t("ops.trip.whatsapp_failed_retry");
    ariaLabel = tooltip;
  }

  const Icon = channel === "mail" ? Mail : WhatsAppIcon;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isSending}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl border ${borderColor} ${bgColor} ${iconColor} transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
        title={tooltip}
        aria-label={ariaLabel}
      >
        {isSending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Icon size={16} />
        )}
        {isSent && sendCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none px-1 border-2 border-white">
            {sendCount > 9 ? "9+" : sendCount}
          </span>
        )}
      </button>
      {isFailed && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("ops.trip.retry")}
          aria-label={t("ops.trip.retry")}
        >
          <RotateCw size={12} />
        </button>
      )}
    </div>
  );
}

function MetricBlock({ icon, label, value, iconColor = "text-slate-500" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-2.5 bg-white rounded-xl border border-slate-100 min-w-0">
      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
        <span className={iconColor}>{icon}</span>
        {label}
      </span>
      <span className="text-sm font-bold text-slate-800 truncate w-full">{value}</span>
    </div>
  );
}

export function TripViewShopCards({
  trip,
  effectiveStatus,
  busyIds,
  isBulkSending,
  shopEmailFor,
  sendCountFor,
  onSendOne,
  onDownloadPdf,
  whatsappEffectiveStatus,
  whatsappBusyIds,
  whatsappIsBulkSending,
  shopWhatsAppFor,
  whatsappSendCountFor,
  onSendOneWhatsApp,
  failureReasonFor,
  whatsappFailureReasonFor,
}: TripViewShopCardsProps) {
  const { t } = useI18n();
  const deliveries = useMemo(
    () => (Array.isArray(trip.deliveries) ? trip.deliveries : []),
    [trip.deliveries]
  );
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filteredDeliveries = useMemo(() => {
    if (!query) return deliveries;
    return deliveries.filter((delivery) => {
      const shopNameMatch = (delivery.shopName || "").toLowerCase().includes(query);
      const birdTypeMatch = (delivery.birdType || "").toLowerCase().includes(query);
      // Searching a box number shows which shop carries that box.
      const boxIds = Array.isArray(delivery.selectedBoxIds)
        ? delivery.selectedBoxIds
        : delivery.boxNo != null && delivery.boxNo > 0
          ? [delivery.boxNo]
          : [];
      const boxNumberMatch = boxIds.some((id) => String(id).includes(query));
      return shopNameMatch || birdTypeMatch || boxNumberMatch;
    });
  }, [deliveries, query]);

  if (deliveries.length === 0) return null;

  const display = (value: string | number | null | undefined) => {
    if (value == null || value === "" || (typeof value === "number" && Number.isNaN(value)))
      return "—";
    return String(value);
  };

  return (
    <div className="space-y-3">
      {/* Deliveries Header with Search on same row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Package size={18} className="text-emerald-600 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 truncate">
            {t("ops.trip.step.deliveries")}
            <span className="normal-case font-semibold text-[11px] text-slate-400 ml-1">({deliveries.length})</span>
          </h3>
        </div>
        <div className="relative shrink-0 w-full md:w-[220px] max-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("ops.trip.search_shop_bird")}
            aria-label={t("ops.trip.search_shop_bird")}
            // Global search field with room for the trailing clear control.
            className={uiSearchInputWithClearClass}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("ops.trip.clear_search")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {filteredDeliveries.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
          {t("ops.trip.no_matching_shops")} “{search.trim()}”. {t("ops.trip.try_another_keyword")}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredDeliveries.map((delivery) => {
            const status = effectiveStatus(delivery.id);
            const sending = busyIds.has(delivery.id) || status === "sending";
            const sendCount = sendCountFor ? sendCountFor(delivery.id) : 0;

            const whatsappStatus = whatsappEffectiveStatus?.(delivery.id) ?? "pending";
            const whatsappSending = (whatsappBusyIds?.has(delivery.id) ?? false) || whatsappStatus === "sending";
            const whatsappSendCount = whatsappSendCountFor ? whatsappSendCountFor(delivery.id) : 0;

            const failedReason = failureReasonFor ? failureReasonFor(delivery.id) : null;
            const whatsappFailedReason = whatsappFailureReasonFor ? whatsappFailureReasonFor(delivery.id) : null;

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
                {/* Header: Shop name, email, delivery mode badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate" title={delivery.shopName}>
                      {delivery.shopName || t("ops.trip.not_entered")}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {shopEmailFor(delivery)}
                    </p>
                    {shopWhatsAppFor && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        WhatsApp: {shopWhatsAppFor(delivery)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                      isWeightMode
                        ? "bg-purple-50 text-purple-700 border-purple-200/60"
                        : "bg-amber-50 text-amber-700 border-amber-200/60"
                    }`}
                  >
                    {isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")}
                  </span>
                </div>

                {/* Delivery Statistics - 3 equal columns */}
                <div className="grid grid-cols-3 gap-2">
                  <MetricBlock
                    icon={<Box size={11} />}
                    label={t("common.boxes")}
                    value={display(selectedBoxes.length || delivery.boxNo)}
                  />
                  <MetricBlock
                    icon={<Bird size={11} />}
                    label={t("common.birds")}
                    value={display(delivery.birds)}
                    iconColor="text-sky-600"
                  />
                  <MetricBlock
                    icon={<Scale size={11} />}
                    label={t("common.weight")}
                    value={delivery.weight ? `${delivery.weight.toFixed(2)} ${t("common.kg")}` : "—"}
                    iconColor="text-emerald-600"
                  />
                </div>

                {/* Mortality - compact red warning row */}
                {(mortalityCount > 0 || mortKg > 0) && (
                  <div className="flex items-center justify-between px-2 py-1.5 bg-red-50/60 rounded-lg border border-red-100 text-[11px]">
                    <span className="text-red-600 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} className="text-rose-500" /> {t("ops.trip.mortality_birds")}
                    </span>
                    <span className="text-red-700 font-bold">
                      {mortalityCount} {t("common.birds").toLowerCase()} · {mortKg ? mortKg.toFixed(2) : "0.00"} {t("common.kg")}
                    </span>
                  </div>
                )}

                {/* Box Numbers - compact */}
                {selectedBoxes.length > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50/60 rounded-lg border border-slate-100 text-[11px] overflow-x-auto">
                    <span className="text-slate-400 font-semibold shrink-0 text-[10px] uppercase flex items-center gap-1">
                      <Package size={11} className="text-slate-500" /> {t("ops.trip.box_nos")}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedBoxes.map((id) => (
                        <span
                          key={id}
                          className="px-1.5 py-0.5 bg-white text-slate-700 font-bold rounded border border-slate-200/80 text-[10px] shrink-0"
                        >
                          {String(id).padStart(2, "0")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capture info + bird type */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Clock size={12} />
                    </span>
                    <span>{t("ops.trip.captured")} {delivery.autoCaptureTime || "—"}</span>
                  </div>
                  {delivery.birdType ? (
                    <span className="px-2 py-0.5 bg-sky-50 text-sky-700 font-semibold rounded-md text-[10px] border border-sky-100">
                      {delivery.birdType}
                    </span>
                  ) : null}
                </div>

                {/* Failure reasons */}
                {failedReason && (
                  <p className="text-[11px] text-red-600 px-1 truncate" title={failedReason}>{failedReason}</p>
                )}
                {whatsappFailedReason && (
                  <p className="text-[11px] text-red-600 px-1 truncate" title={whatsappFailedReason}>WhatsApp: {whatsappFailedReason}</p>
                )}

                {/* Communication Controls - Icon only */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
                  {/* PDF */}
                  <button
                    type="button"
                    onClick={() => onDownloadPdf(delivery)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors active:scale-95"
                    title={t("ops.trip.create_pdf_title")}
                    aria-label={t("ops.trip.create_pdf")}
                  >
                    <FileDown size={15} />
                  </button>

                  {/* Email */}
                  <CommunicationIcon
                    channel="mail"
                    status={status}
                    sending={sending}
                    sendCount={sendCount}
                    onClick={() => onSendOne(delivery)}
                    disabled={isBulkSending}
                    onRetry={() => onSendOne(delivery)}
                  />

                  {/* WhatsApp */}
                  {onSendOneWhatsApp && (
                    <CommunicationIcon
                      channel="whatsapp"
                      status={whatsappStatus}
                      sending={whatsappSending}
                      sendCount={whatsappSendCount}
                      onClick={() => onSendOneWhatsApp!(delivery)}
                      disabled={whatsappIsBulkSending}
                      onRetry={() => onSendOneWhatsApp!(delivery)}
                    />
                  )}

                  {/* Communication status icons */}
                  <div className="ml-auto flex items-center gap-1 text-[10px]" aria-label="Communication status">
                    {status === "sent" && <CheckCircle2 size={12} className="text-emerald-500" />}
                    {status === "failed" && <XCircle size={12} className="text-red-500" />}
                    {whatsappStatus === "sent" && <CheckCircle2 size={12} className="text-green-500" />}
                    {whatsappStatus === "failed" && <XCircle size={12} className="text-red-500" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default React.memo(TripViewShopCards);