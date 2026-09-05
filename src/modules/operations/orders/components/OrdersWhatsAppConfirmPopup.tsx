// src/modules/operations/orders/components/OrdersWhatsAppConfirmPopup.tsx
// Order Assignment — WhatsApp CHECK POPUP.
//
// Clicking WhatsApp on the assignment panel no longer fires blindly: this
// sheet shows EXACTLY what goes out — the WhatsApp message text (shops in
// delivery order with their assigned boxes), the branded Shop Assignment
// Sheet PDF (hen logo, trip facts, per-shop shares), the recipient number —
// and only "Confirm & Send" triggers the persistence + send. One build,
// many uses: the same PDF blob is framed, downloaded and handed to the send.
//
// The operator can RE-ORDER the shops here (same ↑↓ pattern as the
// assignment tab); the list, the WhatsApp message and the PDF all track
// that sequence, and Confirm persists it so the send matches the preview.

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Loader2,
  Send,
  X,
} from "lucide-react";
import PdfBlobPreview from "../../../reports/components/PdfBlobPreview";
import type { Trip } from "../../../../shared/trip";
import type { OrdersT } from "../i18n/ordersI18n";
import {
  buildAssignmentWhatsAppMessage,
  formatCount,
  type AssignmentSheetRow,
} from "../ordersUtils";
import {
  generateAssignmentSheetPdf,
  type AssignmentSheetPdfResult,
} from "../pdf/generateAssignmentSheetPdf";
import type { OrdersWhatsAppResult } from "../ordersService";
import { WhatsAppIcon } from "./OrdersCommon";

// A small label/value chip for the facts grid (module level — never created
// during render).
const Fact: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="min-w-0 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5">
    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <p className="truncate text-[11px] font-bold text-slate-800" title={String(value)}>
      {value}
    </p>
  </div>
);

type Props = {
  /** The vehicle trip the assignment is written to. */
  trip: Trip;
  supervisorMobile: string;
  orderTripNo: string;
  orderDate: string;
  /** Shops in DELIVERY order (vehicle's sequence), assigned share per shop. */
  rows: AssignmentSheetRow[];
  capacity: number;
  alreadyAssignedOther: number;
  t: OrdersT;
  /** Send + persistence in flight (drives the button spinners). */
  sending: boolean;
  /** Live per-shop send progress ("" = idle). */
  sendProgress: string | null;
  onClose: () => void;
  /** Persist + send; resolves with the outcome (null = aborted/failed).
   *  When the operator re-ordered shops, receives the new sequence. */
  onConfirmSend: (orderedShopIds?: number[]) => Promise<OrdersWhatsAppResult | null>;
};

