import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Store,
  X,
} from "lucide-react";
import AppShellModal from "../../../ui/AppShellModal";
import { isEditableTarget } from "../../../shared/ui/tableRowSelection";
import { formatLedgerNumber } from "../utils/shopLedgerRounding";
import {
  formatDisplayDate,
  formatLedgerDateWithDay,
} from "../utils/shopLedgerDates";
import { stepDetailTxIndex } from "../utils/shopLedgerDetailNav";
import type { LedgerTransaction } from "./ShopLedgerPDF";
import {
  prefetchShopDetailLedger,
  scopeShopDetailLedger,
  useShopLedgerDetail,
  type ScopedShopDetail,
  type ShopDetailFilters,
} from "./shopLedgerDetailData";

export interface ShopDetailIdentity {
  shopNumber?: string;
  ownerName?: string;
  phoneNumber?: string;
  city?: string;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

const formatAmount = (value: number): string =>
  `₹ ${formatLedgerNumber(value)}`;

function downloadBlobFile(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function typeLabel(tx: LedgerTransaction, t: Translate): { text: string; color: string } {
  if (tx.type === "collection") {
    const mode = (tx.paymentMode || "").trim();
    return {
      text: mode ? t("shop_ledger.tx_type.collection_mode", { mode }) : t("shop_ledger.tx_type.collection"),
      color: "text-blue-600",
    };
  }
  if (tx.type === "correction") {
    return { text: t("shop_ledger.tx_type.correction"), color: "text-amber-600" };
  }
  return { text: t("shop_ledger.tx_type.sale"), color: "text-emerald-600" };
}

/** Chronological per-shop statement: summary cards plus the full transaction
 *  table. Pure (no fetching, no portals) so every visible state stays
 *  unit-testable with static markup. */
export function ShopLedgerDetailView({
  scoped,
  summary,
  status,
  errorMessage,
  onRetry,
  resetKey,
  t,
  language,
}: {
  scoped: LedgerTransaction[];
  summary: Omit<ScopedShopDetail, "scoped">;
  status: "loading" | "error" | "ready";
  errorMessage?: string;
  onRetry?: () => void;
  /** Roving transaction highlight resets whenever this changes (shop switch). */
  resetKey: string | number;
  t: Translate;
  language: "en" | "te";
}): React.ReactElement {
  const [activeTx, setActiveTx] = useState(0);
  // Render-phase sync (never an effect): a new shop always highlights its
  // first row; Tab then enters the table exactly once.
  const [syncedResetKey, setSyncedResetKey] = useState(resetKey);
  if (syncedResetKey !== resetKey) {
    setSyncedResetKey(resetKey);
    setActiveTx(0);
  }
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const safeActive = scoped.length === 0 ? -1 : Math.min(Math.max(activeTx, 0), scoped.length - 1);

  const focusTx = useCallback((index: number) => {
    setActiveTx(index);
    requestAnimationFrame(() => rowRefs.current.get(index)?.focus({ preventScroll: true }));
  }, []);

  const handleTxKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (isEditableTarget(event.target)) return;
      const next = stepDetailTxIndex(index, event.key, scoped.length);
      if (next === null) return;
      event.preventDefault();
      focusTx(next);
    },
    [scoped.length, focusTx],
  );

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm font-medium text-slate-400">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle size={16} className="animate-spin text-emerald-600" aria-hidden="true" />
          {t("shop_ledger.loading_records")}
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p className="text-sm font-semibold text-rose-600">
          {errorMessage || t("shop_ledger.load_error")}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            {t("common.retry")}
          </button>
        )}
      </div>
    );
  }

  if (scoped.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-20 text-center text-sm font-medium text-slate-400">
        {t("shop_ledger.no_transactions")}
      </div>
    );
  }

  const stats: Array<{ label: string; value: string; tone: string }> = [
    { label: t("shop_ledger.opening_balance"), value: formatAmount(summary.opening), tone: "text-slate-800" },
    { label: t("shop_ledger.total_sales_debit"), value: formatAmount(summary.totalSales), tone: "text-emerald-700" },
    { label: t("shop_ledger.total_collections_credit"), value: formatAmount(summary.totalCollections), tone: "text-blue-700" },
    { label: t("shop_ledger.closing_balance"), value: formatAmount(summary.closing), tone: summary.closing < 0 ? "text-rose-600" : "text-slate-800" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-2 gap-2 px-5 pt-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
            <p className={`mt-0.5 whitespace-nowrap text-sm font-extrabold tabular-nums ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      {(summary.totalBirds > 0 || summary.totalWeight > 0) && (
        <p className="px-5 pt-2 text-[11px] font-semibold text-slate-500">
          {t("shop_ledger.total_birds")}: <span className="tabular-nums text-slate-700">{summary.totalBirds.toLocaleString("en-IN")}</span>
          {" · "}
          {t("shop_ledger.total_weight_kg")}: <span className="tabular-nums text-slate-700">{summary.totalWeight.toFixed(2)}</span>
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
          <thead className="bg-slate-50/80 text-slate-600">
            <tr className="text-[11px] font-bold uppercase tracking-wider">
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("shop_ledger.col.s_no")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-left backdrop-blur">{t("common.date")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-left backdrop-blur">{t("common.type")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-left backdrop-blur">{t("shop_ledger.col.particulars")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("common.birds")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("shop_ledger.col.weight_kg")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("common.rate")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("shop_ledger.col.sale")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("shop_ledger.col.collection")}</th>
              <th className="sticky top-0 z-10 bg-slate-50/95 px-3 py-3 text-center backdrop-blur">{t("common.balance")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scoped.map((tx, index) => {
              const isOpening = index === 0;
              const label = typeLabel(tx, t);
              const isActive = index === safeActive;
              const detailBits = [tx.loadLabel, tx.collectionNo, tx.paymentMode].filter(Boolean);
              const fullTitle = [tx.particulars, tx.subShopName, label.text, ...detailBits, tx.remarks]
                .filter(Boolean)
                .join(", ");
              return (
                <tr
                  key={`${tx.type}:${tx.id ?? "opening"}:${index}`}
                  ref={(element) => {
                    if (element) rowRefs.current.set(index, element);
                    else rowRefs.current.delete(index);
                  }}
                  tabIndex={isActive ? 0 : -1}
                  aria-selected={isActive}
                  aria-label={isOpening ? t("shop_ledger.opening_balance") : `${tx.date} ${tx.particulars}`}
                  onFocus={() => setActiveTx(index)}
                  onClick={() => focusTx(index)}
                  onKeyDown={(event) => handleTxKeyDown(event, index)}
                  className={`cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                    isActive
                      ? "bg-emerald-50/80"
                      : isOpening
                        ? "bg-amber-50/50 font-semibold hover:bg-amber-100"
                        : "hover:bg-emerald-50/60"
                  }`}
                >
                  <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-slate-500">
                    {isOpening ? "-" : index}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium tabular-nums text-slate-600">
                    {isOpening ? t("shop_ledger.opening_balance") : formatLedgerDateWithDay(tx.date, language)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold ${label.color}`}>
                    {isOpening ? "—" : label.text}
                  </td>
                  <td className="max-w-[280px] overflow-hidden px-3 py-2.5 text-xs font-medium text-slate-700">
                    {isOpening ? (
                      <span className="text-slate-500">{t("shop_ledger.opening_balance")}</span>
                    ) : (
                      <span className="block truncate whitespace-nowrap" title={fullTitle || undefined}>
                        {[tx.particulars, tx.subShopName].filter(Boolean).join(", ")}
                        {detailBits.length > 0 && (
                          <span className="block truncate text-[10px] font-medium text-slate-400" title={fullTitle || undefined}>
                            {detailBits.join(" · ")}
                          </span>
                        )}
                        {tx.remarks ? (
                          <span className="font-normal italic text-slate-500">{` — ${tx.remarks}`}</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs tabular-nums text-slate-700">
                    {tx.type === "sale" ? tx.birds.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs tabular-nums text-slate-700">
                    {tx.type === "sale" ? tx.weight.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs tabular-nums text-slate-700">
                    {tx.type === "sale" ? tx.rate.toFixed(2) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-bold tabular-nums text-emerald-600">
                    {tx.debit > 0 ? formatAmount(tx.debit) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-bold tabular-nums text-blue-600">
                    {tx.credit > 0 ? formatAmount(tx.credit) : "—"}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-center text-xs font-bold tabular-nums ${tx.balance < 0 ? "text-rose-600" : "text-slate-800"}`}>
                    {formatAmount(tx.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="py-3 text-xs text-slate-500">
          {t("shop_ledger.tx_showing", { shown: Math.max(scoped.length - 1, 0), total: Math.max(scoped.length - 1, 0) })}
        </p>
      </div>
    </div>
  );
}

export interface ShopLedgerDetailModalProps {
  filters: ShopDetailFilters;
  identity?: ShopDetailIdentity;
  prevShopId: number | null;
  nextShopId: number | null;
  onNavigate: (shopId: number) => void;
  onClose: () => void;
  t: Translate;
  language: "en" | "te";
}

/** On-screen statement for one cumulative shop — the same authoritative rows
 *  the per-shop PDF prints, with previous/next navigation across the full
 *  filtered shop list. Read-only: no edits, approvals or collections here. */
export default function ShopLedgerDetailModal({
  filters,
  identity,
  prevShopId,
  nextShopId,
  onNavigate,
  onClose,
  t,
  language,
}: ShopLedgerDetailModalProps): React.ReactElement {
  const { shopId, shopName, fromDate, toDate, reportType, searchTerm } = filters;
  const detail = useShopLedgerDetail(filters);
  const scopedDetail = detail.kind === "ready"
    ? scopeShopDetailLedger(
      {
        shop: shopName,
        data: detail.raw,
        ownerName: filters.ownerName,
        mobile: filters.mobile,
        city: filters.city,
      },
      { reportType, searchTerm },
    )
    : null;

  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfBusyRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Neighbour statements are tiny single-shop reads — prefetch them while the
  // modal is idle so Previous/Next never shows a spinner twice.
  useEffect(() => {
    if (detail.kind !== "ready") return;
    if (prevShopId != null) {
      prefetchShopDetailLedger({ shopId: prevShopId, fromDate, toDate });
    }
    if (nextShopId != null) {
      prefetchShopDetailLedger({ shopId: nextShopId, fromDate, toDate });
    }
  }, [detail.kind, prevShopId, nextShopId, fromDate, toDate]);

  const viewStatus = detail.kind === "loading" ? "loading" : detail.kind === "error" ? "error" : "ready";

  const summary = scopedDetail ?? {
    opening: 0,
    totalSales: 0,
    totalCollections: 0,
    closing: 0,
    totalBirds: 0,
    totalWeight: 0,
  };

  const handleDownloadPdf = useCallback(async () => {
    if (pdfBusyRef.current || !scopedDetail) return;
    pdfBusyRef.current = true;
    setPdfBusy(true);
    try {
      // Lazy-loaded so the statement view (and its unit tests) never pay
      // for the PDF engine or its letterhead assets until a download.
      const { generateShopLedgerPDF, prepareShopLedgerPdfAssets } = await import(
        "./ShopLedgerPDF"
      );
      const assets = await prepareShopLedgerPdfAssets();
      const generated = await generateShopLedgerPDF(
        [
          {
            shop: shopName,
            data: scopedDetail.scoped,
            ownerName: filters.ownerName,
            mobile: filters.mobile,
            city: filters.city,
          },
        ],
        fromDate,
        toDate,
        shopName,
        assets,
        undefined,
        {
          includeCumulativeSummary: false,
          filterCaption:
            [
              reportType === "sales" ? "Sales" : reportType === "collection" ? "Collections" : "",
              searchTerm.trim() ? `Search: ${searchTerm.trim()}` : "",
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
        },
      );
      downloadBlobFile(generated.url, generated.filename);
      window.setTimeout(() => URL.revokeObjectURL(generated.url), 10_000);
    } finally {
      pdfBusyRef.current = false;
      setPdfBusy(false);
    }
  }, [scopedDetail, shopName, filters.ownerName, filters.mobile, filters.city, fromDate, toDate, reportType, searchTerm]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Editable controls keep their native Left/Right behaviour.
      if (isEditableTarget(event.target)) return;
      if (event.key === "ArrowLeft" && prevShopId != null) {
        event.preventDefault();
        onNavigate(prevShopId);
      } else if (event.key === "ArrowRight" && nextShopId != null) {
        event.preventDefault();
        onNavigate(nextShopId);
      }
    },
    [prevShopId, nextShopId, onNavigate],
  );

  const identityBits = [
    identity?.shopNumber ? `#${identity.shopNumber}` : "",
    identity?.ownerName || "",
    identity?.city || "",
    identity?.phoneNumber || "",
  ].filter(Boolean);

  return (
    <AppShellModal
      open
      onClose={onClose}
      zIndex={120}
      ariaLabelledBy="shop-ledger-detail-title"
      panelClassName="bg-white"
    >
      <div onKeyDown={handleKeyDown} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
              <Store size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 id="shop-ledger-detail-title" className="truncate text-sm font-bold text-slate-800">
                {shopName}
              </h3>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {identityBits.length > 0 ? `${identityBits.join(" · ")} · ` : ""}
                {fromDate || toDate
                  ? t("shop_ledger.pdf_date_range", {
                      from: formatDisplayDate(fromDate || toDate),
                      to: formatDisplayDate(toDate || fromDate),
                    })
                  : t("common.all")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => prevShopId != null && onNavigate(prevShopId)}
              disabled={prevShopId == null}
              aria-label={t("shop_ledger.detail.prev_shop")}
              title={t("shop_ledger.detail.prev_shop")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => nextShopId != null && onNavigate(nextShopId)}
              disabled={nextShopId == null}
              aria-label={t("shop_ledger.detail.next_shop")}
              title={t("shop_ledger.detail.next_shop")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfBusy || !scopedDetail || scopedDetail.scoped.length === 0}
              aria-label={t("shop_ledger.detail.download_pdf")}
              title={t("shop_ledger.detail.download_pdf")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} className={pdfBusy ? "animate-pulse" : undefined} aria-hidden="true" />
              {pdfBusy ? t("shop_ledger.detail.downloading") : t("shop_ledger.detail.download_pdf")}
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <ShopLedgerDetailView
          scoped={scopedDetail?.scoped ?? []}
          summary={summary}
          status={viewStatus}
          errorMessage={detail.kind === "error" ? detail.message : undefined}
          onRetry={detail.kind === "error" ? detail.retry : undefined}
          resetKey={shopId}
          t={t}
          language={language}
        />
      </div>
    </AppShellModal>
  );
}
