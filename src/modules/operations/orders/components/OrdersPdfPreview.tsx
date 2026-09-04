// src/modules/operations/orders/components/OrdersPdfPreview.tsx
// "CHECK PDF" popup — opened from the Delivery detail once shops are delivered.
//
// One neat sheet to verify the report BEFORE it goes out:
//   · a summary of exactly what the document says (shops delivered, part
//     delivered, pending, boxes / birds / weight) so a wrong entry is spotted
//     here, not on the supervisor's phone;
//   · the generated PDF itself, in-frame;
//   · Download PDF · Send on WhatsApp · Correct deliveries (back to the
//     editable shop table) · Close;
//   · after sending, the submit message with the per-shop details and the
//     sent / failed counts.
//
// The document is built once (generateOrdersPdf mode:"preview") and reused for
// the download, so what you checked is byte-for-byte what you send.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  PencilLine,
  X,
} from "lucide-react";
import {
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { generateOrdersPdf, type OrdersPdfResult } from "../pdf/generateOrdersPdf";
import { formatCount, type ShopDeliveryBreakdown } from "../ordersUtils";
import type { OrdersWhatsAppResult } from "../ordersService";
import type { OrdersTrip } from "../types";
import { useOrdersI18n } from "../i18n/ordersI18n";
import { WhatsAppIcon } from "./OrdersCommon";

type Props = {
  orderTrip: OrdersTrip;
  breakdown: ShopDeliveryBreakdown[];
  supervisorMobile: string;
  /** Sends the report (existing per-shop WhatsApp mechanism). */
  onWhatsApp: () => Promise<OrdersWhatsAppResult | null>;
  /** Back to the editable shop table — correct an entry, then re-check. */
  onCorrect: () => void;
  onClose: () => void;
};

function Fact({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "amber" | "rose" }) {
  const tones: Record<string, string> = {
    slate: "text-slate-800",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-bold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function OrdersPdfPreview({
  orderTrip,
  breakdown,
  supervisorMobile,
  onWhatsApp,
  onCorrect,
  onClose,
}: Props) {
  const { to, language } = useOrdersI18n();
  const { trip, progress } = orderTrip;
  const [doc, setDoc] = useState<OrdersPdfResult | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<OrdersWhatsAppResult | null>(null);

  // Build once; the same blob feeds the preview frame and the download.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const built = await generateOrdersPdf({
          trip,
          supervisorMobile,
          progress,
          breakdown,
          language,
          mode: "preview",
        });
        if (!live) {
          URL.revokeObjectURL(built.url);
          return;
        }
        setDoc(built);
      } catch (e) {
        if (live) setBuildError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
    };
    // Rebuild only when the report content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, breakdown.length, language]);

  // Never leak the object URL.
  useEffect(
    () => () => {
      if (doc) URL.revokeObjectURL(doc.url);
    },
    [doc]
  );

  // ── What the document says (the check-before-send summary) ──────────────
  const sums = useMemo(() => {
    const sum = (pick: (b: ShopDeliveryBreakdown) => number) =>
      breakdown.reduce((acc, b) => acc + pick(b), 0);
    const is = (status: string) => breakdown.filter((b) => b.status === status).length;
    return {
      shops: breakdown.length,
      delivered: is("delivered") + is("delivered_with_diff"),
      part: is("part_delivered"),
      pending: is("not_delivered"),
      notListed: is("not_listed"),
      orderedBoxes: sum((b) => b.orderedBoxes),
      deliveredBoxes: sum((b) => b.deliveredBoxes),
      deliveredBirds: sum((b) => b.deliveredBirds),
      deliveredWeight: sum((b) => b.deliveredWeight),
    };
  }, [breakdown]);

  const handleDownload = useCallback(() => {
    if (!doc) return;
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [doc]);

  const handleSend = useCallback(async () => {
    if (sending) return;
    setSending(true);
    try {
      setSent(await onWhatsApp());
    } finally {
      setSending(false);
    }
  }, [sending, onWhatsApp]);

  // Escape closes the popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sendNote = sent
    ? sent.sent > 0 && sent.failed === 0
      ? to("orders.pdf_sent_ok", { sent: sent.sent })
      : sent.sent > 0
        ? to("orders.pdf_sent_partial", { sent: sent.sent, failed: sent.failed })
        : sent.message?.includes("not configured")
          ? to("orders.whatsapp_not_configured")
          : to("orders.whatsapp_failed", { message: sent.message ?? "—" })
    : "";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" role="dialog" aria-modal="true">
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
            <FileText size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-800">
              {to("orders.pdf_check_title")} — {trip.tripNo}
            </h3>
            <p className="truncate text-[11px] font-semibold text-slate-400">
              {trip.vehicleNo || "—"} · {trip.supervisorName || "—"} · {trip.driverName || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={to("orders.close")}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>

        {/* Summary — what the document says */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2.5">
          <Fact
            label={to("orders.col_total_shops")}
            value={`${sums.delivered + sums.part}/${sums.shops}`}
          />
          <Fact label={to("orders.status_delivered")} value={String(sums.delivered)} tone="emerald" />
          <Fact label={to("orders.status_part_delivered")} value={String(sums.part)} tone="amber" />
          <Fact label={to("orders.status_not_delivered")} value={String(sums.pending)} tone={sums.pending ? "rose" : "slate"} />
          <Fact label={to("orders.delivered_boxes")} value={formatCount(sums.deliveredBoxes)} />
          <Fact label={to("orders.ordered_boxes")} value={formatCount(sums.orderedBoxes)} />
          <Fact label={to("orders.delivered_birds")} value={formatCount(sums.deliveredBirds)} />
          <Fact label={to("orders.delivered_weight")} value={`${sums.deliveredWeight.toFixed(2)} kg`} />
          {doc && (
            <span className="ml-auto text-[11px] font-semibold text-slate-400">
              {to("orders.pdf_pages", { pages: doc.pages })} · {doc.fileName}
            </span>
          )}
        </div>

        {/* The document */}
        <div className="min-h-0 flex-1 bg-slate-100">
          {buildError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <AlertTriangle size={22} className="text-rose-500" />
              <p className="text-sm font-bold text-slate-700">{to("orders.pdf_failed")}</p>
              <p className="max-w-md text-xs text-slate-500">{buildError}</p>
            </div>
          ) : doc ? (
            <iframe
              title={`${to("orders.pdf_check_title")} — ${trip.tripNo}`}
              src={doc.url}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              {to("orders.pdf_building")}
            </div>
          )}
        </div>

        {/* Submit message — shown after sending */}
        {sent && (
          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-2.5">
            <div className="flex items-center gap-2">
              {sent.sent > 0 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={14} className="text-amber-600" />
              )}
              <span className="text-[11px] font-bold text-slate-700">{sendNote}</span>
            </div>
            {/* The details that went out, shop by shop. */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {breakdown.map((b) => (
                <span
                  key={b.shopId}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                >
                  {b.shopName}
                  <span className="text-slate-400">
                    {formatCount(b.deliveredBoxes)}/{formatCount(b.orderedBoxes)} ·{" "}
                    {b.status === "not_delivered"
                      ? to("orders.status_not_delivered")
                      : b.status === "part_delivered"
                        ? to("orders.status_part_delivered")
                        : to("orders.status_delivered")}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5 border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!doc}
            className={`${opsSecondaryButtonClass} border-slate-300 text-slate-700 hover:bg-slate-50`}
          >
            <Download size={14} />
            {to("orders.pdf_download")}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !doc}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <WhatsAppIcon size={14} />}
            {sending ? to("orders.sending") : to("orders.pdf_send_whatsapp")}
          </button>
          <button
            type="button"
            onClick={onCorrect}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <PencilLine size={14} />
            {to("orders.pdf_correct")}
          </button>
          <button type="button" onClick={onClose} className={`${opsPrimaryButtonClass} ml-auto`}>
            {to("orders.close")}
          </button>
        </div>
      </div>
    </div>
  );
}


export default OrdersPdfPreview;