const OrdersWhatsAppConfirmPopup: React.FC<Props> = ({
  trip,
  supervisorMobile,
  orderTripNo,
  orderDate,
  rows,
  capacity,
  alreadyAssignedOther,
  t,
  sending,
  sendProgress,
  onClose,
  onConfirmSend,
}) => {
  const [result, setResult] = useState<AssignmentSheetPdfResult | null>(null);
  const [buildError, setBuildError] = useState("");
  const [sentResult, setSentResult] = useState<OrdersWhatsAppResult | null>(null);
  // Review & Submit only — independent of the app language. English by default.
  const [sheetLang, setSheetLang] = useState<"en" | "te">("en");

  // ── The delivery sequence lives HERE so ↑↓ works inside the popup.
  //    Stored as a PERMUTATION of the parent rows (null = parent order) —
  //    derived state avoids any resync effect: a parent refresh after the
  //    confirm-save hands back rows that are already in this permutation's
  //    order, and switching vehicles remounts the popup (key = trip id).
  const [perm, setPerm] = useState<number[] | null>(null);
  const orderedRows = useMemo(
    () =>
      perm
        ? perm
            .map((i) => rows[i])
            .filter((r): r is AssignmentSheetRow => Boolean(r))
        : rows,
    [rows, perm]
  );

  // True when the visible order differs from what the parent persisted.
  const orderChanged = perm !== null && perm.some((v, i) => v !== i);

  const moveRow = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (sending || j < 0 || j >= orderedRows.length) return;
    setPerm((prev) => {
      const next = prev ? [...prev] : rows.map((_, i) => i);
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  // Numbered EVERYWHERE from ONE source — the list, the message and the PDF
  // can never disagree about the sequence.
  const numberedRows = useMemo(
    () => orderedRows.map((r, i) => ({ ...r, serialNo: i + 1 })),
    [orderedRows]
  );

  // The message text — exactly what the send will carry.
  const message = useMemo(
    () =>
      buildAssignmentWhatsAppMessage({
        tripNo: trip.tripNo,
        tripDate: trip.tripDate,
        vehicleNo: trip.vehicleNo,
        supervisorName: trip.supervisorName,
        supervisorMobile,
        driverName: trip.driverName,
        orderTripNo,
        orderDate,
        rows: numberedRows,
        language: sheetLang,
      }),
    [trip, supervisorMobile, orderTripNo, orderDate, numberedRows, sheetLang]
  );

  // ── Sheets: built once per sequence — the frame, the download and the
  //    send summary all use the very same blob. Re-ordering re-builds it
  //    (the header art is cached inside the generator, so this is fast);
  //    the previous frame stays visible until the new one is ready.
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    setResult(null);
    setBuildError("");
    generateAssignmentSheetPdf({
      trip,
      supervisorMobile,
      orderTripNo,
      orderDate,
      rows: numberedRows,
      capacity,
      alreadyAssignedOther,
      language: sheetLang,
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
      .catch((err) => {
        console.error("Assignment sheet PDF failed", err);
        if (alive) setBuildError(t("orders.pdf_failed"));
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // The sheet depends on WHO/WHAT/ORDER, not on the blob bookkeeping.
  }, [trip, supervisorMobile, orderTripNo, orderDate, numberedRows, capacity, alreadyAssignedOther, sheetLang, t]);

  // "Building" = no result yet and no failure (derived, no extra state).
  const building = result === null && !buildError;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const totalBoxes = orderedRows.reduce((s, r) => s + r.boxes, 0);

  const handleSend = async () => {
    // Persist the new sequence too when the operator re-ordered here, so the
    // actual WhatsApp send matches the previewed one.
    const outcome = await onConfirmSend(
      orderChanged ? orderedRows.map((r) => r.shopId) : undefined
    );
    setSentResult(outcome);
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.fileName;
    a.click();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("orders.wa_check_title")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3"
    >
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600">
              <WhatsAppIcon size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-slate-800">
                {t("orders.wa_check_title")}
              </h3>
              <p className="truncate text-[11px] font-semibold text-slate-500">
                {[trip.tripNo, trip.vehicleNo, trip.supervisorName, trip.driverName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              role="group"
              aria-label="Message and PDF language"
              className="relative flex rounded-full bg-slate-100 p-0.5 text-[11px] font-extrabold"
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-emerald-600 shadow-sm transition-transform duration-200 ${
                  sheetLang === "te" ? "translate-x-[calc(100%+2px)]" : "translate-x-0.5"
                }`}
              />
              <button
                type="button"
                onClick={() => setSheetLang("en")}
                disabled={sending}
                className={`relative z-10 min-w-[4.5rem] rounded-full px-3 py-1.5 transition ${
                  sheetLang === "en" ? "text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSheetLang("te")}
                disabled={sending}
                className={`relative z-10 min-w-[4.5rem] rounded-full px-3 py-1.5 transition ${
                  sheetLang === "te" ? "text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                తెలుగు
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              aria-label={t("orders.close")}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* ── Left: the shops (re-orderable) → the message → the facts ── */}
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white/80">
            {/* 1) SHOPS TO DELIVER — in delivery sequence, re-orderable */}
            <div className="border-b border-slate-100 px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {t("orders.shops_to_deliver")} ({orderedRows.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {numberedRows.map((row, i) => (
                  <li
                    key={row.shopId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-slate-700" title={row.shopName}>
                        {row.serialNo}. {row.shopName}
                      </p>
                      <p className="truncate text-[10px] font-semibold text-slate-400">
                        {row.village || "—"}
                        {row.mobile ? ` · ${row.mobile}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-emerald-700">
                          {formatCount(row.boxes)} box
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {row.birds > 0 ? `${formatCount(row.birds)} birds` : "—"}
                        </p>
                      </div>
                      {/* Re-order mirrors the assignment tab's ↑↓ controls */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveRow(i, -1)}
                          disabled={sending || i === 0}
                          aria-label="Move up"
                          className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(i, 1)}
                          disabled={sending || i === numberedRows.length - 1}
                          aria-label="Move down"
                          className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2) The message text — what WhatsApp will carry */}
            <div className="border-b border-slate-100 px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {t("orders.wa_message_preview")}
              </p>
              <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-200 bg-[#e7f8ec] px-2.5 py-2 font-sans text-[11px] font-medium leading-relaxed text-slate-700">
                {message}
              </pre>
            </div>

            {/* 3) ASSIGNMENT DETAILS — under the WhatsApp message */}
            <div className="px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {t("orders.assignment_details")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Fact label={t("orders.pdf_order_date")} value={orderDate || trip.tripDate} />
                <Fact label={t("orders.col_total_shops")} value={orderedRows.length} />
                <Fact label={t("orders.col_assigned_boxes")} value={formatCount(totalBoxes)} />
                <Fact
                  label={t("orders.wa_send_to")}
                  value={supervisorMobile || "—"}
                />
                <Fact
                  label={t("orders.available_boxes")}
                  value={
                    capacity > 0
                      ? `${formatCount(Math.max(0, capacity - alreadyAssignedOther - totalBoxes))} / ${formatCount(capacity)}`
                      : "—"
                  }
                />
              </div>
            </div>
          </aside>

          {/* ── Right: the branded sheet ── */}
          <div className="flex min-w-0 flex-1 flex-col bg-slate-200/60">
            {building ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                <Loader2 size={16} className="animate-spin text-emerald-500" />
                {t("orders.pdf_building")}
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

        {/* ── Footer: note + per-shop outcome + actions ── */}
        <div className="border-t border-slate-100 px-5 py-3">
          <div className="flex min-h-[18px] items-center gap-1.5 text-[11px] font-semibold">
            {sending ? (
              <>
                <Loader2 size={13} className="animate-spin text-emerald-600" />
                <span className="text-slate-500">
                  {t("orders.sending")}
                  {sendProgress ? ` · ${sendProgress}` : ""}
                </span>
              </>
            ) : sentResult ? (
              <span className={sentResult.failed > 0 ? "text-amber-600" : "text-emerald-600"}>
                {sentResult.failed === 0
                  ? t("orders.whatsapp_done", { sent: sentResult.sent, total: sentResult.sent })
                  : t("orders.whatsapp_partial", { sent: sentResult.sent, failed: sentResult.failed })}
              </span>
            ) : (
              <span className="text-slate-400">
                {t("orders.wa_send_note")}
                {result ? ` · ${t("orders.pdf_pages", { pages: result.pages })} · ${result.fileName}` : ""}
              </span>
            )}
          </div>

          {sentResult && sentResult.sent > 0 ? (
            <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2">
              <ul className="space-y-0.5">
                {numberedRows.map((row) => (
                  <li
                    key={row.shopId}
                    className="flex items-center justify-between gap-2 text-[11px] font-medium"
                  >
                    <span className="truncate text-slate-600" title={row.shopName}>
                      {row.serialNo}. {row.shopName}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      {formatCount(row.boxes)} box ·{" "}
                      <span className="font-bold text-emerald-700">{t("orders.col_assigned")}</span>
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
              disabled={sending}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {t("orders.close")}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!result || sending}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              {t("orders.pdf_download")}
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || orderedRows.length === 0 || sentResult?.failed === 0}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : sentResult?.failed === 0 ? (
                <CheckCircle2 size={14} />
              ) : (
                <Send size={14} />
              )}
              {sentResult?.failed === 0 ? t("orders.whatsapp") + " ✓" : t("orders.wa_confirm_send")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersWhatsAppConfirmPopup;
