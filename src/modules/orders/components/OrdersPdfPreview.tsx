/**
 * OrdersPdfPreview — CHECK the delivery report, then send or download it.
 *
 * Opens from the delivery report's PDF button once shops are delivered, styled
 * like the Shop Ledger PDF modal: a full-screen sheet with the details panel
 * on the left, the rendered document on the right and the actions in a footer,
 * so the operator can see exactly what the report says, correct a wrong entry,
 * and only then send it.
 *
 * The document is rendered with the same PdfBlobPreview the Shop Ledger uses
 * (pdf.js on a canvas) — Chrome blocks its built-in PDF plugin inside
 * nested/sandboxed iframes, which would leave a plain <iframe> blank in the
 * preview/Electron shells.
 *
 * One build, many uses: the PDF is generated once and the same blob is framed
 * here, downloaded, and handed to WhatsApp, so the file that was checked is
 * byte-for-byte the file that goes out.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  PencilLine,
  Send,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import PdfBlobPreview from "../../reports/components/PdfBlobPreview";
import {
  generateOrdersPdf,
  type OrdersPdfResult,
} from "../pdf/generateOrdersPdf";
import {
  formatDeliveredAtLabel,
  orderDateOfRef,
  orderRefsOnTrip,
  type ShopDeliveryBreakdown,
} from "../utils/ordersUtils";
import type { OrdersTrip } from "../types";
import type { OrdersT } from "../i18n/ordersI18n";
import type { OrdersWhatsAppResult } from "../services/ordersService";

interface OrdersPdfPreviewProps {
  /** The tracking trip (vehicle trip + progress + original order data). */
  orderTrip: OrdersTrip;
  supervisorMobile: string;
  breakdown: ShopDeliveryBreakdown[];
  ordersTranslate: OrdersT;
  onClose: () => void;
  onDownload: (result: OrdersPdfResult) => void;
  onWhatsApp: () => Promise<OrdersWhatsAppResult | null>;
  /** "Correct deliveries" — close the popup back to the editable shop table. */
  onCorrect: () => void;
  /** Save Progress from the popup — returns an error message, or null. */
  onSaveProgress: () => Promise<string | null>;
  /** Submit the trip — returns an error message, or null. */
  onSubmitTrip: () => Promise<string | null>;
}

const Fact = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="min-w-0 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5">
    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p
      className="truncate text-[11px] font-bold text-slate-800"
      title={String(value)}
    >
      {value}
    </p>
  </div>
);

