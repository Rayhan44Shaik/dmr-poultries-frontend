import { useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, FileText, Loader2, Mail, Package, Pencil, Scale } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import type { ShopDeliveryWithExtra } from "./useShopDeliveryForm";
import { useI18n } from "../../../../../i18n";
import { cleanDeliveryShopName } from "../../utils/shopDisplayName";
import { formatTripViewStamp, localizeTripViewText } from "../../utils/tripViewLocalization";
import { WhatsAppIcon } from "../../../../../ui/WhatsAppIcon";
import type { DeliveryEmailStatusValue } from "../../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../../services/deliveryWhatsAppService";

interface Props { row: ShopDeliveryWithExtra; readOnly: boolean; onEdit: (row: ShopDelivery) => void; onPDF: (row: ShopDeliveryWithExtra) => void; communicationEnabled?: boolean; emailStatus?: DeliveryEmailStatusValue; emailSending?: boolean; emailSendCount?: number; emailDisabled?: boolean; emailFailureReason?: string | null; onSendEmail?: (row: ShopDelivery) => void; whatsappStatus?: DeliveryWhatsAppStatusValue; whatsappSending?: boolean; whatsappSendCount?: number; whatsappDisabled?: boolean; whatsappFailureReason?: string | null; onSendWhatsApp?: (row: ShopDelivery) => void; }

function CommunicationButton({ kind, busy, count, disabled, onClick, label }: { kind: "mail" | "whatsapp"; busy: boolean; count: number; disabled: boolean; onClick: () => void; label: string }) {
  const Icon = kind === "mail" ? Mail : WhatsAppIcon;
  return <button type="button" disabled={disabled || busy} onClick={onClick} aria-label={label} className={`relative rounded-lg border p-1.5 disabled:opacity-50 ${kind === "mail" ? "border-red-100 text-red-500 hover:bg-red-50" : "border-emerald-100 text-emerald-500 hover:bg-emerald-50"}`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}{count > 0 ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 px-1 text-[8px] text-white">{count > 9 ? "9+" : count}</span> : null}</button>;
}

function BoxDetailsTooltip({ boxes, row, emptyLabel }: { boxes: number[]; row: ShopDeliveryWithExtra; emptyLabel: string }) {
  const boxColors = [
    "border-blue-200 bg-blue-50 text-blue-700",
    "border-emerald-200 bg-emerald-50 text-emerald-700",
    "border-violet-200 bg-violet-50 text-violet-700",
    "border-amber-200 bg-amber-50 text-amber-700",
    "border-rose-200 bg-rose-50 text-rose-700",
    "border-cyan-200 bg-cyan-50 text-cyan-700",
  ];
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const open = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const estimatedHeight = 92;
    const top = rect.bottom + estimatedHeight + 12 <= window.innerHeight ? rect.bottom + 8 : rect.top - estimatedHeight - 8;
    setPosition({ left: Math.max(12, Math.min(window.innerWidth - 332, rect.left + rect.width / 2 - 160)), top: Math.max(8, top) });
  };
  return <span className="inline-flex items-center" onMouseLeave={() => setPosition(null)}>
    <button type="button" aria-label="Show box numbers" onMouseEnter={(event) => open(event.currentTarget)} onFocus={(event) => open(event.currentTarget)} onBlur={() => setPosition(null)} className="rounded-md border-b border-dotted border-slate-400 px-1 py-0.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300">{boxes.length || row.boxNo || 0}</button>
    {position && createPortal(
      <div role="tooltip" style={{ left: position.left, top: position.top }} className="pointer-events-none fixed z-[9999] w-[320px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800"><Package size={14} className="text-blue-500" />Box numbers</div>
        {boxes.length ? <div className="flex flex-wrap gap-1.5">{boxes.map((box) => <span key={box} className={`inline-flex min-w-8 items-center justify-center rounded-lg border px-2 py-1 text-xs font-bold ${boxColors[Math.abs(Number(box)) % boxColors.length]}`}>{box}</span>)}</div> : <div className="text-xs font-semibold text-slate-500">{emptyLabel}</div>}
      </div>, document.body)}
  </span>;
}

export default function ShopDeliveryCard({ row, readOnly, onEdit, onPDF, communicationEnabled = false, emailStatus = "pending", emailSending = false, emailSendCount = 0, emailDisabled = false, onSendEmail, whatsappStatus = "pending", whatsappSending = false, whatsappSendCount = 0, whatsappDisabled = false, onSendWhatsApp }: Props) {
  const { t, language } = useI18n();
  const isWeightMode = row.deliveryMode === "weight";
  const boxes = row.selectedBoxIds ?? [];
  const weightLoss = isWeightMode ? Math.max(0, Number(row.farmWeight || 0) - Number(row.weight || 0)) : 0;
  const shopName = localizeTripViewText(cleanDeliveryShopName(row.shopName), language, { cleanShopCode: true }) || "—";
  const capturedTime = row.autoCaptureTime ? formatTripViewStamp(row.autoCaptureTime, language) : "—";
  return <div className="grid min-w-[1100px] grid-cols-[3rem_3.5rem_minmax(12rem,1.5fr)_repeat(5,minmax(5.5rem,1fr))_minmax(11rem,1.3fr)_8rem] items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 text-xs last:border-b-0 hover:bg-slate-50/70">
    <div className="text-center font-bold text-slate-500">{row.serialNo ?? "—"}</div>
    <div className="flex justify-center"><span title={isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")} aria-label={isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${isWeightMode ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>{isWeightMode ? <Scale size={16} /> : <Package size={16} />}</span></div>
    <div className="min-w-0"><div className="truncate font-bold text-slate-800">{shopName}</div>{row.subShopName || row.remarks ? <div className="truncate text-[10px] text-slate-500">{[row.subShopName, row.remarks].filter(Boolean).join(", ")}</div> : null}</div>
    <div className="flex justify-center"><BoxDetailsTooltip boxes={boxes} row={row} emptyLabel={t("ops.trip.not_entered")} /></div>
    <div className="text-center font-bold text-blue-600">{row.birds || 0}</div><div className="text-center font-bold text-slate-800">{Number(row.weight || 0).toFixed(2)}</div><div className="text-center font-bold text-amber-600">{isWeightMode ? weightLoss.toFixed(2) : "—"}</div>
    <div className="text-center font-bold text-rose-600">{Number(row.mortality || 0).toLocaleString()}{Number(row.mortKg || 0) > 0 ? <span className="block text-[10px] font-medium text-rose-400">{Number(row.mortKg).toFixed(2)} kg</span> : null}</div>
    <div className="flex justify-center"><span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-50 px-2 py-1.5 text-[10px] font-semibold text-indigo-700"><Clock3 size={12} />{capturedTime}</span></div>
    <div className="flex justify-end gap-1">{communicationEnabled && onSendEmail ? <CommunicationButton kind="mail" busy={emailSending || emailStatus === "sending"} count={emailSendCount} disabled={emailDisabled} onClick={() => onSendEmail(row)} label={t("ops.trip.send_email")} /> : null}{communicationEnabled && onSendWhatsApp ? <CommunicationButton kind="whatsapp" busy={whatsappSending || whatsappStatus === "sending"} count={whatsappSendCount} disabled={whatsappDisabled} onClick={() => onSendWhatsApp(row)} label={t("ops.trip.send_whatsapp")} /> : null}{!readOnly ? <button type="button" onClick={() => onEdit(row)} className="rounded-lg border border-slate-200 p-1.5 text-blue-500 hover:bg-blue-50" aria-label={t("ops.trip.edit_shop_delivery")}><Pencil size={13} /></button> : null}<button type="button" onClick={() => onPDF(row)} className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50" aria-label={t("ops.trip.download_pdf")}><FileText size={13} /></button></div>
  </div>;
}
