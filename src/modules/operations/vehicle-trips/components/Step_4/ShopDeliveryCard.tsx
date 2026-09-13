import { Box, Users, Scale, Clock, Pencil, FileText, Package, AlertCircle, Mail, Loader2 } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import type { ShopDeliveryWithExtra } from "./useShopDeliveryForm";
import { useI18n } from "../../../../../i18n";
import { cleanDeliveryShopName } from "../../utils/shopDisplayName";
import { WhatsAppIcon } from "../../../../../ui/WhatsAppIcon";
import { ActionTooltip } from "../../../../../ui/ActionTooltip";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { formatTripViewStamp } from "../../utils/tripViewLocalization";
import type { DeliveryEmailStatusValue } from "../../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../../services/deliveryWhatsAppService";

interface Props {
  row: ShopDeliveryWithExtra;
  readOnly: boolean;
  onEdit: (row: ShopDelivery) => void;
  onPDF: (row: ShopDeliveryWithExtra) => void;
  communicationEnabled?: boolean;
  emailStatus?: DeliveryEmailStatusValue;
  emailSending?: boolean;
  emailSendCount?: number;
  emailDisabled?: boolean;
  emailFailureReason?: string | null;
  onSendEmail?: (row: ShopDelivery) => void;
  whatsappStatus?: DeliveryWhatsAppStatusValue;
  whatsappSending?: boolean;
  whatsappSendCount?: number;
  whatsappDisabled?: boolean;
  whatsappFailureReason?: string | null;
  onSendWhatsApp?: (row: ShopDelivery) => void;
}

const BOX_CHIP_PALETTE = [
  "bg-slate-100 text-slate-700 border-slate-200",
  "bg-sky-50/70 text-sky-500 border-sky-100",
  "bg-indigo-50/70 text-indigo-500 border-indigo-100",
  "bg-teal-50/70 text-teal-500 border-teal-100",
  "bg-amber-50/70 text-amber-500 border-amber-100",
  "bg-rose-50/70 text-rose-500 border-rose-100",
];

