// src/modules/orders/components/OrdersWhatsAppConfirmPopup.tsx
// Order Assignment — WhatsApp CHECK POPUP.
//
// Clicking WhatsApp on the assignment panel no longer fires blindly: this
// sheet shows EXACTLY what goes out — the WhatsApp message text (shops in
// delivery order with their assigned boxes), the branded Shop Assignment
// Sheet PDF (trip facts, per-shop shares), the recipient number —
// and only "Confirm & Send" triggers the persistence + send. One build,
// many uses: the same PDF blob is framed, downloaded and handed to the send.
//
// The operator can RE-ORDER the shops here (typed 1, 2, 3 … positions, the
// same control as the assignment tab); the list, the WhatsApp message and the PDF all track
// that sequence, and Confirm persists it so the send matches the preview.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Send,
  X,
} from "lucide-react";
import AppShellModal from "../../../ui/AppShellModal";
import { ViewLanguageToggle } from "../../../ui/ViewLanguageToggle";
import { uiActionIconMotionClass } from "../../../shared/ui/uiTokens";
import { formatVehicleNumber } from "../../../utils/format";
import { SequenceArrows, WhatsAppIcon } from "./OrdersCommon";
import {
  ORDERS_NO_SPINNER,
  onOrdersNumberWheel,
} from "../utils/ordersInputUtils";
import PdfBlobPreview from "../../reports/components/PdfBlobPreview";
import type { Trip } from "../../../shared/trip";
import type { OrdersT } from "../i18n/ordersI18n";
import {
  buildAssignmentWhatsAppMessage,
  formatCount,
  type AssignmentSheetRow,
} from "../utils/ordersUtils";
import {
  generateAssignmentSheetPdf,
  type AssignmentSheetPdfResult,
} from "../pdf/generateAssignmentSheetPdf";
import type { OrdersWhatsAppResult } from "../services/ordersService";

// A small label/value chip for the facts grid (module level — never created
// during render).
const Fact: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
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
  onConfirmSend: (
    orderedShopIds?: number[],
  ) => Promise<OrdersWhatsAppResult | null>;
  /** Submit the assignment (enabled once the sheet was sent OR downloaded).
   *  Receives the reviewed sequence when the operator re-ordered shops. */
  onConfirmSubmit: (orderedShopIds?: number[]) => Promise<void>;
};

