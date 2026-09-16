import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bird,
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileStack,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  ListChecks,
  Loader2,
  LoaderCircle,
  RotateCcw,
  Scale,
  Search,
  Square,
  Store,
  Weight,
  X,
} from "lucide-react";
import { useShops } from "../../masters/shops/hooks/useShops";
import type { Shop } from "../../masters/shops/types/shop";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { onShopDataChanged } from "../../../shared/events/shopDataEvents";
import { useI18n } from "../../../i18n";
import { DatePicker } from "../../../components/common/DatePicker";
import { apiPost } from "../../../api";
import { BrandRefreshButton, Pagination } from "../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../masters/components/MasterDropdown";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../shared/ui/operationsStyles";
import { shouldShowPagination, PAGINATION_DEFAULT_PAGE_SIZE } from "../../../shared/ui/paginationStyles";
import { exportToExcel } from "../../../utils/exportUtils";
import {
  fetchShopLedger,
  type ShopLedgerResponse,
  type ShopLedgerRow,
} from "../services/shopLedgerService";
import { generateShopLedgerPDF, prepareShopLedgerPdfAssets } from "../components/ShopLedgerPDF";
import type { LedgerTransaction, ShopLedgerPdfEntry } from "../components/ShopLedgerPDF";
import PdfBlobPreview from "../components/PdfBlobPreview";
import { prefetchPdfJs } from "../components/pdfJsLoader";

interface ShopLedgerProps {
  embedded?: boolean;
}

type ReportTypeFilter = "all" | "sales" | "collection";
type WaReportType = "All" | "Sales" | "Collection";
type WaScope = "selected" | "all";

interface WhatsAppSendPayload {
  reportType: WaReportType;
  dateFrom: string;
  dateTo: string;
  scope: WaScope;
  shopName: string;
  recipient: string;
  ownerName: string;
  shopWhatsApp: string;
  message: string;
  pdfBase64: string;
  fileName: string;
}

interface PdfPreviewState {
  combinedUrl: string;
  combinedFilename: string;
  files: { shop: string; url: string | null; filename: string }[];
  selectedIndex: number;
  selectedShops: string[];
  shopData: Record<string, LedgerTransaction[]>;
}

const WHATSAPP_BACKEND_ENABLED =
  import.meta.env.VITE_WHATSAPP_BACKEND_ENABLED === "true";

const REFRESH_TOAST_DURATION = 3500;

const WA_SEND_COUNT_STORAGE_KEY = "dmr-shop-ledger-whatsapp-weekly-send-counts";
const WA_LAST_SENT_STORAGE_KEY = "dmr-shop-ledger-whatsapp-weekly-last-sent";

// Global pagination — one page-size system for the whole app (Trip List,
// Collections, Shop Ledger all share it).
const DEFAULT_PAGE_SIZE = PAGINATION_DEFAULT_PAGE_SIZE;

/** Columns the ledger may be sorted by. Balance is deliberately excluded —
 *  it is a running total whose order is defined by Date, never by size. */
type LedgerSortKey =
  | "date"
  | "particulars"
  | "birds"
  | "weight"
  | "rate"
  | "debit"
  | "credit";

/** Stable, direction-aware comparator for ledger rows (opening row excluded
 *  by the caller — it is pinned first and never sorted). */
function compareLedgerTx(a: LedgerTransaction, b: LedgerTransaction, key: LedgerSortKey): number {
  if (key === "date") return a.date.localeCompare(b.date);
  if (key === "particulars") return a.particulars.localeCompare(b.particulars, undefined, { numeric: true });
  return (a[key] ?? 0) - (b[key] ?? 0);
}

/** The Trip List's two-tone sort arrows, reused verbatim on ledger headers. */
function LedgerSortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

function ShopLedgerWhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      role="img"
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

// ─── Ledger row mapping — keeps the existing LedgerTransaction shape that the
//     table + PDF exports already consume. Birds/weight/rate belong to
//     sale rows (backend trip-delivery detail); collections carry their number.
const txParticulars = (row: ShopLedgerRow): string => {
  // Particulars = shop name only. Trip/collection reference numbers are still
  // kept on the transaction (collectionNo) for search, but never shown here.
  return row.shopName || row.description || row.referenceNo || "Ledger";
};

const mapRowToTx = (row: ShopLedgerRow): LedgerTransaction => {
  const isSale = row.type === "sale";
  return {
    date: row.date,
    particulars: txParticulars(row),
    birds: isSale ? row.birds : 0,
    weight: isSale ? row.weight : 0,
    rate: isSale ? row.rate : 0,
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
    balance: Number(row.balance) || 0,
    type: row.type,
    paymentMode: row.paymentMode ?? undefined,
    collectionNo: row.referenceNo || undefined,
  };
};

/** ISO week start — the Monday (local time) of the week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/**
 * Default ledger window — the CURRENT week, Monday → TODAY.
 *
 * From = this week's Monday; To = today. When today IS Sunday the range is
 * the complete Monday → Sunday week; on any other day it runs from Monday up
 * to the present moment, so the statement always starts on a week boundary.
 */
function defaultWeekRange(): { from: string; to: string } {
  const now = new Date();
  return { from: format(mondayOf(now), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
}

const toDateDefault = () => defaultWeekRange().to;
const toWeekAgoDefault = () => defaultWeekRange().from;

/** yyyy-MM-dd → dd-MM-yyyy (day-month-year) for table cells and exports. */
const formatDisplayDate = (value: string): string => {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** Telugu short weekdays — same order as WEEKDAY_SHORT (Sunday first). The
 *  active language decides which set renders; underlying dates never change. */
const WEEKDAY_SHORT_TE = ["ఆది", "సోమ", "మంగళ", "బుధ", "గురు", "శుక్ర", "శని"] as const;

/** yyyy-MM-dd → short weekday ("Mon" / "సోమ"). Parsed LOCALLY — a UTC parse
 *  would roll the day back one in IST and label Tuesday rows as Monday. */
const weekdayOf = (value: string, language: "en" | "te" = "en"): string => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "";
  const [year, month, day] = parts;
  const dow = new Date(year, month - 1, day).getDay();
  return (language === "te" ? WEEKDAY_SHORT_TE : WEEKDAY_SHORT)[dow];
};

/** Shift a yyyy-MM-dd date by N days on the local calendar. */
const shiftDateIso = (value: string, days: number): string => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return value;
  const [year, month, day] = parts;
  return format(new Date(year, month - 1, day + days), "yyyy-MM-dd");
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Fetch the COMPLETE ledger, walking server pagination until every row has
 *  arrived — without this, All-Shops ranges with more than one page of
 *  transactions would silently truncate at the server's page size. */
async function fetchAllLedgerPages(filters: {
  shopId?: number;
  fromDate: string;
  toDate: string;
}): Promise<ShopLedgerResponse> {
  const first = await fetchShopLedger({ ...filters, page: 1, limit: 500 });
  const totalPages = Math.max(1, first.meta?.totalPages ?? 1);
  if (totalPages <= 1) return first;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchShopLedger({ ...filters, page: index + 2, limit: 500 }),
    ),
  );
  return { ...first, data: [...first.data, ...rest.flatMap((page) => page.data)] };
}

const normalizePaymentMode = (value?: string): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/upi/i.test(raw)) return "UPI";
  if (/union/i.test(raw)) return "Union";
  if (/\bsbi\b/i.test(raw) || /state bank/i.test(raw)) return "SBI";
  if (/bank/i.test(raw)) return "Bank Transfer";
  if (/cheque|check/i.test(raw)) return "Cheque";
  if (/credit/i.test(raw)) return "Credit";
  if (/cash/i.test(raw)) return "Cash";
  return raw;
};