const OrdersPdfPreview: React.FC<OrdersPdfPreviewProps> = ({
  orderTrip,
  supervisorMobile,
  breakdown,
  ordersTranslate,
  onClose,
  onDownload,
  onWhatsApp,
  onCorrect,
  onSaveProgress,
  onSubmitTrip,
}) => {
  const trip = orderTrip.trip;
  const progress = orderTrip.progress;
  const [result, setResult] = useState<OrdersPdfResult | null>(null);
  const [buildError, setBuildError] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendResult, setSendResult] = useState<OrdersWhatsAppResult | null>(
    null,
  );

  // ── Build the report once — the frame, the download and the WhatsApp send
  //    all use this very same blob.
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    generateOrdersPdf({
      trip,
      supervisorMobile,
      progress,
      breakdown,
      mode: "preview",
    })
      .then((built) => {
        if (!alive) {
          URL.revokeObjectURL(built.url);
          return;
        }
        url = built.url;
        setResult(built);
        setBuildError("");
      })
      .catch(() => {
        if (alive) setBuildError(ordersTranslate("orders.pdf_failed"));
      })
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [trip, supervisorMobile, progress, breakdown, ordersTranslate]);

  const building = result === null && !buildError;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalShops =
    progress?.totalShops ?? breakdown.filter((b) => b.ordered).length;
  const deliveredShops =
    progress?.deliveredShops ??
    breakdown.filter((b) => b.deliveredBoxes > 0).length;
  const ordered = breakdown.filter((b) => b.ordered);
  const delivered = breakdown.filter((b) => b.status === "delivered").length;
  const partial = breakdown.filter((b) => b.status === "part_delivered").length;
  const pending = breakdown.filter((b) => b.status === "not_delivered").length;
  const sum = (pick: (b: ShopDeliveryBreakdown) => number) =>
    breakdown.reduce((acc, b) => acc + pick(b), 0);
  const orderRefs = useMemo(() => orderRefsOnTrip(trip), [trip]);
  const orderDates = orderRefs.map(orderDateOfRef).filter(Boolean);

  const handleSend = async () => {
    setSending(true);
    setSendNote("");
    try {
      const outcome = await onWhatsApp();
      if (outcome) {
        setSendResult(outcome);
        setSendNote(
          outcome.failed === 0
            ? `${ordersTranslate("orders.pdf_sent_ok")}: ${outcome.message}`
            : `${ordersTranslate("orders.pdf_sent_partial")}: ${outcome.message}`,
        );
      } else {
        setSendNote("");
      }
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSubmitNote("");
    const error = await onSaveProgress();
    setSaved(!error);
    setSubmitNote(error ? error : ordersTranslate("orders.pdf_saved_ok"));
    setSaving(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitNote("");
    const error = await onSubmitTrip();
    setSubmitNote(error ? error : ordersTranslate("orders.pdf_submitted_ok"));
    setSubmitting(false);
  };

  const statusLabel = (status: ShopDeliveryBreakdown["status"]): string =>
    status === "delivered" || status === "delivered_with_diff"
      ? ordersTranslate("orders.status_delivered")
      : status === "part_delivered"
        ? ordersTranslate("orders.status_part_delivered")
        : status === "not_delivered"
          ? ordersTranslate("orders.status_pending")
          : ordersTranslate("orders.not_listed_deliveries");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ordersTranslate("orders.pdf_check_title")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3"
    >
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-lg bg-rose-100 p-1.5 text-rose-600">
              <FileText size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-slate-800">
                {ordersTranslate("orders.pdf_check_title")}
              </h3>
              <p className="truncate text-[11px] font-semibold text-slate-500">
                {[
                  trip.tripNo,
                  trip.vehicleNo,
                  trip.supervisorName,
                  trip.driverName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ordersTranslate("orders.close")}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* ── Details panel: the order, then every shop ── */}
          <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white/80">
            <div className="border-b border-slate-100 px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {ordersTranslate("orders.pdf_order_details")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Fact
                  label={ordersTranslate("orders.pdf_order_no")}
                  value={orderRefs.length > 0 ? orderRefs.join(", ") : "—"}
                />
                <Fact
                  label={ordersTranslate("orders.pdf_order_date")}
                  value={
                    orderDates.length > 0
                      ? orderDates.join(", ")
                      : trip.tripDate
                  }
                />
                <Fact
                  label={ordersTranslate("orders.col_total_shops")}
                  value={`${totalShops}`}
                />
                <Fact
                  label={ordersTranslate("orders.col_status")}
                  value={progress?.status ?? "—"}
                />
                <Fact
                  label={ordersTranslate("orders.total_boxes")}
                  value={`${sum((b) => b.orderedBoxes)} box`}
                />
                <Fact
                  label={ordersTranslate("orders.total_birds")}
                  value={sum((b) => b.orderedBirds).toLocaleString("en-IN")}
                />
              </div>
            </div>

            <div className="border-b border-slate-100 px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {ordersTranslate("orders.pdf_check_summary")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Fact
                  label={ordersTranslate("orders.delivered_shops")}
                  value={`${deliveredShops}/${totalShops}`}
                />
                <Fact
                  label={ordersTranslate("orders.status_part_delivered")}
                  value={partial}
                />
                <Fact
                  label={ordersTranslate("orders.status_pending")}
                  value={pending}
                />
                <Fact
                  label={ordersTranslate("orders.status_delivered")}
                  value={delivered}
                />
                <Fact
                  label={ordersTranslate("orders.delivered_boxes")}
                  value={`${sum((b) => b.deliveredBoxes)}/${sum((b) => b.orderedBoxes)}`}
                />
                <Fact
                  label={ordersTranslate("orders.pending_boxes")}
                  value={`${sum((b) => Math.max(0, b.orderedBoxes - b.deliveredBoxes))} box`}
                />
                <Fact
                  label={ordersTranslate("orders.delivered_weight")}
                  value={`${sum((b) => b.deliveredWeight).toFixed(2)} kg`}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {ordersTranslate("orders.pdf_shop_details")} ({ordered.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {ordered.map((shop) => (
                  <li
                    key={shop.shopId}
                    className="rounded-lg border border-slate-200/80 px-2 py-1.5"
                  >
                    <p
                      className="truncate text-[11px] font-bold text-slate-700"
                      title={shop.shopName}
                    >
                      {shop.serialNo}. {shop.shopName}
                    </p>
                    <p className="truncate text-[10px] font-semibold text-slate-400">
                      {shop.village || "—"}
                      {shop.mobile ? ` · ${shop.mobile}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold">
                      <span className="text-slate-600">
                        {shop.deliveredBoxes}/{shop.orderedBoxes} box ·{" "}
                        {shop.deliveredBirds.toLocaleString("en-IN")}/
                        {shop.orderedBirds.toLocaleString("en-IN")}
                      </span>
                      <span
                        className={
                          shop.status === "delivered"
                            ? "text-emerald-600"
                            : shop.status === "part_delivered"
                              ? "text-amber-600"
                              : "text-rose-600"
                        }
                      >
                        {statusLabel(shop.status)}
                      </span>
                    </p>
                    {shop.deliveredAt ? (
                      <p className="text-[10px] font-medium text-slate-400">
                        {formatDeliveredAtLabel(shop.deliveredAt, true)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* ── The document itself ── */}
          <div className="flex min-w-0 flex-1 flex-col bg-slate-200/60">
            {building ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                <Loader2 size={16} className="animate-spin text-rose-500" />
                {ordersTranslate("orders.pdf_building")}
              </div>
            ) : buildError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-semibold text-rose-600">
                {buildError}
              </div>
            ) : result ? (
              <PdfBlobPreview key={result.url} url={result.url} />
            ) : null}
          </div>
        </div>

        {/* ── Footer: the message, then the actions ── */}
        <div className="border-t border-slate-100 px-5 py-3">
          <div className="flex min-h-[1.125rem] items-center gap-1.5 text-[11px] font-semibold">
            {sending || submitting || saving ? (
              <>
                <Loader2 size={13} className="animate-spin text-rose-500" />
                <span className="text-slate-500">
                  {ordersTranslate("orders.sending")}
                </span>
              </>
            ) : submitNote ? (
              <span
                className={
                  submitNote === ordersTranslate("orders.pdf_saved_ok") ||
                  submitNote === ordersTranslate("orders.pdf_submitted_ok")
                    ? "text-emerald-600"
                    : "text-rose-600"
                }
              >
                {submitNote}
              </span>
            ) : sendNote ? (
              <span
                className={
                  sendResult && sendResult.failed > 0
                    ? "text-amber-600"
                    : "text-emerald-600"
                }
              >
                {sendNote}
              </span>
            ) : result ? (
              <span className="text-slate-400">
                {ordersTranslate("orders.pdf_pages", { pages: result.pages })} ·{" "}
                {result.fileName}
              </span>
            ) : null}
          </div>

          {/* The submit message: what was sent / submitted, shop by shop */}
          {sendResult ? (
            <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2">
              <ul className="space-y-0.5">
                {ordered.map((shop) => (
                  <li
                    key={shop.shopId}
                    className="flex items-center justify-between gap-2 text-[11px] font-medium"
                  >
                    <span
                      className="truncate text-slate-600"
                      title={shop.shopName}
                    >
                      {shop.shopName}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      {shop.deliveredBoxes}/{shop.orderedBoxes} box
                      {" · "}
                      <span
                        className={
                          shop.orderedBoxes > 0 &&
                          shop.deliveredBoxes >= shop.orderedBoxes
                            ? "font-bold text-emerald-700"
                            : shop.deliveredBoxes > 0
                              ? "font-bold text-amber-600"
                              : "font-bold text-rose-600"
                        }
                      >
                        {statusLabel(shop.status)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {ordersTranslate("orders.close")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saved || saving}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saved ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Save size={14} />
              )}
              {saved
                ? ordersTranslate("orders.pdf_saved_btn")
                : ordersTranslate("orders.pdf_save_progress")}
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !result}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={14} />
              {ordersTranslate("orders.pdf_send_whatsapp")}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || deliveredShops === 0}
              title={
                deliveredShops === 0
                  ? ordersTranslate("orders.pdf_submit_blocked")
                  : undefined
              }
              className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:from-slate-800 hover:to-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              {ordersTranslate("orders.pdf_submit")}
            </button>
            <button
              type="button"
              onClick={() => result && onDownload(result)}
              disabled={!result}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:from-rose-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              {ordersTranslate("orders.pdf_download")}
            </button>
            <button
              type="button"
              onClick={onCorrect}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <PencilLine size={14} />
              {ordersTranslate("orders.pdf_correct")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersPdfPreview;