function DeliveryCommunicationButton({
  channel,
  status = "pending",
  sending = false,
  sendCount = 0,
  disabled = false,
  title,
  onClick,
}: {
  channel: "mail" | "whatsapp";
  status?: DeliveryEmailStatusValue | DeliveryWhatsAppStatusValue;
  sending?: boolean;
  sendCount?: number;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  const isWhatsApp = channel === "whatsapp";
  const Icon = isWhatsApp ? WhatsAppIcon : Mail;
  const isSending = sending || status === "sending";
  const isFailed = status === "failed" && !isSending;
  const visibleCount = status === "sent" ? Math.max(1, Number(sendCount) || 0) : Math.max(0, Number(sendCount) || 0);

  const className = isFailed
    ? "bg-red-50/90 hover:bg-red-100 text-red-600 border-red-200"
    : isWhatsApp
      ? "bg-[#25D366]/10 hover:bg-[#25D366]/15 text-[#25D366] border-[#25D366]/25"
      : "bg-red-50/90 hover:bg-red-100 text-red-500 border-red-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSending}
      className={`group relative p-1.5 rounded-lg border transition-colors flex items-center justify-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className} ${
        isSending ? "motion-safe:animate-pulse" : ""
      }`}
      aria-label={title}
    >
      {isSending ? (
        <Loader2 size={13} className="animate-spin stroke-[2.5]" />
      ) : (
        <span className={`inline-flex ${isWhatsApp ? uiActionIconMotionClass.whatsapp : uiActionIconMotionClass.mail}`}>
          <Icon size={13} className="stroke-[2]" />
        </span>
      )}
      {visibleCount > 0 && (
        <span className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-white ${
          isWhatsApp ? "bg-[#25D366]" : "bg-red-500"
        }`}>
          {visibleCount > 9 ? "9+" : visibleCount}
        </span>
      )}
      <ActionTooltip label={title} />
    </button>
  );
}

export default function ShopDeliveryCard({
  row,
  readOnly,
  onEdit,
  onPDF,
  communicationEnabled = false,
  emailStatus = "pending",
  emailSending = false,
  emailSendCount = 0,
  emailDisabled = false,
  emailFailureReason,
  onSendEmail,
  whatsappStatus = "pending",
  whatsappSending = false,
  whatsappSendCount = 0,
  whatsappDisabled = false,
  whatsappFailureReason,
  onSendWhatsApp,
}: Props) {
  const { t, language } = useI18n();
  const isWeightMode = row.deliveryMode === "weight";
  const selectedBoxes = row.selectedBoxIds || [];
  const manyBoxes = selectedBoxes.length > 30;
  const mortalityCount = row.mortality ?? 0;
  const mortKg = row.mortKg ?? 0;
  const display = (value: string | number | null | undefined) => {
    if (value == null || value === "" || (typeof value === "number" && Number.isNaN(value))) return t("ops.trip.not_entered");
    return String(value);
  };
  const displayShopName = cleanDeliveryShopName(row.shopName) || t("ops.trip.not_entered");
  const capturedTime = row.autoCaptureTime ? formatTripViewStamp(row.autoCaptureTime, language) : "—";

  const isViewMode = readOnly;

  return (
    <div className={`relative rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all duration-200 flex flex-col ${isViewMode ? "rounded-2xl shadow-card border-slate-200" : ""}`}>
      <div className={`${isViewMode ? "p-5" : "p-3"} flex flex-col ${isViewMode ? "gap-3.5" : "gap-2.5"} flex-1`}>
        {/* Header — larger in trip view only */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`${isViewMode ? "h-11 w-11 rounded-xl" : "h-8 w-8 rounded-lg"} flex items-center justify-center shrink-0 border ${
                isWeightMode ? "bg-purple-50/70 text-purple-500 border-purple-100" : "bg-blue-50/70 text-blue-500 border-blue-100"
              }`}
              title={isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")}
            >
              {isWeightMode ? <Scale size={isViewMode ? 20 : 15} /> : <Box size={isViewMode ? 20 : 15} />}
            </div>
            <p className={`font-extrabold text-slate-900 truncate leading-tight tracking-tight ${isViewMode ? "text-[18px]" : "text-[13px]"} `} title={displayShopName}>
              {displayShopName}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {communicationEnabled && onSendEmail && (
              <DeliveryCommunicationButton
                channel="mail"
                status={emailStatus}
                sending={emailSending}
                sendCount={emailSendCount}
                disabled={emailDisabled}
                title={emailFailureReason || t("ops.trip.send_email")}
                onClick={() => onSendEmail(row)}
              />
            )}
            {communicationEnabled && onSendWhatsApp && (
              <DeliveryCommunicationButton
                channel="whatsapp"
                status={whatsappStatus}
                sending={whatsappSending}
                sendCount={whatsappSendCount}
                disabled={whatsappDisabled}
                title={whatsappFailureReason || t("ops.trip.send_whatsapp")}
                onClick={() => onSendWhatsApp(row)}
              />
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onEdit(row)}
                className="group relative p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50/70 text-slate-500 hover:text-blue-500 border border-slate-200/60 transition-colors flex items-center justify-center"
                aria-label={t("ops.trip.edit_shop_delivery")}
              >
                <span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={13} className="stroke-[2]" /></span>
                <ActionTooltip label={t("ops.trip.edit_shop_delivery")} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onPDF(row)}
              className="group relative p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50/70 text-slate-500 hover:text-rose-500 border border-slate-200/60 transition-colors flex items-center justify-center"
              aria-label={t("ops.trip.download_pdf")}
            >
              <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}><FileText size={13} className="stroke-[2]" /></span>
              <ActionTooltip label={t("ops.trip.download_pdf")} />
            </button>
          </div>
        </div>

        {/* KPI trio — increased in view mode */}
        <div className={`grid grid-cols-3 gap-2 bg-slate-50/70 rounded-xl border border-slate-100 ${isViewMode ? "p-2 gap-2" : "p-1.5 gap-1.5"}`}>
          <div className="flex flex-col items-center justify-center text-center p-2 bg-white rounded-lg border border-slate-200/50">
            <span className={`${isViewMode ? "text-[11px]" : "text-[9px]"} uppercase font-bold text-slate-400 flex items-center gap-1 mb-1`}>
              <Box size={isViewMode ? 12 : 10} className="text-slate-500 stroke-[2]" /> {t("common.boxes")}
            </span>
            <span className={`${isViewMode ? "text-[16px]" : "text-[13px]"} font-extrabold text-slate-900`}>{display(selectedBoxes.length || row.boxNo)}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-2 bg-white rounded-lg border border-slate-200/50">
            <span className={`${isViewMode ? "text-[11px]" : "text-[9px]"} uppercase font-bold text-slate-400 flex items-center gap-1 mb-1`}>
              <Users size={isViewMode ? 12 : 10} className="text-blue-500 stroke-[2]" /> {t("common.birds")}
            </span>
            <span className={`${isViewMode ? "text-[16px]" : "text-[13px]"} font-extrabold text-slate-900`}>{row.birds ? row.birds : t("ops.trip.not_entered")}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-2 bg-white rounded-lg border border-slate-200/50">
            <span className={`${isViewMode ? "text-[11px]" : "text-[9px]"} uppercase font-bold text-slate-400 flex items-center gap-1 mb-1`}>
              <Scale size={isViewMode ? 12 : 10} className="text-emerald-500 stroke-[2]" /> {t("common.weight")}
            </span>
            <span className={`${isViewMode ? "text-[16px]" : "text-[13px]"} font-extrabold text-slate-900`}>
              {row.weight ? `${Number(row.weight).toFixed(2)} ${t("common.kg")}` : t("ops.trip.not_entered")}
            </span>
          </div>
        </div>

        {(mortalityCount > 0 || mortKg > 0) && (
          <div className={`flex items-center justify-between px-3 py-2 bg-rose-50/60 rounded-lg border border-rose-100/70 ${isViewMode ? "text-[13px]" : "text-[10px]"}`}>
            <span className="text-rose-500 font-bold">{t("operations.mortality_count")}</span>
            <span className="text-rose-600 font-extrabold">
              {mortalityCount} {t("common.birds")} · {mortKg ? Number(mortKg).toFixed(2) : "0.00"} {t("common.kg")}
            </span>
          </div>
        )}

        {selectedBoxes.length > 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 bg-slate-100/70 rounded-lg border border-slate-200/40 overflow-x-auto no-scrollbar ${isViewMode ? "text-[12px]" : manyBoxes ? "text-[9px]" : "text-[10px]"}`}>
            <span className={`text-slate-500 font-bold flex items-center gap-1 shrink-0 uppercase ${isViewMode ? "text-[11px]" : "text-[9px]"}`}>
              <Package size={isViewMode ? 13 : 11} /> {t("ops.trip.box_nos")}:
            </span>
            <div className={`flex items-center flex-wrap ${manyBoxes ? "gap-1" : "gap-1.5"}`}>
              {selectedBoxes.map((id, idx) => (
                <span key={id} className={`rounded border font-bold shrink-0 ${isViewMode ? "px-2 py-1 text-[12px]" : manyBoxes ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]"} ${BOX_CHIP_PALETTE[idx % BOX_CHIP_PALETTE.length]}`}>
                  {String(id).padStart(2, "0")}
                </span>
              ))}
            </div>
          </div>
        )}

        {row.remarks ? (
          <p className={`${isViewMode ? "text-[13px]" : "text-[10px]"} text-slate-600 px-1 truncate`} title={row.remarks}>
            <span className={`font-bold text-slate-400 uppercase ${isViewMode ? "text-[11px]" : "text-[9px]"}`}>{t("common.remarks")}: </span>
            {row.remarks}
          </p>
        ) : null}

        <div className={`flex items-center justify-between gap-2 pt-2 mt-auto font-medium border-t border-slate-100 ${isViewMode ? "text-[12px]" : "text-[10px]"}`}>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {mortalityCount > 0 && (
              <span title={t("operations.mortality_count")} className={`px-2 py-1 rounded bg-rose-50/70 text-rose-500 border border-rose-100 shrink-0 flex items-center gap-1 font-bold ${isViewMode ? "text-[12px]" : "text-[10px]"}`}>
                <AlertCircle size={isViewMode ? 13 : 11} className="text-rose-300 stroke-[2.5]" />
                <span>{mortalityCount}</span>
              </span>
            )}
            {row.birdType ? (
              <span className={`px-2 py-1 rounded bg-blue-50/70 text-blue-600 font-bold border border-blue-100 shrink-0 ${isViewMode ? "text-[12px]" : "text-[10px]"}`}>
                {row.birdType}
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 text-slate-600" title={capturedTime}>
            <span className={`${isViewMode ? "h-6 w-6" : "h-4 w-4"} rounded bg-indigo-50/70 text-indigo-500 flex items-center justify-center shrink-0`}>
              <Clock size={isViewMode ? 13 : 11} className="stroke-[2]" />
            </span>
            <span className={`whitespace-nowrap font-bold leading-none tabular-nums ${isViewMode ? "text-[12px]" : "text-[10px]"}`}>{capturedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