const formatAmount = (value: number): string =>
  `₹ ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;

// ─── Weekly send tracking (Monday-start week) ───────────────────────────────
// Counts are keyed by "<weekStart>:<shop>" so last week's numbers drop out
// automatically the moment a new week begins — no cleanup job needed.
function getWeekStartKey(date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - daysSinceMonday);
  return [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, "0"),
    String(local.getDate()).padStart(2, "0"),
  ].join("-");
}

const weeklySendKey = (weekStart: string, shop: string): string => `${weekStart}:${shop}`;

function weeklySendCount(
  counts: Record<string, number> | undefined,
  weekStart: string,
  shop: string,
): number {
  return counts?.[weeklySendKey(weekStart, shop)] || 0;
}

function loadStoredRecord<T extends string | number>(key: string): Record<string, T> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, T> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([entryKey, value]) => {
      if (typeof value === typeof ("" as T) && value !== null) {
        out[entryKey] = value as T;
      }
    });
    return out;
  } catch {
    return {};
  }
}

/**
 * Keep only the current week's entries — storage stays bounded and a new week
 * deterministically reads 0 (no stale carry-over, ever).
 */
function pruneWeeklyRecord<T extends string | number>(
  record: Record<string, T> | undefined,
  weekStart: string,
): Record<string, T> {
  const prefix = `${weekStart}:`;
  const out: Record<string, T> = {};
  Object.entries(record ?? {}).forEach(([key, value]) => {
    if (key.startsWith(prefix)) out[key] = value;
  });
  return out;
}

/** Yield to the browser so long batch work never blocks paint or input. */
const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

// ─── File helpers ────────────────────────────────────────────────────────────
const downloadFile = (url: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Unable to read PDF bytes."));
    reader.readAsDataURL(blob);
  });
}

// ─── WhatsApp message template ───────────────────────────────────────────────
function buildWhatsAppMessage(
  reportType: WaReportType,
  shop: string,
  ownerName: string,
  dateFrom: string,
  dateTo: string,
  fileName: string,
): string {
  const reportLabel = reportType === "All" ? "All (Sales & Collection)" : reportType;
  return [
    "DMR Poultries",
    `Shop Ledger Report - ${reportLabel}`,
    "",
    `Shop: ${shop}`,
    `Owner: ${ownerName}`,
    `Period: ${formatDisplayDate(dateFrom)} to ${formatDisplayDate(dateTo)}`,
    "",
    `Dear ${ownerName},`,
    `Please find attached the ${reportLabel} Shop Ledger report for ${shop} for the period ${formatDisplayDate(dateFrom)} to ${formatDisplayDate(dateTo)}.`,
    "",
    `Attached PDF: ${fileName}`,
    "",
    "Thank you.",
    "Regards,",
    "DMR Poultries",
  ].join("\n");
}

const ShopLedgerPage: React.FC<ShopLedgerProps> = ({ embedded = false }) => {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const { shops } = useShops();

  // O(1) shop-master lookups (id, owner, city, phone) — no repeated array
  // scans inside render loops or batch exports.
  const shopMasterMap = useMemo(() => {
    const map = new Map<string, Shop>();
    shops.forEach((shop: Shop) => map.set(shop.shopName, shop));
    return map;
  }, [shops]);

  const [dateFrom, setDateFrom] = useState(toWeekAgoDefault);
  const [dateTo, setDateTo] = useState(toDateDefault);
  const [selectedShop, setSelectedShop] = useState("All Shops");
  const [reportType, setReportType] = useState<ReportTypeFilter>("all");
  const [searchValue, setSearchValue] = useState("");

  // Applied values are committed only when the user clicks Search. The input
  // controls above are draft values; changing them does not affect the table
  // or KPIs until Search is pressed.
  const [appliedDateFrom, setAppliedDateFrom] = useState(toWeekAgoDefault);
  const [appliedDateTo, setAppliedDateTo] = useState(toDateDefault);
  const [appliedSelectedShop, setAppliedSelectedShop] = useState("All Shops");
  const [appliedReportType, setAppliedReportType] = useState<ReportTypeFilter>("all");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  /** Trip-List style explicit sort — null means natural ledger order.
   *  Default view is LATEST FIRST (newest transactions on top). */
  const [sortBy, setSortBy] = useState<LedgerSortKey | null>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [ledgerData, setLedgerData] = useState<LedgerTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerRefreshing, setLedgerRefreshing] = useState(false);
  /** Holds an i18n KEY (not display text) so the fetch effect never needs
   *  `t` in its deps — switching language re-renders the translated banner
   *  without refetching data (no spinner flicker on language change). */
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [refreshToast, setRefreshToast] = useState(false);

  const selectedShopId = useMemo(() => {
    return appliedSelectedShop === "All Shops"
      ? undefined
      : shopMasterMap.get(appliedSelectedShop)?.id;
  }, [appliedSelectedShop, shopMasterMap]);

  const buildLedger = useCallback(
    async (from: string, to: string, shopId?: number): Promise<LedgerTransaction[]> => {
      const res = await fetchAllLedgerPages({ fromDate: from, toDate: to, shopId });

      let openingTotal: number;
      let body: LedgerTransaction[];

      if (shopId != null) {
        // Single shop — the backend returns the authoritative opening balance
        // and true per-row running balances. By construction the previous
        // week's closing is exactly this week's opening.
        openingTotal = Number(res.openingBalance) || 0;
        body = res.data.map(mapRowToTx);
      } else {
        // ALL SHOPS — the backend's combined ledger mixes balances across
        // shops, so rebuild the TRUE per-shop running balances client-side.
        // Each shop's opening at `from` = its master opening + its own net
        // activity before `from`, so for every shop the previous period's
        // closing carries forward as this period's opening.
        const history = await fetchAllLedgerPages({
          fromDate: shiftDateIso(from, -365),
          toDate: shiftDateIso(from, -1),
        });
        const preNetByShop = new Map<number, number>();
        for (const row of history.data) {
          const sid = Number(row.shopId ?? 0);
          preNetByShop.set(sid, (preNetByShop.get(sid) ?? 0) + row.debit - row.credit);
        }
        const openingByShop = new Map<number, number>();
        let aggregateOpening = 0;
        for (const shop of shops) {
          const opening = (Number(shop.openingBalance) || 0) + (preNetByShop.get(shop.id) ?? 0);
          openingByShop.set(shop.id, opening);
          aggregateOpening += opening;
        }
        // Defensive: shops with pre-range activity missing from the master.
        for (const [sid, net] of preNetByShop) {
          if (!openingByShop.has(sid)) {
            openingByShop.set(sid, net);
            aggregateOpening += net;
          }
        }
        // Rows arrive chronologically — thread each shop's own balance.
        const running = new Map<number, number>(openingByShop);
        body = res.data.map((row) => {
          const sid = Number(row.shopId ?? 0);
          const next = round2((running.get(sid) ?? 0) + row.debit - row.credit);
          running.set(sid, next);
          const tx = mapRowToTx(row);
          tx.balance = next;
          return tx;
        });
        openingTotal = round2(aggregateOpening);
      }

      const openingRow: LedgerTransaction = {
        date: from,
        particulars: "Opening Balance",
        birds: 0,
        weight: 0,
        rate: 0,
        debit: 0,
        credit: 0,
        balance: openingTotal,
        type: "sale",
      };
      return [openingRow, ...body];
    },
    [shops]
  );

  useEffect(() => {
    let cancelled = false;

    buildLedger(appliedDateFrom, appliedDateTo, selectedShopId)
      .then((tx) => {
        if (!cancelled) {
          setLedgerLoading(false);
          setLedgerRefreshing(false);
          setLedgerError(null);
          setLedgerData(tx);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLedgerLoading(false);
          setLedgerRefreshing(false);
          setLedgerError("shop_ledger.load_error");
        }
      });
    return () => {
      cancelled = true;
    };
    // `refreshNonce` drives a targeted content refresh (same pattern used by
    // other ERP tabs): the loader keeps the existing table visible while the
    // data is reloaded, so the page itself is never fully reloaded.
  }, [appliedDateFrom, appliedDateTo, appliedSelectedShop, selectedShopId, buildLedger, refreshNonce]);

  /**
   * A collection approved or deleted elsewhere moves the very balances this
   * ledger prints. Bumping the nonce re-reads the server with the filters the
   * user has applied — the loader keeps the current table visible meanwhile.
   */
  useEffect(
    () =>
      onShopDataChanged(() => {
        setLedgerLoading(true);
        setRefreshNonce((nonce) => nonce + 1);
      }),
    [],
  );

  const filteredLedger = useMemo(() => {
    const opening = ledgerData.slice(0, 1);
    const body = ledgerData.slice(1);

    const scoped = body.filter((tx) => {
      if (appliedReportType === "sales" && tx.type !== "sale") return false;
      if (appliedReportType === "collection" && tx.type !== "collection") return false;
      if (!appliedSearchTerm.trim()) return true;
      const needle = appliedSearchTerm.trim().toLowerCase();
      return [
        tx.date,
        tx.particulars,
        tx.collectionNo,
        tx.paymentMode,
        tx.type,
        String(tx.birds || ""),
        tx.weight > 0 ? String(tx.weight) : "",
        tx.rate > 0 ? String(tx.rate) : "",
        tx.debit > 0 ? String(tx.debit) : "",
        tx.credit > 0 ? String(tx.credit) : "",
        tx.balance !== 0 ? String(tx.balance) : "",
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });

    return [...opening, ...scoped];
  }, [ledgerData, appliedReportType, appliedSearchTerm]);

  /** Body rows (opening row excluded) with the applied search/type filters
   *  AND the explicit Sort By selection — the single source the table, the
   *  paginator and the Excel export all read, so they can never disagree. */
  const sortedBody = useMemo(() => {
    const body = filteredLedger.slice(1);
    if (!sortBy) return body;
    const dir = sortDir === "desc" ? -1 : 1;
    return [...body].sort((a, b) => compareLedgerTx(a, b, sortBy) * dir);
  }, [filteredLedger, sortBy, sortDir]);

  const totalRows = useMemo(() => sortedBody.length, [sortedBody]);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const visibleRows = useMemo(() => {
    const opening = filteredLedger.slice(0, 1);
    const start = (safePage - 1) * pageSize;
    return [...opening, ...sortedBody.slice(start, start + pageSize)];
  }, [filteredLedger, sortedBody, safePage, pageSize]);

  const summary = useMemo(() => {
    const tx = filteredLedger.slice(1);
    const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
    const totalBirds = tx
      .filter((t) => t.type === "sale")
      .reduce((sum, t) => sum + t.birds, 0);
    const totalWeight = tx
      .filter((t) => t.type === "sale")
      .reduce((sum, t) => sum + t.weight, 0);
    // Opening row is always pinned first — single shop: backend-authoritative;
    // all shops: aggregate of every shop's carried-forward opening.
    const openingBalance = filteredLedger.length > 0 ? filteredLedger[0].balance : 0;
    // The accounting identity: Closing = Opening + Sales − Collections. For a
    // single shop this equals the last running balance; for All Shops it is
    // the combined closing outstanding across every shop.
    const closingBalance = round2(openingBalance + totalDebit - totalCredit);
    return { openingBalance, totalDebit, totalCredit, totalBirds, totalWeight, closingBalance };
  }, [filteredLedger]);

  /** STATEMENT OVERVIEW — always the FULL ledger for the applied dates + shop
   *  scope, independent of Report Type / Search. Those filters narrow the
   *  TABLE (and its TOTAL row) but must never silently zero the headline
   *  Opening → Sales → Collections → Closing statement, which is what made the
   *  overview look frozen when a filter was applied. Date / shop changes
   *  re-fetch `ledgerData`, so Opening and Closing visibly move with them. */
  const scopeSummary = useMemo(() => {
    const tx = ledgerData.slice(1);
    const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
    const totalBirds = tx
      .filter((t) => t.type === "sale")
      .reduce((sum, t) => sum + t.birds, 0);
    const totalWeight = tx
      .filter((t) => t.type === "sale")
      .reduce((sum, t) => sum + t.weight, 0);
    const openingBalance = ledgerData.length > 0 ? ledgerData[0].balance : 0;
    const closingBalance = round2(openingBalance + totalDebit - totalCredit);
    return { openingBalance, totalDebit, totalCredit, totalBirds, totalWeight, closingBalance };
  }, [ledgerData]);

  /** Rows in the full scope (excluding the pinned Opening row) — used to
   *  show "X of Y transactions" so every filter visibly does something. */
  const scopeRows = Math.max(0, ledgerData.length - 1);

  const resetPage = useCallback(() => setCurrentPage(1), []);

  // Per-shop ledger cache, keyed by "from|to|shop". Filter changes switch
  // keys, so switching back to a previous filter is instant. Bounded to the
  // last 20 shop×filter entries to keep memory predictable.
  const ledgerCacheRef = useRef<Map<string, LedgerTransaction[]>>(new Map());
  const LEDGER_CACHE_LIMIT = 20;

  const getCachedLedger = useCallback(
    async (from: string, to: string, shop: string): Promise<LedgerTransaction[] | null> => {
      const key = `${from}|${to}|${shop}`;
      const hit = ledgerCacheRef.current.get(key);
      if (hit) return hit;
      const shopId = shopMasterMap.get(shop)?.id;
      if (shopId == null) return null;
      const ledger = await buildLedger(from, to, shopId);
      ledgerCacheRef.current.set(key, ledger);
      while (ledgerCacheRef.current.size > LEDGER_CACHE_LIMIT) {
        const oldest = ledgerCacheRef.current.keys().next().value;
        if (oldest === undefined) break;
        ledgerCacheRef.current.delete(oldest);
      }
      return ledger;
    },
    [shopMasterMap, buildLedger],
  );

  // ─── PDF preview modal state ────────────────────────────────
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [pdfShopSearch, setPdfShopSearch] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const pdfPreviewRef = useRef<PdfPreviewState | null>(null);
  // Synchronous in-flight guard — state alone cannot stop a double-click
  // race because both clicks read the same render's state.
  const pdfGeneratingRef = useRef(false);
  const pdfDownloadBusyRef = useRef(false);
  // Per-shop PDFs are generated on demand — this tracks in-flight shops and
  // the one to show a spinner for.
  const perShopBusyRef = useRef<Set<string>>(new Set());
  const [pdfBusyShop, setPdfBusyShop] = useState<string | null>(null);
  // Session token: only the newest export may commit its preview modal;
  // stale runs discard their generated object URLs instead of leaking them.
  const exportSessionRef = useRef(0);

  // Keep the ref in sync so download/regenerate callbacks always read the
  // latest preview state without being re-created on every render.
  useEffect(() => {
    pdfPreviewRef.current = pdfPreview;
  }, [pdfPreview]);

  const revokePdfUrls = (state: PdfPreviewState | null) => {
    if (!state) return;
    const urls = new Set<string>([state.combinedUrl]);
    state.files.forEach((file) => {
      if (file.url) urls.add(file.url);
    });
    urls.forEach((url) => URL.revokeObjectURL(url));
  };

  // ─── PDF export → preview modal ────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (pdfGeneratingRef.current) return;
    pdfGeneratingRef.current = true;

    const session = ++exportSessionRef.current;
    const createdUrls: string[] = [];

    try {
      setPdfGenerating(true);

      let shopNames: string[] = [];

      if (appliedSelectedShop === "All Shops") {
        const all = await fetchShopLedger({ fromDate: appliedDateFrom, toDate: appliedDateTo });
        const names = new Set<string>();
        all.data.forEach((r) => {
          if (r.shopName) names.add(r.shopName);
        });
        shopNames = Array.from(names);
      } else {
        shopNames = [appliedSelectedShop];
      }

      if (shopNames.length === 0) {
        showNotification(t("shop_ledger.no_shops_in_range"), "error");
        return;
      }

      // Statements are presented in clean alphabetical shop order.
      shopNames.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

      const allLedgers: ShopLedgerPdfEntry[] = [];
      const shopData: Record<string, LedgerTransaction[]> = {};
      for (const shop of shopNames) {
        const ledger = await getCachedLedger(appliedDateFrom, appliedDateTo, shop);
        if (ledger && ledger.length > 1) {
          const master = shopMasterMap.get(shop);
          allLedgers.push({
            shop,
            data: ledger,
            ownerName: master?.ownerName || undefined,
            mobile: master?.phoneNumber || undefined,
            city: master?.city || undefined,
          });
          shopData[shop] = ledger;
        }
      }

      if (allLedgers.length === 0) {
        showNotification(t("shop_ledger.no_export_data"), "error");
        return;
      }

      // Revoke object URLs from any previous preview before replacing them.
      revokePdfUrls(pdfPreviewRef.current);
      pdfPreviewRef.current = null;

      // Warm the PDF viewer in parallel with generation so the modal's
      // first paint never waits on the pdf.js download.
      prefetchPdfJs();

      // Prepare the branded letterhead hen once and reuse it for the
      // combined PDF and every per-shop PDF in this batch.
      const letterheadAssets = await prepareShopLedgerPdfAssets();

      // Only the combined document is generated up-front — that is what the
      // modal opens on. Per-shop PDFs are built on demand when a shop is
      // clicked or downloaded, so the modal appears in a fraction of the time
      // (one document instead of fifty-one).
      const combined = await generateShopLedgerPDF(
        allLedgers,
        appliedDateFrom,
        appliedDateTo,
        appliedSelectedShop,
        letterheadAssets,
        (done, total) => {
          setPdfProgress(total > 1 ? `${done}/${total}` : null);
        },
      );
      createdUrls.push(combined.url);

      const files: { shop: string; url: string | null; filename: string }[] = allLedgers.map(
        ({ shop }) => ({
          shop,
          url: allLedgers.length === 1 ? combined.url : null,
          filename: `WeeklyStatement_${shop.replace(/\s+/g, "_")}_${formatDisplayDate(appliedDateFrom)}_to_${formatDisplayDate(appliedDateTo)}.pdf`,
        }),
      );

      if (exportSessionRef.current !== session) {
        // The modal was closed (or a newer export started) while this run
        // was generating — discard this run's files instead of flashing a
        // stale preview back open.
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      const nextState: PdfPreviewState = {
        combinedUrl: combined.url,
        combinedFilename: combined.filename,
        files,
        // Multi-shop exports open on the combined "All Shops" PDF with
        // nothing selected — the user explicitly picks the shops they want
        // before any selection-based download. A single-shop export opens
        // directly on that shop's PDF (already selected by definition).
        selectedIndex: files.length > 1 ? -1 : 0,
        selectedShops: files.length > 1 ? [] : files.map((file) => file.shop),
        shopData,
      };
      pdfPreviewRef.current = nextState;
      setPdfPreview(nextState);
      setPdfShopSearch("");
      showNotification(
        t("shop_ledger.pdf_ready_hint"),
        "success",
      );
    } catch {
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
      showNotification(t("shop_ledger.load_failed"), "error");
    } finally {
      pdfGeneratingRef.current = false;
      setPdfGenerating(false);
      setPdfProgress(null);
    }
  }, [appliedSelectedShop, appliedDateFrom, appliedDateTo, showNotification, shopMasterMap, getCachedLedger, t]);

  const closePdfPreview = useCallback(() => {
    // Invalidate any in-flight export so it cannot re-open this modal.
    exportSessionRef.current += 1;
    revokePdfUrls(pdfPreviewRef.current);
    pdfPreviewRef.current = null;
    setPdfPreview(null);
    setPdfShopSearch("");
  }, []);

  const pdfFilteredFiles = useMemo(() => {
    if (!pdfPreview) return [];
    const needle = pdfShopSearch.trim().toLowerCase();
    if (!needle) return pdfPreview.files;
    return pdfPreview.files.filter((file) => file.shop.toLowerCase().includes(needle));
  }, [pdfPreview, pdfShopSearch]);

  const activePdfFile = pdfPreview
    ? pdfPreview.selectedIndex >= 0 && pdfPreview.files[pdfPreview.selectedIndex]
      ? pdfPreview.files[pdfPreview.selectedIndex]
      : { shop: "All Shops", url: pdfPreview.combinedUrl, filename: pdfPreview.combinedFilename }
    : null;

  /**
   * Generate (and cache) a shop's PDF the first time it is needed — preview
   * click or download. Idempotent: in-flight and already-generated shops are
   * returned without duplicate work.
   */
  const ensureShopPdf = useCallback(
    async (shop: string): Promise<string | null> => {
      const current = pdfPreviewRef.current;
      if (!current) return null;
      const existing = current.files.find((file) => file.shop === shop);
      if (existing?.url) return existing.url;
      if (perShopBusyRef.current.has(shop)) return null;

      // Only a closed (or restarted) export invalidates this run. Selecting
      // another shop or toggling checkboxes while we generate is normal and
      // must NOT discard the result — the file is written into whatever the
      // latest preview state is when generation finishes.
      const sessionAtStart = exportSessionRef.current;

      perShopBusyRef.current.add(shop);
      setPdfBusyShop(shop);
      try {
        // Prefer the live ledger snapshot for this export; fall back to the
        // filter-keyed cache (already built for the combined document).
        const ledger =
          current.shopData[shop] ??
          (await getCachedLedger(appliedDateFrom, appliedDateTo, shop)) ??
          [];
        const master = shopMasterMap.get(shop);
        const generated = await generateShopLedgerPDF(
          [{
            shop,
            data: ledger,
            ownerName: master?.ownerName || undefined,
            mobile: master?.phoneNumber || undefined,
            city: master?.city || undefined,
          }],
          appliedDateFrom,
          appliedDateTo,
          shop,
        );
        if (exportSessionRef.current !== sessionAtStart || !pdfPreviewRef.current) {
          // The modal was closed (or a new export started) — discard.
          URL.revokeObjectURL(generated.url);
          return null;
        }
        // Write into the latest preview state via a functional update: other
        // parts of the state (selection, active index) may have changed while
        // this PDF was generating, and those changes must be preserved.
        let finalUrl: string | null = null;
        setPdfPreview((prev) => {
          if (!prev) return prev;
          const nextState: PdfPreviewState = {
            ...prev,
            files: prev.files.map((file) =>
              file.shop === shop
                ? { ...file, url: generated.url, filename: generated.filename }
                : file,
            ),
          };
          pdfPreviewRef.current = nextState;
          finalUrl = generated.url;
          return nextState;
        });
        return finalUrl;
      } finally {
        perShopBusyRef.current.delete(shop);
        setPdfBusyShop((prev) => (prev === shop ? null : prev));
      }
      // appliedDateFrom/To pinned via useCallback deps
    },
    [appliedDateFrom, appliedDateTo, shopMasterMap, getCachedLedger],
  );

  const setActivePdfShop = (index: number, shop?: string) => {
    setPdfPreview((prev) => (prev ? { ...prev, selectedIndex: index } : prev));
    if (shop) void ensureShopPdf(shop);
  };

  const togglePdfShop = (shop: string) => {
    setPdfPreview((prev) => {
      if (!prev) return prev;
      const selected = prev.selectedShops.includes(shop)
        ? prev.selectedShops.filter((name) => name !== shop)
        : [...prev.selectedShops, shop];
      return { ...prev, selectedShops: selected };
    });
  };

  const selectAllPdfShops = () => {
    setPdfPreview((prev) =>
      prev ? { ...prev, selectedShops: prev.files.map((file) => file.shop) } : prev,
    );
  };

  const clearPdfShops = () => {
    setPdfPreview((prev) => (prev ? { ...prev, selectedShops: [] } : prev));
  };

  // One PDF file per selected shop (generating any that aren't cached yet).
  const handleDownloadSelectedShops = async () => {
    if (pdfDownloadBusyRef.current) return;
    const current = pdfPreviewRef.current;
    if (!current) return;
    const chosen = current.files.filter((file) => current.selectedShops.includes(file.shop));
    if (chosen.length === 0) {
      showNotification(t("shop_ledger.pdf_select_shops"), "info");
      return;
    }
    pdfDownloadBusyRef.current = true;
    try {
      for (const file of chosen) {
        const url = file.url ?? (await ensureShopPdf(file.shop));
        if (url) downloadFile(url, file.filename);
        await yieldToBrowser();
      }
      showNotification(`Downloading ${chosen.length} shop PDF(s).`, "success");
    } finally {
      pdfDownloadBusyRef.current = false;
    }
  };

  // A single combined PDF containing only the selected shops.
  const handleDownloadSelectedCombined = async () => {
    if (pdfDownloadBusyRef.current) return;
    pdfDownloadBusyRef.current = true;
    try {
      await runDownloadSelectedCombined();
    } finally {
      pdfDownloadBusyRef.current = false;
    }
  };

  const runDownloadSelectedCombined = async () => {
    const current = pdfPreviewRef.current;
    if (!current) return;
    const ledgers: ShopLedgerPdfEntry[] = current.selectedShops
      .map((shop) => {
        const master = shopMasterMap.get(shop);
        return {
          shop,
          data: current.shopData[shop] ?? [],
          ownerName: master?.ownerName || undefined,
          mobile: master?.phoneNumber || undefined,
          city: master?.city || undefined,
        };
      })
      .filter((entry) => entry.data.length > 0);
    if (ledgers.length === 0) {
      showNotification(t("shop_ledger.pdf_select_shops"), "info");
      return;
    }
    const label = ledgers.length === 1 ? ledgers[0].shop : "All Shops";
    const generated = await generateShopLedgerPDF(ledgers, appliedDateFrom, appliedDateTo, label);
    downloadFile(generated.url, generated.filename);
    window.setTimeout(() => URL.revokeObjectURL(generated.url), 10_000);
    showNotification(`Combined PDF with ${ledgers.length} shop(s) downloaded.`, "success");
  };

  const handleSearch = useCallback(() => {
    // Commit the draft filter controls. Until Search is clicked the table,
    // KPIs and exports keep using the previously applied filters.
    setLedgerLoading(true); // Rate-Entry style spinner while records reload
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedSelectedShop(selectedShop);
    setAppliedReportType(reportType);
    setAppliedSearchTerm(searchValue);
    resetPage();
  }, [dateFrom, dateTo, selectedShop, reportType, searchValue, resetPage]);

  const handleReset = useCallback(() => {
    const defaultFrom = toWeekAgoDefault();
    const defaultTo = toDateDefault();

    setLedgerLoading(true); // Rate-Entry style spinner while records reload
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
    setSelectedShop("All Shops");
    setReportType("all");
    setSearchValue("");

    setAppliedDateFrom(defaultFrom);
    setAppliedDateTo(defaultTo);
    setAppliedSelectedShop("All Shops");
    setAppliedReportType("all");
    setAppliedSearchTerm("");

    // Reset returns to the page's standard state: latest-first date order.
    setSortBy("date");
    setSortDir("desc");
    setCurrentPage(1);
  }, []);

  /** First click sorts ascending; second flips to descending; a third click
   *  on the active column clears the sort (Trip List contract, same here). */
  const handleSortChange = useCallback(
    (key: LedgerSortKey) => {
      if (sortBy !== key) {
        setSortBy(key);
        setSortDir("asc");
      } else if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortBy(null);
        setSortDir("asc");
      }
      setCurrentPage(1);
    },
    [sortBy, sortDir],
  );

  /** The Sort By dropdown commits a `key:dir` pair (or "" to clear). */
  const handleSortValueChange = useCallback((value: string) => {
    if (!value) {
      setSortBy(null);
      setSortDir("asc");
      setCurrentPage(1);
      return;
    }
    const [key, direction] = value.split(":");
    setSortBy(key as LedgerSortKey);
    setSortDir(direction === "desc" ? "desc" : "asc");
    setCurrentPage(1);
  }, []);

  /** Remove ONE applied filter from the indicator pills — resets that draft
   *  and its applied value, so the ledger refetches immediately. */
  const clearAppliedFilter = useCallback((which: "dates" | "shop" | "type" | "search") => {
    setLedgerLoading(true); // Rate-Entry style spinner while records reload
    if (which === "dates") {
      const defaultFrom = toWeekAgoDefault();
      const defaultTo = toDateDefault();
      setDateFrom(defaultFrom);
      setDateTo(defaultTo);
      setAppliedDateFrom(defaultFrom);
      setAppliedDateTo(defaultTo);
    } else if (which === "shop") {
      setSelectedShop("All Shops");
      setAppliedSelectedShop("All Shops");
    } else if (which === "type") {
      setReportType("all");
      setAppliedReportType("all");
    } else {
      setSearchValue("");
      setAppliedSearchTerm("");
    }
    setCurrentPage(1);
  }, []);

  // Warm the lazy pdf.js viewer during idle time so the very first PDF
  // click paints the preview without waiting on the library download.
  useEffect(() => {
    const timer = window.setTimeout(() => prefetchPdfJs(), 1_500);
    return () => window.clearTimeout(timer);
  }, []);

  // Auto-hide the "Shop Ledger Refreshed" toast.
  useEffect(() => {
    if (!refreshToast) return;
    const timer = window.setTimeout(() => setRefreshToast(false), REFRESH_TOAST_DURATION);
    return () => window.clearTimeout(timer);
  }, [refreshToast]);

  const handleRefresh = useCallback(() => {
    // Targeted content refresh only — never reload the whole page/browser tab.
    setLedgerLoading(true); // Rate-Entry style spinner while records reload
    setLedgerRefreshing(true);
    setRefreshToast(true);
    setRefreshNonce((n) => n + 1);
  }, []);

  /** Excel export — the exact rows on screen (applied filters + sort), in the
   *  same shape as the ledger table. Trip List uses the same shared util. */
  const handleExportExcel = useCallback(() => {
    const rows = sortedBody;
    if (rows.length === 0) {
      showNotification(t("shop_ledger.no_export_rows"), "error");
      return;
    }
    const headers = [
      "Date",
      "Day",
      "Particulars",
      "Type",
      "Payment Mode",
      "Birds",
      "Weight (KG)",
      "Rate",
      "Debit",
      "Credit",
      "Balance",
    ];
    const data = rows.map((tx) => [
      formatDisplayDate(tx.date),
      weekdayOf(tx.date),
      tx.particulars,
      tx.type === "sale" ? "Sale" : tx.type === "collection" ? "Collection" : "Correction",
      normalizePaymentMode(tx.paymentMode) || "-",
      tx.type === "sale" ? tx.birds : 0,
      tx.type === "sale" ? Number(tx.weight.toFixed(2)) : 0,
      tx.type === "sale" ? Number(tx.rate.toFixed(2)) : 0,
      Number(tx.debit.toFixed(2)),
      Number(tx.credit.toFixed(2)),
      Number(tx.balance.toFixed(2)),
    ]);
    const shopLabel = appliedSelectedShop === "All Shops" ? "All Shops" : appliedSelectedShop;
    const title = `Shop Ledger — ${shopLabel} (${formatDisplayDate(appliedDateFrom)} to ${formatDisplayDate(appliedDateTo)})`;
    const filename = `Shop_Ledger_${appliedSelectedShop === "All Shops" ? "All_Shops" : appliedSelectedShop.replace(/\s+/g, "_")}_${appliedDateFrom}_to_${appliedDateTo}`;
    exportToExcel(title, headers, data, filename);
    showNotification(t("shop_ledger.excel_exported"), "success");
  }, [sortedBody, appliedSelectedShop, appliedDateFrom, appliedDateTo, showNotification, t]);

  // ─── WhatsApp modal state ──────────────────────────────────
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [waReportType, setWaReportType] = useState<WaReportType>("All");
  const [waDateFrom, setWaDateFrom] = useState(toWeekAgoDefault);
  const [waDateTo, setWaDateTo] = useState(toDateDefault);
  const [waScope, setWaScope] = useState<WaScope>("selected");
  const [waSending, setWaSending] = useState(false);
  const [waConfirmAll, setWaConfirmAll] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waSendingShop, setWaSendingShop] = useState<string | null>(null);
  const [waSendCounts, setWaSendCounts] = useState<Record<string, number>>(
    () => loadStoredRecord<number>(WA_SEND_COUNT_STORAGE_KEY),
  );
  const [waLastSent, setWaLastSent] = useState<Record<string, string>>(
    () => loadStoredRecord<string>(WA_LAST_SENT_STORAGE_KEY),
  );
  const [waSelectedShops, setWaSelectedShops] = useState<string[]>([]);
  const [waShopSearch, setWaShopSearch] = useState("");
  const [waPreviewShop, setWaPreviewShop] = useState<string | null>(null);
  // Synchronous send guard (double-click race) plus a per-run success ledger
  // so a retry after partial failure never re-sends to shops that already
  // received the report — no duplicate messages, ever.
  const waSendingRef = useRef(false);
  const waSucceededRef = useRef<string[]>([]);
  const [waSucceededShops, setWaSucceededShops] = useState<string[]>([]);
  // Attachment verification: the exact per-shop PDF the message will carry,
  // generated on demand from the modal's own filters and previewable/downloadable
  // before sending.
  const [waAttachmentUrl, setWaAttachmentUrl] = useState<string | null>(null);
  const [waAttachmentBusy, setWaAttachmentBusy] = useState(false);
  const [waAttachmentOpen, setWaAttachmentOpen] = useState(false);
  const waAttachmentUrlRef = useRef<string | null>(null);
  const waAttachmentBusyRef = useRef(false);
  const waAttachmentShopRef = useRef<string | null>(null);

  const resetWaSucceeded = useCallback(() => {
    waSucceededRef.current = [];
    setWaSucceededShops([]);
  }, []);

  // Lock background scroll while a modal is open (with scrollbar-width
  // compensation) so the page never jumps or scrolls behind the overlay.
  const anyModalOpen = whatsappOpen || pdfPreview !== null;
  useEffect(() => {
    if (!anyModalOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [anyModalOpen]);

  // Monday-of-week bucket. Re-checked every minute so counts roll over to 0
  // automatically when a new week starts (even if the page stays open past
  // midnight on Monday).
  const [currentWeekKey, setCurrentWeekKey] = useState(getWeekStartKey);
  const currentWeekKeyRef = useRef(currentWeekKey);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const week = getWeekStartKey();
      if (currentWeekKeyRef.current === week) return;
      // New week started: roll the bucket over and prune last week's data so
      // every counter deterministically reads 0 again — even if this tab
      // stays open across midnight on Monday.
      currentWeekKeyRef.current = week;
      setCurrentWeekKey(week);
      setWaSendCounts((prev) => pruneWeeklyRecord(prev, week));
      setWaLastSent((prev) => pruneWeeklyRecord(prev, week));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Persist weekly counters (current week only) so they survive reloads
  // within the same week while storage stays bounded.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        WA_SEND_COUNT_STORAGE_KEY,
        JSON.stringify(pruneWeeklyRecord(waSendCounts, currentWeekKey)),
      );
    } catch {
      /* storage unavailable — counters stay in-memory */
    }
  }, [waSendCounts, currentWeekKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WA_LAST_SENT_STORAGE_KEY,
        JSON.stringify(pruneWeeklyRecord(waLastSent, currentWeekKey)),
      );
    } catch {
      /* storage unavailable — last-sent stays in-memory */
    }
  }, [waLastSent, currentWeekKey]);

  const waAllShopNames = useMemo(() => {
    const source = shops.map((shop: Shop) => shop.shopName);
    return Array.from(new Set(source)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [shops]);

  /**
   * WhatsApp recipient for a shop — `whatsappNumber` from Shop Master when
   * present, otherwise the regular `phoneNumber`.
   */
  const resolveWaRecipient = useCallback(
    (shop: string): { shop: string; ownerName: string; phoneNumber: string; whatsappNumber: string } => {
      const found = shopMasterMap.get(shop);
      if (!found) {
        return { shop, ownerName: "Shop Owner", phoneNumber: "", whatsappNumber: "" };
      }
      const whatsapp = String(found.whatsappNumber || found.phoneNumber || "").trim();
      const phone = String(found.phoneNumber || "").trim();
      return {
        shop,
        ownerName: String(found.ownerName || "Shop Owner").trim(),
        phoneNumber: phone,
        whatsappNumber: whatsapp || phone,
      };
    },
    [shopMasterMap],
  );

  /** Drop the attachment preview document (and its blob URL). */
  const resetWaAttachment = useCallback(() => {
    if (waAttachmentUrlRef.current) {
      URL.revokeObjectURL(waAttachmentUrlRef.current);
      waAttachmentUrlRef.current = null;
    }
    waAttachmentShopRef.current = null;
    setWaAttachmentUrl(null);
    setWaAttachmentOpen(false);
  }, []);

  /**
   * Generate the exact attachment for a shop from the modal's own filters.
   * Shares the ledger cache with the PDF modal, so nothing is fetched or
   * built twice.
   */
  const ensureWaAttachment = useCallback(
    async (shop: string): Promise<string | null> => {
      if (waAttachmentBusyRef.current) return waAttachmentUrlRef.current;
      waAttachmentBusyRef.current = true;
      setWaAttachmentBusy(true);
      waAttachmentShopRef.current = shop;
      try {
        const ledger = (await getCachedLedger(waDateFrom, waDateTo, shop)) ?? [];
        const master = shopMasterMap.get(shop);
        const generated = await generateShopLedgerPDF(
          [{
            shop,
            data: ledger,
            ownerName: master?.ownerName || undefined,
            mobile: master?.phoneNumber || undefined,
            city: master?.city || undefined,
          }],
          waDateFrom,
          waDateTo,
          shop,
        );
        // The user moved to another shop/dates while this was building —
        // discard it instead of showing a stale attachment.
        if (waAttachmentShopRef.current !== shop) {
          URL.revokeObjectURL(generated.url);
          return null;
        }
        if (waAttachmentUrlRef.current) {
          URL.revokeObjectURL(waAttachmentUrlRef.current);
        }
        waAttachmentUrlRef.current = generated.url;
        setWaAttachmentUrl(generated.url);
        return generated.url;
      } finally {
        waAttachmentBusyRef.current = false;
        setWaAttachmentBusy(false);
      }
    },
    [waDateFrom, waDateTo, shopMasterMap, getCachedLedger],
  );

  const handleWaToggleAttachmentPreview = () => {
    if (waAttachmentOpen) {
      setWaAttachmentOpen(false);
      return;
    }
    setWaAttachmentOpen(true);
    if (waPreviewShop) void ensureWaAttachment(waPreviewShop);
  };

  const handleWaDownloadAttachment = () => {
    if (!waPreviewShop) return;
    void Promise.resolve(
      waAttachmentUrlRef.current ?? ensureWaAttachment(waPreviewShop),
    ).then((url) => {
      if (url) {
        downloadFile(url, waPreviewFileName);
        showNotification(t("shop_ledger.wa.attachment_downloaded"), "success");
      }
    });
  };

  const openWhatsApp = useCallback(() => {
    if (waSendingRef.current) return; // never re-open the modal mid-send
    // WhatsApp follows the currently applied (Search-committed) filters.
    setWaReportType(
      appliedReportType === "sales"
        ? "Sales"
        : appliedReportType === "collection"
          ? "Collection"
          : "All",
    );
    setWaDateFrom(appliedDateFrom);
    setWaDateTo(appliedDateTo);
    const initial = appliedSelectedShop === "All Shops"
      ? waAllShopNames
      : waAllShopNames.filter((name) => name === appliedSelectedShop);
    setWaSelectedShops(initial);
    setWaScope("selected");
    setWaPreviewShop(initial[0] ?? null);
    setWaShopSearch("");
    setWaConfirmAll(false);
    setWaError(null);
    resetWaSucceeded();
    resetWaAttachment();
    setWhatsappOpen(true);
  }, [appliedReportType, appliedDateFrom, appliedDateTo, appliedSelectedShop, waAllShopNames, resetWaSucceeded, resetWaAttachment]);

  const closeWhatsApp = useCallback(() => {
    if (waSendingRef.current) return;
    setWhatsappOpen(false);
    setWaConfirmAll(false);
    setWaError(null);
    setWaSendingShop(null);
    resetWaAttachment();
  }, [resetWaAttachment]);

  const waVisibleShops = useMemo(() => {
    const needle = waShopSearch.trim().toLowerCase();
    if (!needle) return waAllShopNames;
    return waAllShopNames.filter((name) => name.toLowerCase().includes(needle));
  }, [waAllShopNames, waShopSearch]);

  const waTargetShops = useMemo(
    () =>
      waScope === "all"
        ? waAllShopNames
        : waAllShopNames.filter((name) => waSelectedShops.includes(name)),
    [waScope, waAllShopNames, waSelectedShops],
  );

  const waWeekTotal = useMemo(
    () =>
      waTargetShops.reduce(
        (sum, shop) => sum + weeklySendCount(waSendCounts, currentWeekKey, shop),
        0,
      ),
    [waTargetShops, waSendCounts, currentWeekKey],
  );

  const toggleWaShop = (shop: string) => {
    setWaSelectedShops((prev) =>
      prev.includes(shop) ? prev.filter((name) => name !== shop) : [...prev, shop],
    );
  };

  const waPreviewRecipient = waPreviewShop ? resolveWaRecipient(waPreviewShop) : null;
  const waPreviewFileName = waPreviewShop
    ? `WeeklyStatement_${waPreviewShop.replace(/\s+/g, "_")}_${formatDisplayDate(waDateFrom)}_to_${formatDisplayDate(waDateTo)}.pdf`
    : "";
  const waPreviewMessage =
    waPreviewShop && waPreviewRecipient
      ? buildWhatsAppMessage(
          waReportType,
          waPreviewShop,
          waPreviewRecipient.ownerName || "Shop Owner",
          waDateFrom,
          waDateTo,
          waPreviewFileName,
        )
      : "";

  const sendWhatsApp = useCallback(async () => {
    if (waSendingRef.current) return;
    // In All mode the first press arms the confirmation; the second performs
    // the actual send.
    if (waScope === "all" && !waConfirmAll) {
      setWaConfirmAll(true);
      return;
    }

    const targets = waTargetShops;
    if (targets.length === 0) {
      setWaError(t("shop_ledger.wa.select_error"));
      return;
    }
    if (!waDateFrom || !waDateTo) {
      setWaError(t("shop_ledger.wa.invalid_range"));
      return;
    }
    if (!WHATSAPP_BACKEND_ENABLED) {
      // Never fake success. The endpoint/service must be explicitly enabled
      // and the backend must confirm delivery before we report success.
      setWaError(t("shop_ledger.wa.not_configured"));
      showNotification(t("shop_ledger.wa.not_configured"), "info");
      return;
    }

    // Retry safety: skip shops that already received this exact report.
    const pendingTargets = targets.filter((shop) => !waSucceededRef.current.includes(shop));
    if (pendingTargets.length === 0) {
      setWaError(t("shop_ledger.wa.already_sent"));
      return;
    }

    waSendingRef.current = true;
    setWaSending(true);
    setWaError(null);
    setWaConfirmAll(false);

    const weekStart = currentWeekKey;
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const shop of pendingTargets) {
      setWaSendingShop(shop);
      try {
        const recipient = resolveWaRecipient(shop);
        if (!recipient.whatsappNumber) {
          throw new Error(`No WhatsApp number on file for ${shop}.`);
        }

        const shopId = shopMasterMap.get(shop)?.id;
        if (shopId == null) {
          throw new Error(`Shop ${shop} is not in the shops master.`);
        }

        // Same per-shop PDF the preview modal generates.
        const ledger = await buildLedger(waDateFrom, waDateTo, shopId);

        const waMaster = shopMasterMap.get(shop);
        const generated = await generateShopLedgerPDF(
          [{
            shop,
            data: ledger,
            ownerName: waMaster?.ownerName || undefined,
            mobile: waMaster?.phoneNumber || undefined,
            city: waMaster?.city || undefined,
          }],
          waDateFrom,
          waDateTo,
          shop,
        );
        try {
          const message = buildWhatsAppMessage(
            waReportType,
            shop,
            recipient.ownerName || "Shop Owner",
            waDateFrom,
            waDateTo,
            generated.filename,
          );
          const pdfBase64 = await blobToBase64(generated.blob);

          const payload: WhatsAppSendPayload = {
            reportType: waReportType,
            dateFrom: waDateFrom,
            dateTo: waDateTo,
            scope: waScope,
            shopName: recipient.shop,
            recipient: recipient.whatsappNumber,
            ownerName: recipient.ownerName,
            shopWhatsApp: recipient.whatsappNumber,
            message,
            pdfBase64,
            fileName: generated.filename,
          };

          await apiPost("/operations/shop-ledger/whatsapp", payload, { timeout: 60_000 });
        } finally {
          URL.revokeObjectURL(generated.url);
        }

        // Only after the backend confirmed delivery do we count the send
        // and record it as done for this modal run (dedupes any retry).
        successCount += 1;
        waSucceededRef.current = [...waSucceededRef.current, shop];
        setWaSucceededShops(waSucceededRef.current);
        const key = weeklySendKey(weekStart, shop);
        setWaSendCounts((prev) => ({
          ...prev,
          [key]: (prev?.[key] || 0) + 1,
        }));
        setWaLastSent((prev) => ({ ...prev, [key]: new Date().toLocaleString() }));
      } catch {
        failedCount += 1;
      }
      }
    } finally {
      waSendingRef.current = false;
      setWaSendingShop(null);
      setWaSending(false);
    }

    if (failedCount === 0) {
      showNotification(`WhatsApp report sent to ${successCount} shop(s).`, "success");
      setWhatsappOpen(false);
    } else if (successCount > 0) {
      const message = `WhatsApp sent to ${successCount} shop(s); ${failedCount} failed. Press Send again to retry only the failed shop(s).`;
      setWaError(message);
      showNotification(message, "error");
    } else {
      setWaError(t("shop_ledger.wa.send_failed"));
      showNotification(t("shop_ledger.wa.send_failed"), "error");
    }
  }, [
    waScope,
    waConfirmAll,
    waTargetShops,
    waDateFrom,
    waDateTo,
    currentWeekKey,
    resolveWaRecipient,
    shopMasterMap,
    buildLedger,
    waReportType,
    showNotification,
    t,
  ]);

  // ─── Filter dropdown models — identical chrome to the Trip List toolbar ───
  // Shop options feed the shared MasterDropdown (searchable, clearable). The
  // "All Shops" sentinel is an EMPTY value, so the dropdown shows its
  // placeholder and the clear affordance behaves exactly like Trip Filters.
  const shopDropdownOptions = useMemo<MasterDropdownOption[]>(() => {
    const seen = new Set<string>();
    return shops.flatMap((shop: Shop) => {
      const name = String(shop.shopName || "").trim();
      if (!name || seen.has(name)) return [];
      seen.add(name);
      return [{ value: name, label: name, searchText: name }];
    });
  }, [shops]);

  const reportTypeOptions: MasterDropdownOption[] = [
    { value: "sales", label: t("shop_ledger.type.sales") },
    { value: "collection", label: t("shop_ledger.type.collection") },
  ];

  /** Field name + direction — the exact Sort By model the Trip List uses. */
  const sortOptions: MasterDropdownOption[] = [
    { value: "date:asc", label: t("shop_ledger.sort.date_asc") },
    { value: "date:desc", label: t("shop_ledger.sort.date_desc") },
    { value: "particulars:asc", label: t("shop_ledger.sort.particulars_asc") },
    { value: "particulars:desc", label: t("shop_ledger.sort.particulars_desc") },
    { value: "birds:asc", label: t("shop_ledger.sort.birds_asc") },
    { value: "birds:desc", label: t("shop_ledger.sort.birds_desc") },
    { value: "weight:asc", label: t("shop_ledger.sort.weight_asc") },
    { value: "weight:desc", label: t("shop_ledger.sort.weight_desc") },
    { value: "rate:asc", label: t("shop_ledger.sort.rate_asc") },
    { value: "rate:desc", label: t("shop_ledger.sort.rate_desc") },
    { value: "debit:asc", label: t("shop_ledger.sort.debit_asc") },
    { value: "debit:desc", label: t("shop_ledger.sort.debit_desc") },
    { value: "credit:asc", label: t("shop_ledger.sort.credit_asc") },
    { value: "credit:desc", label: t("shop_ledger.sort.credit_desc") },
  ];
  const sortValue = sortBy ? `${sortBy}:${sortDir}` : "";

  // ─── Applied-filter pills (Mortality-style indicator) ───
  // One pill per committed filter, each individually removable.
  const appliedFilterPills = useMemo(() => {
    const pills: { key: "dates" | "shop" | "type" | "search"; label: string; value: string }[] = [];
    const defaultFrom = toWeekAgoDefault();
    const defaultTo = toDateDefault();
    if (appliedDateFrom !== defaultFrom || appliedDateTo !== defaultTo) {
      pills.push({ key: "dates", label: t("common.date"), value: `${formatDisplayDate(appliedDateFrom)} → ${formatDisplayDate(appliedDateTo)}` });
    }
    if (appliedSelectedShop !== "All Shops") {
      pills.push({ key: "shop", label: t("common.shop"), value: appliedSelectedShop });
    }
    if (appliedReportType !== "all") {
      pills.push({ key: "type", label: t("common.type"), value: appliedReportType === "sales" ? t("shop_ledger.type.sales") : t("shop_ledger.type.collection") });
    }
    if (appliedSearchTerm.trim()) {
      pills.push({ key: "search", label: t("common.search"), value: appliedSearchTerm.trim() });
    }
    return pills;
  }, [appliedDateFrom, appliedDateTo, appliedSelectedShop, appliedReportType, appliedSearchTerm, t]);

  /** Clickable column header — Trip List's three-state sort contract:
   *  first click asc, second desc, third clears back to ledger order. */
  const sortableHeader = (key: LedgerSortKey, icon: React.ReactNode, label: string, center = false) => {
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => handleSortChange(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex items-center gap-2 w-full uppercase tracking-wider font-bold text-[12px] transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${active ? "text-emerald-700" : ""}`}
      >
        {icon}
        <span>{label}</span>
        <LedgerSortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  // ─── UI — Trip-List style toolbar, pills, table and global pagination ───
  return (
    <div className={`w-full space-y-5 animate-in fade-in duration-200 text-slate-800 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen'
    }`}>
      {/* ── FILTER CARD — identical chrome & colours to the Trip List ─────── */}
      <div className={opsFilterCardClass}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t("common.from")}</span>
            </label>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder={t("placeholder.enter_date")}
              className="w-full text-xs font-medium"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t("common.to")}</span>
            </label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder={t("placeholder.enter_date")}
              className="w-full text-xs font-medium"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <Store size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t("common.shop")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("common.shop")}
              value={selectedShop === "All Shops" ? "" : selectedShop}
              options={shopDropdownOptions}
              onChange={(next) => setSelectedShop(next || "All Shops")}
              placeholder={t("shop_ledger.all_shops")}
              searchable
              allowClear
              className="w-full"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <Layers size={17} className="text-amber-500 flex-shrink-0" />
              <span>{t("shop_ledger.report_type")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("shop_ledger.report_type")}
              value={reportType === "all" ? "" : reportType}
              options={reportTypeOptions}
              onChange={(next) => setReportType((next as ReportTypeFilter) || "all")}
              placeholder={t("common.all")}
              searchable
              allowClear
              className="w-full"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" />
              <span>{t("common.sort_by")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("common.sort_by")}
              value={sortValue}
              options={sortOptions}
              onChange={handleSortValueChange}
              placeholder={t("shop_ledger.no_sorting")}
              searchable
              allowClear
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-1">
          <div className="lg:col-span-7">
            <label className={opsFilterLabelClass}>
              <Search size={17} className="text-slate-400 flex-shrink-0" />
              <span>{t("common.search")}</span>
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder={t("shop_ledger.search_placeholder")}
                aria-label={t("shop_ledger.search_aria")}
                className={`${opsInputClass} pl-10 ${searchValue ? "pr-9" : ""}`}
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  aria-label={t("shop_ledger.clear_search")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex items-center gap-2 justify-end flex-wrap">
            <button type="button" onClick={handleSearch} className={`group relative ${opsPrimaryButtonClass}`} aria-label={t("common.search")}>
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-search)]"><Search size={15} /></span>
              {t("common.search")}
            </button>
            <button type="button" onClick={handleReset} className={`group relative ${opsSecondaryButtonClass}`} aria-label={t("common.reset")}>
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
              {t("common.reset")}
            </button>
            <BrandRefreshButton onClick={handleRefresh} loading={ledgerRefreshing} />
            <button
              type="button"
              onClick={() => void handleExportPDF()}
              disabled={pdfGenerating}
              title={appliedSelectedShop === "All Shops" ? t("shop_ledger.pdf_hint_all") : t("shop_ledger.pdf_hint_shop", { shop: appliedSelectedShop })}
              className={`group relative ${opsPdfButtonClass} disabled:opacity-60`}
              aria-label="PDF"
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-pdf)]">
                {pdfGenerating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              </span>
              {pdfProgress ?? "PDF"}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={sortedBody.length === 0}
              title={t("shop_ledger.excel_hint")}
              className={`group relative ${opsExcelButtonClass} disabled:opacity-60`}
              aria-label="Excel"
            >
              <span className={`inline-flex ${sortedBody.length > 0 ? "motion-safe:group-hover:animate-[var(--animate-action-excel)]" : ""}`}>
                <FileSpreadsheet size={15} />
              </span>
              Excel
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
              title="WhatsApp"
              aria-label="WhatsApp"
              disabled={waSending}
              className="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#25D366]/50 bg-[#25D366] text-white shadow-sm transition hover:bg-[#1DA851] focus:outline-none focus:ring-2 focus:ring-[#25D366]/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-whatsapp)]">
                <ShopLedgerWhatsAppIcon size={17} />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── APPLIED FILTERS — one removable pill per committed filter,
             exactly like the Mortality / Trip Loss page ─────────────────── */}
      {appliedFilterPills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
          <Filter size={14} className="flex-shrink-0 text-amber-600" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">{t("shop_ledger.applied_filters")}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {appliedFilterPills.map((pill) => (
              <span
                key={pill.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/80 px-2.5 py-0.5 text-[11px] leading-5 text-amber-800"
              >
                <span className="font-medium text-amber-600">{pill.label}</span>
                <span className="font-semibold tabular-nums">{pill.value}</span>
                <button
                  type="button"
                  onClick={() => clearAppliedFilter(pill.key)}
                  aria-label={t("shop_ledger.clear_filter", { label: pill.label })}
                  className="group ml-0.5 rounded-full p-0.5 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-700"
                >
                  <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]">
                    <X size={11} strokeWidth={2.75} />
                  </span>
                </button>
              </span>
            ))}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto flex-shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
          >
            {t("common.clear")}
          </button>
        </div>
      )}

      {ledgerError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-800">
          {t(ledgerError)}
        </div>
      )}

      {/* ── STATEMENT OVERVIEW — the FULL Opening → Sales → Collections →
             Closing statement for the selected dates + shop. Report Type and
             Search narrow the table below; they never blank these cards, and
             date/shop changes visibly move Opening and Closing. ─────────── */}
      <div>
        <div className="flex items-end justify-between gap-3 mb-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <BarChart3 size={14} className="text-emerald-500" />
            {t("shop_ledger.statement_overview")}
            {appliedSelectedShop !== "All Shops" && (
              <span className="normal-case tracking-normal font-semibold text-slate-400">— {appliedSelectedShop}</span>
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 tabular-nums">
            {totalRows === scopeRows
              ? t("shop_ledger.tx_count", { count: scopeRows.toLocaleString() })
              : t("shop_ledger.tx_showing", { shown: totalRows.toLocaleString(), total: scopeRows.toLocaleString() })}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Scale size={13} className="text-indigo-500" /> {t("shop_ledger.opening_balance")}
            </p>
            <p className="text-xl font-bold text-indigo-600 tabular-nums">{formatAmount(scopeSummary.openingBalance)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowUpRight size={13} className="text-emerald-500" /> {t("shop_ledger.total_sales_debit")}
            </p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatAmount(scopeSummary.totalDebit)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowDownLeft size={13} className="text-blue-500" /> {t("shop_ledger.total_collections_credit")}
            </p>
            <p className="text-xl font-bold text-blue-600 tabular-nums">{formatAmount(scopeSummary.totalCredit)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Bird size={13} className="text-amber-500" /> {t("shop_ledger.total_birds")}
            </p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{scopeSummary.totalBirds.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Weight size={13} className="text-cyan-500" /> {t("shop_ledger.total_weight_kg")}
            </p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{scopeSummary.totalWeight.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <IndianRupee size={13} className="text-violet-500" /> {t("shop_ledger.closing_balance")}
            </p>
            <p className={`text-xl font-bold tabular-nums ${scopeSummary.closingBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatAmount(scopeSummary.closingBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* ── TABLE — same card & header treatment as the Trip List ────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">{t("shop_ledger.title")}</h3>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">
              {formatDisplayDate(appliedDateFrom)} → {formatDisplayDate(appliedDateTo)}
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50/80 px-2.5 py-1 text-[11px] font-bold text-blue-700 tabular-nums whitespace-nowrap">
              {totalRows === 0 ? t("shop_ledger.no_rows") : t("shop_ledger.row_count", { count: totalRows })}
              {appliedSelectedShop !== "All Shops" ? ` · ${appliedSelectedShop}` : ""}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-700 shadow-sm">
                <tr>
                  {/* Flat 2D icons — no solid tiles, just the coloured glyph */}
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("date", <CalendarDays size={16} className="text-indigo-500 shrink-0" />, t("common.date"))}
                  </th>
                  {/* Day of week — a quick glance column beside the date */}
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <CalendarRange size={16} className="text-blue-500 shrink-0" />
                      {t("common.day")}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("particulars", <Store size={16} className="text-emerald-500 shrink-0" />, t("shop_ledger.col.particulars"))}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("birds", <Bird size={16} className="text-amber-500 shrink-0" />, t("common.birds"), true)}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("weight", <Weight size={16} className="text-cyan-500 shrink-0" />, t("shop_ledger.col.weight_kg"), true)}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("rate", <IndianRupee size={16} className="text-violet-500 shrink-0" />, t("common.rate"), true)}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("debit", <ArrowUpRight size={16} className="text-green-500 shrink-0" />, t("common.debit"), true)}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    {sortableHeader("credit", <ArrowDownLeft size={16} className="text-sky-500 shrink-0" />, t("common.credit"), true)}
                  </th>
                  {/* Balance is a running total — its order is defined by Date,
                      so it is the one column that never sorts. */}
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <Scale size={16} className="text-slate-500 shrink-0" />
                      {t("common.balance")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm font-medium text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle size={16} className="animate-spin text-emerald-600" aria-hidden="true" />
                        {t("shop_ledger.loading_records")}
                      </span>
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      {t("shop_ledger.no_transactions")}
                    </td>
                  </tr>
                ) : (
                  <>
                    {visibleRows.map((tx, idx) => {
                      const isOpening = idx === 0;
                      const isSale = tx.type === "sale";
                      const paymentMode = normalizePaymentMode(tx.paymentMode);
                      const typeLabel =
                        tx.type === "sale"
                          ? { text: t("shop_ledger.tx_type.sale"), color: "text-emerald-600" }
                          : tx.type === "collection"
                            ? { text: paymentMode ? t("shop_ledger.tx_type.collection_mode", { mode: paymentMode }) : t("shop_ledger.tx_type.collection"), color: "text-blue-600" }
                            : { text: t("shop_ledger.tx_type.correction"), color: "text-rose-600" };
                      return (
                        <tr
                          key={`${isOpening ? "opening" : tx.collectionNo || tx.particulars}-${idx}`}
                          className={`transition-colors ${isOpening ? "bg-amber-50/50 font-semibold" : "hover:bg-slate-50/80"}`}
                        >
                          <td className="px-4 py-3 text-xs font-medium text-slate-600 tabular-nums">{formatDisplayDate(tx.date)}</td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500">{weekdayOf(tx.date, language)}</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700">
                            {/* Opening row label follows the UI language; raw
                                particulars stay untouched (searchable data). */}
                            {isOpening ? t("shop_ledger.opening_balance") : tx.particulars}
                            {!isOpening && (
                              <span className={`ml-2 text-[10px] font-semibold ${typeLabel.color}`}>
                                {typeLabel.text}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">{isSale ? tx.birds : "-"}</td>
                          <td className="px-4 py-3 text-center text-xs">{isSale ? tx.weight.toFixed(2) : "-"}</td>
                          <td className="px-4 py-3 text-center text-xs">{isSale ? tx.rate.toFixed(2) : "-"}</td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                            {tx.debit > 0 ? formatAmount(tx.debit) : "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-blue-600 whitespace-nowrap tabular-nums">
                            {tx.credit > 0 ? formatAmount(tx.credit) : "-"}
                          </td>
                          {/* Balance always renders on ONE line, never wraps */}
                          <td className={`px-4 py-3 text-center text-xs font-bold whitespace-nowrap tabular-nums ${tx.balance >= 0 ? "text-slate-800" : "text-rose-600"}`}>
                            {formatAmount(tx.balance)}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleRows.length > 1 && (
                      <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                        <td className="px-4 py-3 text-xs text-slate-700" colSpan={3}>{t("shop_ledger.total_row")}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-800">{summary.totalBirds}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-800">{summary.totalWeight.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-800">-</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-emerald-700 whitespace-nowrap tabular-nums">{formatAmount(summary.totalDebit)}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-blue-700 whitespace-nowrap tabular-nums">{formatAmount(summary.totalCredit)}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-800 whitespace-nowrap tabular-nums">{formatAmount(summary.closingBalance)}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* ── GLOBAL PAGINATION — the shared app-wide pager (Trip List,
                 Collections and Shop Ledger all render this one) ───────── */}
          {shouldShowPagination(totalRows) && (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={totalRows}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              disabled={ledgerLoading || ledgerRefreshing}
            />
          )}
        </div>

      {/* ── REFRESHED TOAST (top-right) ─────────────────────── */}
      {refreshToast && (
        <div className="fixed right-4 top-4 z-[200] flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 size={16} />
          </span>
          <span className="text-sm font-semibold text-emerald-800">{t("shop_ledger.refreshed_toast")}</span>
        </div>
      )}

      {/* ── PDF PREVIEW MODAL ──────────────────────────────── */}
      {pdfPreview && activePdfFile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-3 md:p-6">
          <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <FileText size={15} />
                </span>
                <div className="min-w-0">
                  <h3
                    className="truncate text-sm font-bold uppercase tracking-wide text-slate-800"
                    title={activePdfFile.filename}
                  >
                    {t("shop_ledger.pdf_weekly_statement")}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {t("shop_ledger.pdf_date_range", { from: formatDisplayDate(appliedDateFrom), to: formatDisplayDate(appliedDateTo) })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePdfPreview}
                aria-label={t("shop_ledger.pdf_close")}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1">
              {pdfPreview.files.length > 1 && (
                <aside className="flex w-72 shrink-0 flex-col border-r border-slate-100 bg-slate-50/70">
                  {/* Header: title + count chip + selection progress */}
                  <div className="space-y-2.5 border-b border-slate-100 bg-white/70 px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm">
                          <ListChecks size={12} />
                        </span>
                        {t("shop_ledger.select_shops")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                          pdfPreview.selectedShops.length === pdfPreview.files.length
                            ? "bg-red-600 text-white shadow-sm"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {pdfPreview.selectedShops.length} / {pdfPreview.files.length}
                      </span>
                    </div>

                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={pdfPreview.files.length}
                      aria-valuenow={pdfPreview.selectedShops.length}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-500 transition-all duration-200"
                        style={{
                          width: `${
                            pdfPreview.files.length === 0
                              ? 0
                              : Math.round((pdfPreview.selectedShops.length / pdfPreview.files.length) * 100)
                          }%`,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllPdfShops}
                        className={`flex h-7 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition ${
                          pdfPreview.selectedShops.length === pdfPreview.files.length
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <CheckSquare size={11} /> All
                      </button>
                      <button
                        type="button"
                        onClick={clearPdfShops}
                        disabled={pdfPreview.selectedShops.length === 0}
                        className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Square size={11} /> None
                      </button>
                    </div>

                    <div className="relative">
                      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={pdfShopSearch}
                        onChange={(e) => setPdfShopSearch(e.target.value)}
                        placeholder={t("shop_ledger.pdf_search_placeholder")}
                        aria-label={t("shop_ledger.pdf_search_aria")}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
                      />
                      {pdfShopSearch && (
                        <button
                          type="button"
                          onClick={() => setPdfShopSearch("")}
                          aria-label={t("shop_ledger.pdf_clear_search")}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shop list */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
                    {/* Combined view card */}
                    <button
                      type="button"
                      onClick={() => setActivePdfShop(-1)}
                      className={`mb-1.5 flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left shadow-sm transition ${
                        pdfPreview.selectedIndex === -1
                          ? "border-red-200 bg-red-50 ring-1 ring-red-300"
                          : "border-slate-200/80 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${
                          pdfPreview.selectedIndex === -1
                            ? "bg-gradient-to-br from-red-500 to-rose-600"
                            : "bg-gradient-to-br from-slate-500 to-slate-700"
                        }`}
                      >
                        <Layers size={13} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-xs ${
                            pdfPreview.selectedIndex === -1 ? "font-bold text-red-700" : "font-semibold text-slate-700"
                          }`}
                        >
                          All Shops
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          Combined statement · {pdfPreview.files.length} shops
                        </span>
                      </span>
                    </button>

                    <div className="space-y-0.5">
                      {pdfFilteredFiles.map((file) => {
                        const fileIndex = pdfPreview.files.findIndex((f) => f.shop === file.shop);
                        const isActive = pdfPreview.selectedIndex === fileIndex;
                        const isSelected = pdfPreview.selectedShops.includes(file.shop);
                        const isBusy = pdfBusyShop === file.shop;
                        return (
                          <div
                            key={file.shop}
                            className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                              isActive
                                ? "border-red-200 bg-red-50/70 ring-1 ring-red-300"
                                : isSelected
                                  ? "border-red-100 bg-red-50/40"
                                  : "border-transparent hover:border-slate-200/70 hover:bg-white"
                            }`}
                          >
            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePdfShop(file.shop)}
                              aria-label={t("shop_ledger.pdf_include_shop", { shop: file.shop })}
                              className="h-4 w-4 shrink-0 cursor-pointer accent-red-600"
                            />
                            <button
                              type="button"
                              onClick={() => setActivePdfShop(fileIndex, file.shop)}
                              title={file.shop}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition ${
                                  isSelected ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {file.shop.charAt(0).toUpperCase()}
                              </span>
                              <span
                                className={`min-w-0 flex-1 truncate text-xs transition ${
                                  isActive ? "font-bold text-red-700" : isSelected ? "font-medium text-slate-700" : "text-slate-600"
                                }`}
                              >
                                {file.shop}
                              </span>
                            </button>
                            {isBusy ? (
                              <Loader2 size={13} className="shrink-0 animate-spin text-red-500" />
                            ) : file.url ? (
                              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" aria-label={t("shop_ledger.pdf_ready")} />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {pdfFilteredFiles.length === 0 && (
                      <p className="px-2 py-4 text-center text-xs text-slate-400">No shops match “{pdfShopSearch}”.</p>
                    )}
                    {pdfShopSearch && pdfFilteredFiles.length > 0 && (
                      <p className="mt-1.5 px-2 text-center text-[10px] font-medium text-slate-400">
                        Showing {pdfFilteredFiles.length} of {pdfPreview.files.length} shops
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 border-t border-slate-100 bg-white/70 px-3.5 py-3">
                    <button
                      type="button"
                      onClick={() => void handleDownloadSelectedShops()}
                      disabled={pdfPreview.selectedShops.length === 0}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-xs font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-red-500 disabled:hover:to-rose-600"
                    >
                      <Download size={13} />
                      Download selected ({pdfPreview.selectedShops.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadSelectedCombined()}
                      disabled={pdfPreview.selectedShops.length === 0}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FileStack size={13} />
                      Download selected as one PDF
                    </button>
                  </div>
                </aside>
              )}

              <div className="min-w-0 flex-1 bg-slate-200/60">
                {activePdfFile.url ? (
                  <PdfBlobPreview key={activePdfFile.url} url={activePdfFile.url} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                    <Loader2 size={16} className="animate-spin text-red-500" />
                    Generating preview for {activePdfFile.shop}…
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={closePdfPreview}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <p className="text-[11px] font-medium text-slate-400">
                Use the shop panel to download selected shops or one combined PDF.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP MODAL ─────────────────────────────────── */}
      {whatsappOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-3 md:p-6">
          <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
                  <ShopLedgerWhatsAppIcon size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{t("shop_ledger.wa.title")}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWhatsApp}
                aria-label={t("shop_ledger.wa.close")}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Top bar — same dropdown chrome as the page toolbar */}
            <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={opsFilterLabelClass}>{t("shop_ledger.report_type")}</label>
                <MasterDropdown
                  hideLabel
                  label={t("shop_ledger.report_type")}
                  value={waReportType === "All" ? "" : waReportType}
                  options={[
                    { value: "Sales", label: t("shop_ledger.type.sales") },
                    { value: "Collection", label: t("shop_ledger.type.collection") },
                  ]}
                  onChange={(next) => {
                    setWaReportType((next as WaReportType) || "All");
                    resetWaSucceeded();
                  }}
                  placeholder={t("shop_ledger.wa.type_all")}
                  searchable
                  allowClear
                  className="w-full"
                />
              </div>
              <div>
                <label className={opsFilterLabelClass}>{t("shop_ledger.wa.date_from")}</label>
                <DatePicker
                  value={waDateFrom}
                  onChange={(value) => {
                    setWaDateFrom(value);
                    resetWaSucceeded();
                    resetWaAttachment();
                  }}
                  placeholder={t("shop_ledger.wa.from_placeholder")}
                  className="w-full"
                />
              </div>
              <div>
                <label className={opsFilterLabelClass}>{t("shop_ledger.wa.date_to")}</label>
                <DatePicker
                  value={waDateTo}
                  onChange={(value) => {
                    setWaDateTo(value);
                    resetWaSucceeded();
                    resetWaAttachment();
                  }}
                  placeholder={t("shop_ledger.wa.to_placeholder")}
                  className="w-full"
                />
              </div>
              <div>
                <label className={opsFilterLabelClass}>{t("shop_ledger.wa.recipient")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "selected" as const, label: t("shop_ledger.wa.recipient_selected") },
                    { value: "all" as const, label: t("shop_ledger.wa.recipient_all") },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setWaScope(opt.value);
                        setWaConfirmAll(false);
                        resetWaSucceeded();
                      }}
                      className={`h-[38px] rounded-lg border text-xs font-medium transition ${
                        waScope === opt.value
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1">
              {/* Left: shop selector */}
              <aside className="flex w-72 shrink-0 flex-col border-r border-slate-100 bg-slate-50/60">
                <div className="space-y-2 border-b border-slate-100 px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {waScope === "all" ? t("shop_ledger.wa.all_shops_scope") : t("shop_ledger.select_shops")}
                    </span>
                    {waScope === "selected" && (
                      <span className="rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-bold text-[#1DA851]">
                        {waSelectedShops.length} selected
                      </span>
                    )}
                  </div>
                  {waScope === "selected" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWaSelectedShops(waAllShopNames)}
                        className="h-7 flex-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaSelectedShops([])}
                        className="h-7 flex-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        None
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={waShopSearch}
                      onChange={(e) => setWaShopSearch(e.target.value)}
                      placeholder={t("shop_ledger.wa.search_shops")}
                      aria-label={t("shop_ledger.wa.search_shops_aria")}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/25 focus:border-[#25D366]/50"
                    />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">
                    This week from {formatDisplayDate(currentWeekKey)} · total {waWeekTotal} send(s)
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  {waVisibleShops.map((shop) => {
                    const recipient = resolveWaRecipient(shop);
                    const weekCount = weeklySendCount(waSendCounts, currentWeekKey, shop);
                    const isSending = waSendingShop === shop;
                    const shopSucceeded = waSucceededShops.includes(shop);
                    const isPreview = waPreviewShop === shop;
                    return (
                      <div
                        key={shop}
                        className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${
                          isPreview ? "bg-[#25D366]/10 ring-1 ring-[#25D366]/30" : "hover:bg-white"
                        }`}
                      >
                        {waScope === "selected" && (
                          <input
                            type="checkbox"
                            checked={waSelectedShops.includes(shop)}
                            onChange={() => toggleWaShop(shop)}
                            aria-label={t("shop_ledger.wa.send_to", { shop })}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#25D366]"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setWaPreviewShop(shop);
                            resetWaAttachment();
                          }}
                          title={shop}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs font-semibold text-slate-700">{shop}</span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {recipient.ownerName || t("shop_ledger.wa.shop_owner")} · {recipient.whatsappNumber || t("shop_ledger.wa.no_number")}
                          </span>
                        </button>
                        {isSending ? (
                          <Loader2 size={13} className="mt-1 shrink-0 animate-spin text-[#25D366]" />
                        ) : shopSucceeded ? (
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                        ) : weekCount > 0 ? (
                          <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            {weekCount}×
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {waVisibleShops.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-slate-400">No shops match “{waShopSearch}”.</p>
                  )}
                </div>

                <div className="border-t border-slate-100 px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() => void sendWhatsApp()}
                    disabled={waSending}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1DA851] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {waSending ? <Loader2 size={14} className="animate-spin" /> : <ShopLedgerWhatsAppIcon size={14} />}
                    {waSending
                      ? `${t("shop_ledger.wa.sending")}${waSendingShop ? `: ${waSendingShop}` : "…"}`
                      : waScope === "all"
                        ? waConfirmAll
                          ? t("shop_ledger.wa.confirm_send_all")
                          : t("shop_ledger.wa.send_all")
                        : t("shop_ledger.wa.send_selected", { count: waSelectedShops.length })}
                  </button>
                  {waScope === "all" && waConfirmAll && !waSending && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
                      {t("shop_ledger.wa.confirm_all", { count: waAllShopNames.length })}
                    </p>
                  )}
                </div>
              </aside>

              {/* Right: recipient details + message preview */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {waPreviewShop && waPreviewRecipient ? (
                    <>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 text-xs">
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">{t("shop_ledger.wa.shop_label")}</span>{" "}
                            <span className="text-slate-700">{waPreviewShop}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">{t("shop_ledger.wa.owner_label")}</span>{" "}
                            <span className="text-slate-700">{waPreviewRecipient.ownerName || t("shop_ledger.wa.shop_owner")}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">{t("shop_ledger.wa.whatsapp_label")}</span>{" "}
                            <span className="text-slate-700">{waPreviewRecipient.whatsappNumber || t("shop_ledger.wa.not_available")}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">{t("shop_ledger.wa.sent_this_week")}</span>{" "}
                            <span className="text-slate-700">
                              {t("shop_ledger.wa.times_count", { count: weeklySendCount(waSendCounts, currentWeekKey, waPreviewShop) })}
                            </span>
                          </div>
                        </div>
                        {weeklySendCount(waSendCounts, currentWeekKey, waPreviewShop) > 0 &&
                          waLastSent[weeklySendKey(currentWeekKey, waPreviewShop)] && (
                            <div className="mt-1 min-w-0">
                              <span className="font-semibold text-slate-500">{t("shop_ledger.wa.last_sent")}</span>{" "}
                              <span className="text-slate-600">
                                {waLastSent[weeklySendKey(currentWeekKey, waPreviewShop)]}
                              </span>
                            </div>
                          )}
                      </div>

                      <div>
                        <label className={opsFilterLabelClass}>{t("shop_ledger.wa.message_preview")}</label>
                        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-3 font-sans text-[11px] leading-relaxed text-slate-700">
                          {waPreviewMessage}
                        </pre>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm">
                            <FileText size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-700" title={waPreviewFileName}>
                              {waPreviewFileName}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400">
                              {t("shop_ledger.wa.pdf_attachment", { from: formatDisplayDate(waDateFrom), to: formatDisplayDate(waDateTo) })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleWaToggleAttachmentPreview}
                            disabled={waAttachmentBusy && !waAttachmentOpen}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {waAttachmentBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : waAttachmentOpen ? (
                              <EyeOff size={12} />
                            ) : (
                              <Eye size={12} />
                            )}
                            {waAttachmentOpen ? t("shop_ledger.pdf_hide") : t("shop_ledger.pdf_check")}
                          </button>
                          <button
                            type="button"
                            onClick={handleWaDownloadAttachment}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                          >
                            <Download size={12} /> Download
                          </button>
                        </div>

                        {waAttachmentOpen && (
                          <div className="mt-3 h-80 overflow-hidden rounded-lg border border-slate-200 bg-slate-200/60">
                            {waAttachmentUrl ? (
                              <PdfBlobPreview key={waAttachmentUrl} url={waAttachmentUrl} />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                                <Loader2 size={15} className="animate-spin text-red-500" />
                                Building the attachment for {waPreviewShop}…
                              </div>
                            )}
                          </div>
                        )}

                        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                          This is the exact PDF the shop owner receives — built from the report type and
                          date range above. Verify it before sending.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Select a shop on the left to preview its WhatsApp message.</p>
                  )}

                  {waError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800">
                      {waError}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                  <button
                    type="button"
                    onClick={closeWhatsApp}
                    disabled={waSending}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopLedgerPage;