function wasWhatsAppSent(r: OrdersWhatsAppResult | null): boolean {
  return Boolean(r?.enabled && r.sent > 0 && r.failed === 0);
}

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
  onConfirmSubmit,
}) => {
  const [result, setResult] = useState<
    (AssignmentSheetPdfResult & { builtFor: string }) | null
  >(null);
  const [buildError, setBuildError] = useState("");
  const [sentResult, setSentResult] = useState<OrdersWhatsAppResult | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
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
    [rows, perm],
  );

  // True when the visible order differs from what the parent persisted.
  const orderChanged = perm !== null && perm.some((v, i) => v !== i);

  const moveRowTo = (from: number, to: number) => {
    if (sending || from === to || to < 0 || to >= orderedRows.length) return;
    setPerm((prev) => {
      const next = prev ? [...prev] : rows.map((_, i) => i);
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  // Numbered EVERYWHERE from ONE source — the list, the message and the PDF
  // can never disagree about the sequence.
  const numberedRows = useMemo(
    () => orderedRows.map((r, i) => ({ ...r, serialNo: i + 1 })),
    [orderedRows],
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
    [trip, supervisorMobile, orderTripNo, orderDate, numberedRows, sheetLang],
  );

  // ── Sheets: built once per sequence — the frame, the download and the
  //    send summary all use the very same blob. Re-ordering re-builds it
  //    (the header art is cached inside the generator, so this is fast);
  //    the previous frame stays visible until the new one is ready.
  const buildKey = `${sheetLang}|${numberedRows.map((r) => `${r.shopId}:${r.boxes}`).join(",")}|${capacity}|${alreadyAssignedOther}`;
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    const key = buildKey;
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
        // Swap in place: the previous sheet stays on screen until this one is
        // ready, so a language flip or re-order cross-fades instead of
        // flashing an empty grey pane.
        setResult((prev) => {
          if (prev && prev.url !== built.url) URL.revokeObjectURL(prev.url);
          return { ...built, builtFor: key };
        });
        setBuildError("");
      })
      .catch((err) => {
        console.error("Assignment sheet PDF failed", err);
        if (alive) setBuildError(t("orders.pdf_failed"));
      });
    return () => {
      alive = false;
      // The URL is released when it is replaced (above) or on unmount; a
      // dependency change must NOT revoke the sheet still on screen.
      void url;
    };
    // The sheet depends on WHO/WHAT/ORDER, not on the blob bookkeeping.
  }, [
    trip,
    supervisorMobile,
    orderTripNo,
    orderDate,
    numberedRows,
    capacity,
    alreadyAssignedOther,
    sheetLang,
    t,
    buildKey,
  ]);

  useEffect(
    () => () => {
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    },
    [],
  );

  // "Building" = no result yet and no failure (derived, no extra state).
  const building = result === null && !buildError;
  // Rebuilding = a sheet is on screen but a newer one is being generated
  // (language flip / re-order) — shown as a soft overlay, not a blank pane.
  const rebuilding =
    result !== null && !buildError && result.builtFor !== buildKey;

  const sendOk = wasWhatsAppSent(sentResult);
  const sendFailed = Boolean(sentResult) && !sendOk;
  const busy = sending || submitting;

  const safeClose = () => {
    if (!busy) onClose();
  };

  const totalBoxes = orderedRows.reduce((s, r) => s + r.boxes, 0);

  const handleSend = async () => {
    if (busy || sendOk) return;
    const outcome = await onConfirmSend(
      orderChanged ? orderedRows.map((r) => r.shopId) : undefined,
    );
    if (outcome) setSentResult(outcome);
  };

  // Submit unlocks once the sheet has LEFT the screen either way — sent on
  // WhatsApp or downloaded as PDF (a printed sheet is a valid hand-over).
  const [downloaded, setDownloaded] = useState(false);
  const canSubmit = (sendOk || downloaded) && !busy;

  const handleSubmitAssignment = async () => {
    if (!canSubmit || submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await onConfirmSubmit(
        orderChanged ? orderedRows.map((r) => r.shopId) : undefined,
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.fileName;
    a.click();
    setDownloaded(true);
  };

  const subtitle = [
    trip.tripNo,
    formatVehicleNumber(trip.vehicleNo),
    trip.supervisorName,
    trip.driverName,
  ]
    .filter((v) => v && v !== "—")
    .join(" · ");

  return (
    <AppShellModal
      open
      onClose={safeClose}
      zIndex={60}
      panelClassName="bg-white"
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white">
        {/* ── Header — same anatomy as the Trip List view ── */}
        <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none">
              {/* Logo tile — the Review & Submit mark (no hen). */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/20 motion-safe:animate-[var(--animate-pop-in)]">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl">
                    {t("orders.wa_check_title")}
                  </h2>
                  <span className="hidden items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 sm:inline-flex">
                    {sheetLang === "te" ? "తెలుగు" : "EN"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#128C7E]">
                    <WhatsAppIcon size={11} /> WhatsApp
                  </span>
                  <span className="truncate text-xs font-medium text-slate-400">
                    {subtitle}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                {orderedRows.length} {t("orders.col_total_shops").toLowerCase()}{" "}
                · {formatCount(totalBoxes)} {t("orders.boxes_short")}
              </span>
              <ViewLanguageToggle
                language={sheetLang}
                onToggle={() => {
                  if (!busy) setSheetLang((l) => (l === "te" ? "en" : "te"));
                }}
                tone="emerald"
                labelMode="target"
                ariaLabel="Message and PDF language"
              />
              <button
                type="button"
                onClick={safeClose}
                disabled={busy}
                className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95 disabled:opacity-40"
                aria-label={t("orders.close")}
              >
                <span
                  className={`inline-flex ${uiActionIconMotionClass.close}`}
                >
                  <X size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* ── Left: ONLY the shops, in delivery order (re-orderable) ── */}
          <aside className="flex w-[25rem] shrink-0 flex-col border-r border-slate-100 bg-white/80">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                {t("orders.shops_to_deliver")}
              </p>
              <span className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-600">
                {orderedRows.length}
              </span>
            </div>
            <ul className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
              {numberedRows.map((row, i) => (
                <li
                  key={row.shopId}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 transition-all hover:border-emerald-200 hover:shadow-sm motion-safe:animate-[var(--animate-fade-in-up)]"
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                >
                  <OrderNumberInput
                    value={row.serialNo}
                    max={numberedRows.length}
                    disabled={sending}
                    label={`${t("orders.col_sequence")} — ${row.shopName}`}
                    onCommit={(pos) => moveRowTo(i, pos - 1)}
                  />
                  <SequenceArrows
                    index={i}
                    count={numberedRows.length}
                    disabled={sending}
                    label={row.shopName}
                    onMove={(dir) => moveRowTo(i, i + dir)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-bold text-slate-800"
                      title={row.shopName}
                    >
                      {row.shopName}
                    </p>
                    <p className="truncate text-[11.5px] font-semibold text-slate-500">
                      {row.village || "—"}
                      {row.mobile ? ` · ${row.mobile}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-bold tabular-nums text-emerald-700">
                      {formatCount(row.boxes)} {t("orders.boxes_short")}
                    </p>
                    <p className="text-[11.5px] font-semibold tabular-nums text-slate-500">
                      {row.birds > 0
                        ? `${formatCount(row.birds)} ${t("orders.birds_short")}`
                        : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {/* ── Right: assignment details under the heading, then the
                 message preview beside the sheet ── */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {t("orders.assignment_details")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <Fact
                  label={t("orders.pdf_order_date")}
                  value={orderDate || trip.tripDate}
                />
                <Fact
                  label={t("orders.col_total_shops")}
                  value={orderedRows.length}
                />
                <Fact
                  label={t("orders.col_assigned_boxes")}
                  value={formatCount(totalBoxes)}
                />
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

            <div className="flex min-h-0 flex-1">
              {/* Branded sheet */}
              <div className="flex min-w-0 flex-1 flex-col bg-slate-200/60">
                {building ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                    <Loader2
                      size={16}
                      className="animate-spin text-emerald-500"
                    />
                    {t("orders.pdf_building")}
                  </div>
                ) : buildError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-semibold text-rose-600">
                    {buildError}
                  </div>
                ) : result ? (
                  <div className="relative h-full">
                    <div
                      key={result.url}
                      className="h-full motion-safe:animate-[var(--animate-fade-in)]"
                    >
                      <PdfBlobPreview url={result.url} />
                    </div>
                    {rebuilding && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] transition-opacity motion-safe:animate-[var(--animate-fade-in)]">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-md">
                          <Loader2
                            size={14}
                            className="animate-spin text-emerald-500"
                          />
                          {t("orders.pdf_building")}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Message preview — a WhatsApp-style bubble column */}
              <aside className="flex w-[20rem] shrink-0 flex-col border-l border-slate-100 bg-[#efeae2]">
                <div className="flex items-center gap-2 border-b border-slate-200/70 bg-white/80 px-4 py-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white">
                    <WhatsAppIcon size={13} />
                  </span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                    {t("orders.wa_message_preview")}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  <pre
                    key={sheetLang}
                    className="relative whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-emerald-200/70 bg-[#d9fdd3] px-3.5 py-2.5 font-sans text-[11.5px] font-medium leading-relaxed text-slate-800 shadow-sm motion-safe:animate-[var(--animate-fade-in-up)]"
                  >
                    {message}
                  </pre>
                  <p className="mt-1.5 pr-1 text-right text-[10px] font-semibold text-slate-400">
                    → {supervisorMobile || "—"}
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>

        {/* ── Footer: note + per-shop outcome + actions (Trip List footer chrome) ── */}
        <div className="rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4 md:px-8">
          <div
            className="flex min-h-[1.125rem] items-center gap-1.5 text-[11px] font-semibold"
            aria-live="polite"
          >
            {sending ? (
              <>
                <Loader2 size={13} className="animate-spin text-emerald-600" />
                <span className="text-slate-500">
                  {t("orders.sending")}
                  {sendProgress ? ` · ${sendProgress}` : ""}
                </span>
              </>
            ) : sentResult ? (
              <span
                className={`motion-safe:animate-[var(--animate-fade-in-up)] ${sendOk ? "text-emerald-700" : "text-amber-600"}`}
              >
                {sendOk
                  ? t("orders.wa_sent_to", {
                      name: trip.supervisorName || "—",
                      mobile: supervisorMobile || "—",
                    })
                  : sentResult.message?.toLowerCase().includes("not configured")
                    ? t("orders.whatsapp_not_configured")
                    : sentResult.message === "no_rows"
                      ? t("orders.whatsapp_no_rows")
                      : t("orders.whatsapp_failed", {
                          message: sentResult.message ?? "—",
                        })}
              </span>
            ) : (
              <span className="text-slate-400">
                {t("orders.wa_send_note")}
                {result
                  ? ` · ${t("orders.pdf_pages", { pages: result.pages })} · ${result.fileName}`
                  : ""}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={safeClose}
              disabled={busy}
              className="group relative inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 active:scale-95 disabled:opacity-50"
            >
              <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                <X size={15} />
              </span>
              {t("orders.close")}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!result || sending}
              className="group relative inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50/80 px-5 py-2.5 text-xs font-semibold text-red-600 shadow-sm shadow-red-100/60 transition-all hover:bg-red-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className={`inline-flex ${result && !sending ? uiActionIconMotionClass.pdf : ""}`}
              >
                <Download size={14} />
              </span>
              {t("orders.pdf_download")}
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy || orderedRows.length === 0 || sendOk}
              className="group relative inline-flex items-center gap-2 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 px-5 py-2.5 text-xs font-bold text-[#128C7E] shadow-sm shadow-[#25D366]/10 transition-all hover:-translate-y-0.5 hover:bg-[#25D366]/20 hover:shadow-md active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : sendOk ? (
                <CheckCircle2
                  size={14}
                  className="motion-safe:animate-[var(--animate-pop-in)]"
                />
              ) : (
                <span
                  className={`inline-flex ${!busy && orderedRows.length > 0 ? uiActionIconMotionClass.whatsapp : ""}`}
                >
                  <Send size={14} />
                </span>
              )}
              {sendFailed ? t("orders.wa_retry") : t("orders.wa_confirm_send")}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitAssignment()}
              disabled={!canSubmit}
              className={`group relative inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-xs font-bold text-indigo-700 shadow-sm shadow-indigo-100/70 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 hover:shadow-md active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${
                canSubmit
                  ? "motion-safe:animate-[var(--animate-pop-in)] ring-2 ring-indigo-200/80 ring-offset-1"
                  : ""
              }`}
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span
                  className={`inline-flex ${canSubmit ? uiActionIconMotionClass.approve : ""}`}
                >
                  <CheckCircle2 size={14} />
                </span>
              )}
              {submitting
                ? t("orders.wa_auto_submitting")
                : t("orders.submit_order_assignment")}
            </button>
          </div>
        </div>
      </div>
    </AppShellModal>
  );
};

/** Delivery-order box — type 1, 2, 3 … and the shop moves to that position
 *  (Enter / blur commits, Escape restores). Same control as the assignment
 *  table so the two lists behave identically. */
function OrderNumberInput({
  value,
  max,
  disabled,
  label,
  onCommit,
}: {
  value: number;
  max: number;
  disabled: boolean;
  label: string;
  onCommit: (position: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    setDraft(null);
    if (!Number.isFinite(n) || n < 1) return;
    const pos = Math.min(max, n);
    if (pos !== value) onCommit(pos);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={draft ?? value}
      disabled={disabled}
      aria-label={label}
      title={label}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      onWheel={onOrdersNumberWheel}
      className={`${ORDERS_NO_SPINNER} h-8 w-11 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 text-center text-[12.5px] font-bold tabular-nums text-emerald-700 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 ${
        draft !== null ? "border-amber-300 bg-amber-50 text-amber-800" : ""
      }`}
    />
  );
}

export default OrdersWhatsAppConfirmPopup;
