import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bird,
  BookOpen,
  Calendar,
  CalendarDays,
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
import { makeT, useI18n, type Language } from "../../../i18n";
import { DatePicker } from "../../../components/common/DatePicker";
import { apiPost } from "../../../api";
import { AppShellModal, BrandRefreshButton, Pagination } from "../../../ui";
import ViewLanguageToggle from "../../../ui/ViewLanguageToggle";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../masters/components/MasterDropdown";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../shared/ui/operationsStyles";
import {
  shouldShowPagination,
  PAGINATION_DEFAULT_PAGE_SIZE,
} from "../../../shared/ui/paginationStyles";
import { exportToExcel } from "../../../utils/exportUtils";
import {
  fetchShopLedger,
  fetchShopLedgerCumulativeQuantities,
  type ShopLedgerResponse,
  type ShopLedgerRow,
} from "../services/shopLedgerService";
import {
  generateShopLedgerPDF,
  buildShopLedgerCumulativeRows,
  prepareShopLedgerPdfAssets,
} from "../components/ShopLedgerPDF";
import type {
  LedgerTransaction,
  ShopLedgerCumulativeRow,
  ShopLedgerPdfEntry,
} from "../components/ShopLedgerPDF";
import PdfBlobPreview from "../components/PdfBlobPreview";
import { prefetchPdfJs } from "../components/pdfJsLoader";
import { formatLedgerNumber, roundLedgerValue } from "../utils/shopLedgerRounding";
import {
  filterStatementByType,
  recalculateStatementBalances,
} from "../utils/shopLedgerBalances";

interface ShopLedgerProps {
  embedded?: boolean;
}

type ReportTypeFilter = "all" | "sales" | "collection";
type WaReportType = "All" | "Sales" | "Collection";
type LedgerViewMode = "transactions" | "cumulative";

interface WhatsAppSendPayload {
  reportType: WaReportType;
  dateFrom: string;
  dateTo: string;
  scope: "selected";
  shopName: string;
  recipient: string;
  ownerName: string;
  shopWhatsApp: string;
  message: string;
  pdfBase64: string;
  fileName: string;
}

interface PdfPreviewState {
  files: { shop: string; url: string | null; filename: string }[];
  selectedIndex: number;
  selectedShops: string[];
  shopData: Record<string, LedgerTransaction[]>;
}

const WHATSAPP_BACKEND_ENABLED =
  import.meta.env.VITE_WHATSAPP_BACKEND_ENABLED === "true";

const WA_SEND_COUNT_STORAGE_KEY = "dmr-shop-ledger-whatsapp-weekly-send-counts";
const WA_LAST_SENT_STORAGE_KEY = "dmr-shop-ledger-whatsapp-weekly-last-sent";

// Global pagination — one page-size system for the whole app (Trip List,
// Collections, Shop Ledger all share it).
const DEFAULT_PAGE_SIZE = PAGINATION_DEFAULT_PAGE_SIZE;

/** Columns the ledger may be sorted by. Balance is deliberately excluded —
 *  it is a running total whose order is defined by Date, never by size. */
type LedgerSortKey =
  "date" | "particulars" | "birds" | "weight" | "rate" | "debit" | "credit";

/** Stable, direction-aware comparator for ledger rows (opening row excluded
 *  by the caller — it is pinned first and never sorted). */
function compareLedgerTx(
  a: LedgerTransaction,
  b: LedgerTransaction,
  key: LedgerSortKey,
): number {
  if (key === "date") return a.date.localeCompare(b.date);
  if (key === "particulars")
    return a.particulars.localeCompare(b.particulars, undefined, {
      numeric: true,
    });
  return (a[key] ?? 0) - (b[key] ?? 0);
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
    farmBirds: isSale ? row.farmBirds : 0,
    farmWeight: isSale ? row.farmWeight : 0,
    mortalityBirds: isSale ? row.mortalityBirds : 0,
    mortalityWeight: isSale ? row.mortalityWeight : 0,
    weightLoss: isSale ? row.weightLoss : 0,
    rate: isSale ? row.rate : 0,
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
    balance: Number(row.balance) || 0,
    type: row.type,
    paymentMode: row.paymentMode ?? undefined,
    collectionNo: row.referenceNo || undefined,
    loadLabel: isSale && row.loadLabel ? row.loadLabel : undefined,
    subShopName: row.subShopName?.trim() || undefined,
    remarks: row.remarks?.trim() || undefined,
  };
};

/**
 * Fixed Shop Ledger reporting window requested for the current reconciliation.
 * Keep ISO values internally; the calendar renders these as 02/08/2026 and
 * 09/08/2026. Initial load, Reset, and clearing the date pill all use it.
 */
function defaultWeekRange(): { from: string; to: string } {
  return {
    from: "2026-08-02",
    to: "2026-08-09",
  };
}

const toDateDefault = () => defaultWeekRange().to;
const toWeekAgoDefault = () => defaultWeekRange().from;

/** yyyy-MM-dd → dd-MM-yyyy (day-month-year) for table cells and exports. */
const formatDisplayDate = (value: string): string => {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
/** Telugu short weekdays — same order as WEEKDAY_SHORT (Sunday first). The
 *  active language decides which set renders; underlying dates never change. */
const WEEKDAY_SHORT_TE = [
  "ఆది",
  "సోమ",
  "మంగళ",
  "బుధ",
  "గురు",
  "శుక్ర",
  "శని",
] as const;

/** yyyy-MM-dd → short weekday ("Mon" / "సోమ"). Parsed LOCALLY — a UTC parse
 *  would roll the day back one in IST and label Tuesday rows as Monday. */
const weekdayOf = (value: string, language: "en" | "te" = "en"): string => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "";
  const [year, month, day] = parts;
  const dow = new Date(year, month - 1, day).getDay();
  return (language === "te" ? WEEKDAY_SHORT_TE : WEEKDAY_SHORT)[dow];
};

/** Compact ledger date: "Sun, 9 Aug 2026" (weekday follows UI language). */
const formatLedgerDateWithDay = (
  value: string,
  language: "en" | "te" = "en",
): string => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return value;
  const [year, month, day] = parts;
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(
    new Date(year, month - 1, day),
  );
  return `${weekdayOf(value, language)}, ${day} ${monthLabel} ${year}`;
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
  const dedupeRows = (rows: ShopLedgerRow[]): ShopLedgerRow[] => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = row.id > 0
        ? `${row.type}:id:${row.id}`
        : `${row.shopId}:${row.type}:${row.referenceType}:${row.referenceId}:${row.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  if (totalPages <= 1) return { ...first, data: dedupeRows(first.data) };
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchShopLedger({ ...filters, page: index + 2, limit: 500 }),
    ),
  );
  return {
    ...first,
    data: dedupeRows([
      ...first.data,
      ...rest.flatMap((page) => page.data),
    ]),
  };
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
  `₹ ${formatLedgerNumber(value)}`;

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

const weeklySendKey = (weekStart: string, shop: string): string =>
  `${weekStart}:${shop}`;

function weeklySendCount(
  counts: Record<string, number> | undefined,
  weekStart: string,
  shop: string,
): number {
  return counts?.[weeklySendKey(weekStart, shop)] || 0;
}

function loadStoredRecord<T extends string | number>(
  key: string,
): Record<string, T> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: Record<string, T> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(
      ([entryKey, value]) => {
        if (typeof value === typeof ("" as T) && value !== null) {
          out[entryKey] = value as T;
        }
      },
    );
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
  viewLanguage: Language,
): string {
  const reportLabel =
    reportType === "All" ? "All (Sales & Collection)" : reportType;
  if (viewLanguage === "te") {
    const teluguReportLabel =
      reportType === "All"
        ? "అన్నీ (అమ్మకాలు & కలెక్షన్)"
        : reportType === "Sales"
          ? "అమ్మకాలు"
          : "కలెక్షన్";
    return [
      "DMR Poultries",
      `షాప్ లెడ్జర్ నివేదిక - ${teluguReportLabel}`,
      "",
      `షాప్: ${shop}`,
      `యజమాని: ${ownerName}`,
      `కాలం: ${formatDisplayDate(dateFrom)} నుండి ${formatDisplayDate(dateTo)} వరకు`,
      "",
      `ప్రియమైన ${ownerName},`,
      `${shop} కోసం ${formatDisplayDate(dateFrom)} నుండి ${formatDisplayDate(dateTo)} వరకు ${teluguReportLabel} షాప్ లెడ్జర్ నివేదికను జతచేశాము.`,
      "",
      `జతచేసిన PDF: ${fileName}`,
      "",
      "ధన్యవాదాలు.",
      "అభివాదములతో,",
      "DMR Poultries",
    ].join("\n");
  }
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
  const [viewMode, setViewMode] = useState<LedgerViewMode>("transactions");
  const [selectedCumulativeShop, setSelectedCumulativeShop] = useState<string | null>(null);

  // Applied values are committed only when the user clicks Search. The input
  // controls above are draft values; changing them does not affect the table
  // or KPIs until Search is pressed.
  const [appliedDateFrom, setAppliedDateFrom] = useState(toWeekAgoDefault);
  const [appliedDateTo, setAppliedDateTo] = useState(toDateDefault);
  const [appliedSelectedShop, setAppliedSelectedShop] = useState("All Shops");
  const [appliedReportType, setAppliedReportType] =
    useState<ReportTypeFilter>("all");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLedgerRowIndex, setSelectedLedgerRowIndex] = useState(-1);
  const ledgerRowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  /** Trip-List style explicit sort — null means natural ledger order.
   *  A ledger statement reads chronologically, so filtered results default to
   *  oldest first. Users can still explicitly choose another sort afterward. */
  const [sortBy, setSortBy] = useState<LedgerSortKey | null>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [ledgerData, setLedgerData] = useState<LedgerTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerRefreshing, setLedgerRefreshing] = useState(false);
  /** Holds an i18n KEY (not display text) so the fetch effect never needs
   *  `t` in its deps — switching language re-renders the translated banner
   *  without refetching data (no spinner flicker on language change). */
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const refreshNotifyRef = useRef(false);
  const ledgerNotificationRef = useRef({ showNotification, t });
  useEffect(() => {
    ledgerNotificationRef.current = { showNotification, t };
  }, [showNotification, t]);

  const selectedShopId = useMemo(() => {
    return appliedSelectedShop === "All Shops"
      ? undefined
      : shopMasterMap.get(appliedSelectedShop)?.id;
  }, [appliedSelectedShop, shopMasterMap]);

  const buildLedger = useCallback(
    async (
      from: string,
      to: string,
      shopId?: number,
    ): Promise<LedgerTransaction[]> => {
      const res = await fetchAllLedgerPages({
        fromDate: from,
        toDate: to,
        shopId,
      });

      let openingTotal: number;
      let body: LedgerTransaction[];

      if (shopId != null) {
        // Single shop — the backend returns the authoritative opening balance
        // and true per-row running balances. By construction the previous
        // week's closing is exactly this week's opening.
        openingTotal = Number(res.openingBalance) || 0;
        body = res.data.map(mapRowToTx);
      } else {
        // ALL SHOPS uses the same backend-authoritative historical opening as
        // a single-shop request. Never reconstruct it from the mutable Shop
        // Master current balance.
        openingTotal = Number(res.openingBalance) || 0;
        body = res.data.map(mapRowToTx);
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
    [],
  );

  useEffect(() => {
    let cancelled = false;
    // All-shops opening/closing balances require Shop Master balances. Wait
    // for that source instead of issuing a throwaway request and then loading
    // the same table a second time when masters arrive.
    if (appliedSelectedShop === "All Shops" && shops.length === 0) return;

    buildLedger(appliedDateFrom, appliedDateTo, selectedShopId)
      .then((tx) => {
        if (!cancelled) {
          setLedgerLoading(false);
          setLedgerRefreshing(false);
          setLedgerError(null);
          setLedgerData(tx);
          if (refreshNotifyRef.current) {
            refreshNotifyRef.current = false;
            const notification = ledgerNotificationRef.current;
            notification.showNotification(
              notification.t("notification.data_refreshed"),
              "success",
            );
          }
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
  }, [
    appliedDateFrom,
    appliedDateTo,
    appliedSelectedShop,
    selectedShopId,
    buildLedger,
    refreshNonce,
    shops.length,
  ]);

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
      if (appliedReportType === "collection" && tx.type !== "collection")
        return false;
      if (!appliedSearchTerm.trim()) return true;
      const needle = appliedSearchTerm.trim().toLowerCase();
      return [
        tx.date,
        tx.particulars,
        tx.collectionNo,
        tx.loadLabel,
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

    return recalculateStatementBalances([...opening, ...scoped]);
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

  const selectLedgerRow = useCallback(
    (index: number) => {
      if (visibleRows.length === 0) return;
      const next = Math.max(0, Math.min(index, visibleRows.length - 1));
      setSelectedLedgerRowIndex(next);
      window.requestAnimationFrame(() => ledgerRowRefs.current[next]?.focus());
    },
    [visibleRows.length],
  );

  const handleLedgerRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectLedgerRow(index + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selectLedgerRow(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        selectLedgerRow(0);
      } else if (event.key === "End") {
        event.preventDefault();
        selectLedgerRow(visibleRows.length - 1);
      }
    },
    [selectLedgerRow, visibleRows.length],
  );

  const activeSelectedLedgerRowIndex =
    selectedLedgerRowIndex >= 0 && selectedLedgerRowIndex < visibleRows.length
      ? selectedLedgerRowIndex
      : -1;

  // A row selection is temporary UI state. Touching/clicking anywhere that is
  // not another ledger row clears it without interfering with the control the
  // user actually clicked.
  useEffect(() => {
    if (activeSelectedLedgerRowIndex < 0) return;
    const clearOutsideRow = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-shop-ledger-row]")) {
        setSelectedLedgerRowIndex(-1);
      }
    };
    document.addEventListener("pointerdown", clearOutsideRow);
    return () => document.removeEventListener("pointerdown", clearOutsideRow);
  }, [activeSelectedLedgerRowIndex]);

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
    const openingBalance =
      filteredLedger.length > 0 ? filteredLedger[0].balance : 0;
    // The accounting identity: Closing = Opening + Sales − Collections. For a
    // single shop this equals the last running balance; for All Shops it is
    // the combined closing outstanding across every shop.
    const closingBalance = round2(openingBalance + totalDebit - totalCredit);
    return {
      openingBalance,
      totalDebit,
      totalCredit,
      totalBirds,
      totalWeight,
      closingBalance,
    };
  }, [filteredLedger]);

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
    async (
      from: string,
      to: string,
      shop: string,
    ): Promise<LedgerTransaction[] | null> => {
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

  // One bulk ledger request can build every shop statement because each row
  // already carries its backend-authoritative per-shop running balance. This
  // replaces the old N+1 flow (up to 200 sequential requests) that made PDF
  // preview take minutes. Failed promises are evicted so Retry is honest.
  const bulkPdfLedgerCacheRef = useRef<
    Map<string, Promise<ShopLedgerPdfEntry[]>>
  >(new Map());
  const getBulkPdfLedgers = useCallback(
    (from: string, to: string): Promise<ShopLedgerPdfEntry[]> => {
      // Versioned so an older hot-reload cache that was built while Shop
      // Master was empty can never keep serving an empty statement forever.
      const key = `ledger-v3|${refreshNonce}|${from}|${to}`;
      const cached = bulkPdfLedgerCacheRef.current.get(key);
      if (cached) return cached;

      // The all-shops response includes backend-authoritative historical
      // openings per shop, identical to individual shop requests.
      const request = fetchAllLedgerPages({
        fromDate: from,
        // The cumulative view only needs the selected period. Fetching all
        // activity through today made historical two-date filters download
        // many unnecessary pages and could time out into a false empty state.
        toDate: to,
      })
        .then((response) => {
          const openingByShopId = new Map(
            (response.openingBalances ?? []).map((row) => [row.shopId, row.openingBalance]),
          );
          const openingByShopName = new Map(
            (response.openingBalances ?? []).map((row) => [row.shopName, row.openingBalance]),
          );
          const allRowsByShop = new Map<string, ShopLedgerRow[]>();
          const seenRows = new Set<string>();
          for (const row of response.data) {
            if (!row.shopName) continue;
            const identity = `${row.shopId ?? row.shopName}:${row.type}:${row.id}`;
            if (seenRows.has(identity)) continue;
            seenRows.add(identity);
            const rows = allRowsByShop.get(row.shopName) ?? [];
            rows.push(row);
            allRowsByShop.set(row.shopName, rows);
          }

          // The ledger response is authoritative and must render even if the
          // separately loaded Shop Master request is still pending or failed.
          // Master metadata only enriches rows; it never decides whether a
          // valid backend ledger row exists.
          const shopNames = new Set<string>([
            ...shops.map((master) => master.shopName),
            ...allRowsByShop.keys(),
            ...(response.openingBalances ?? []).map((row) => row.shopName),
          ]);
          return [...shopNames]
            .map((shop) => {
              const allRows = allRowsByShop.get(shop) ?? [];
              return [shop, allRows.filter((row) => row.date <= to)] as const;
            })
            .sort(([a], [b]) =>
              a.localeCompare(b, "en", { sensitivity: "base" }),
            )
            .map(([shop, periodRows]) => {
              const master = shopMasterMap.get(shop);
              const allRows = allRowsByShop.get(shop) ?? [];
              const rowShopId = allRows.find((row) => row.shopId != null)?.shopId;
              const openingBalance = round2(
                openingByShopId.get(master?.id ?? rowShopId ?? 0) ??
                openingByShopName.get(shop) ??
                0,
              );
              periodRows.sort(
                (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
              );
              let running = openingBalance;
              const transactions = periodRows.map((row) => {
                running = round2(running + row.debit - row.credit);
                const transaction = mapRowToTx(row);
                transaction.balance = running;
                return transaction;
              });
              const opening: LedgerTransaction = {
                date: from,
                particulars: "Opening Balance",
                birds: 0,
                weight: 0,
                rate: 0,
                debit: 0,
                credit: 0,
                balance: openingBalance,
                type: "sale",
              };
              return {
                shop,
                data: [opening, ...transactions],
                ownerName: master?.ownerName || undefined,
                mobile: master?.phoneNumber || undefined,
                city: master?.city || undefined,
              };
            });
        })
        .catch((error) => {
          bulkPdfLedgerCacheRef.current.delete(key);
          throw error;
        });

      bulkPdfLedgerCacheRef.current.set(key, request);
      while (bulkPdfLedgerCacheRef.current.size > 4) {
        const oldest = bulkPdfLedgerCacheRef.current.keys().next().value;
        if (oldest === undefined) break;
        bulkPdfLedgerCacheRef.current.delete(oldest);
      }
      return request;
    },
    [refreshNonce, shopMasterMap, shops],
  );

  const [cumulativeRows, setCumulativeRows] = useState<ShopLedgerCumulativeRow[]>([]);
  const [cumulativeLoading, setCumulativeLoading] = useState(true);
  const [cumulativeError, setCumulativeError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const quantitiesPromise = appliedReportType === "collection"
        ? Promise.resolve([])
        : fetchShopLedgerCumulativeQuantities({
            fromDate: appliedDateFrom,
            toDate: appliedDateTo,
          });
      let rows: ShopLedgerCumulativeRow[];
      if (appliedSelectedShop === "All Shops") {
        const statements = await getBulkPdfLedgers(appliedDateFrom, appliedDateTo);
        rows = buildShopLedgerCumulativeRows(
          statements.map((entry) => ({
            ...entry,
            // Keep the carried opening row, but aggregate only the activity
            // selected by the report filter for this date span.
            data: filterStatementByType(entry.data, appliedReportType),
          })),
        );
      } else {
        rows = buildShopLedgerCumulativeRows([
          {
            shop: appliedSelectedShop,
            data: filterStatementByType(ledgerData, appliedReportType),
          },
        ]);
      }
      const quantities = await quantitiesPromise;
      if (appliedReportType === "collection") return rows;
      const byShop = new Map(quantities.map((item) => [item.shopName, item]));
      const merged = rows.map((row) => {
        const quantity = byShop.get(row.shop);
        return quantity ? {
          ...row,
          birds: quantity.birds,
          weight: quantity.weight,
          mortalityBirds: quantity.mortalityBirds,
          mortalityWeight: quantity.mortalityWeight,
          weightLoss: quantity.weightLoss,
        } : row;
      });
      const existing = new Set(merged.map((row) => row.shop));
      for (const quantity of quantities) {
        if (existing.has(quantity.shopName)) continue;
        merged.push({
          shop: quantity.shopName,
          birds: quantity.birds,
          weight: quantity.weight,
          farmBirds: quantity.birds + quantity.mortalityBirds,
          farmWeight: quantity.weight + quantity.mortalityWeight + quantity.weightLoss,
          mortalityBirds: quantity.mortalityBirds,
          mortalityWeight: quantity.mortalityWeight,
          weightLoss: quantity.weightLoss,
          openingBalance: 0,
          sale: 0,
          collection: 0,
          closingBalance: 0,
        });
      }
      return merged.sort((a, b) => a.shop.localeCompare(b.shop, "en", { sensitivity: "base" }));
    };
    setCumulativeLoading(true);
    setCumulativeError(null);
    void load()
      .then((rows) => {
        if (!cancelled) setCumulativeRows(rows);
      })
      .catch((cause) => {
        if (!cancelled) {
          setCumulativeRows([]);
          setCumulativeError(
            cause instanceof Error ? cause.message : "Unable to load the selected ledger range.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCumulativeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    appliedDateFrom,
    appliedDateTo,
    appliedSelectedShop,
    appliedReportType,
    ledgerData,
    getBulkPdfLedgers,
  ]);

  const visibleCumulativeRows = useMemo(() => {
    const needle = appliedSearchTerm.trim().toLowerCase();
    if (!needle) return cumulativeRows;
    return cumulativeRows.filter((row) =>
      [
        row.shop,
        row.farmBirds,
        row.birds,
        row.mortalityBirds,
        row.farmWeight,
        row.weight,
        row.mortalityWeight,
        row.weightLoss,
        row.openingBalance,
        row.sale,
        row.collection,
        row.closingBalance,
      ].some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [cumulativeRows, appliedSearchTerm]);

  const cumulativeTotalPages = Math.max(
    1,
    Math.ceil(visibleCumulativeRows.length / pageSize),
  );
  const cumulativeSafePage = Math.min(currentPage, cumulativeTotalPages);
  const pagedCumulativeRows = useMemo(() => {
    const start = (cumulativeSafePage - 1) * pageSize;
    return visibleCumulativeRows.slice(start, start + pageSize);
  }, [visibleCumulativeRows, cumulativeSafePage, pageSize]);

  const cumulativeTotals = useMemo(
    () =>
      visibleCumulativeRows.reduce(
        (sum, row) => ({
          birds: sum.birds + row.birds,
          weight: sum.weight + row.weight,
          farmBirds: sum.farmBirds + row.farmBirds,
          farmWeight: sum.farmWeight + row.farmWeight,
          mortalityBirds: sum.mortalityBirds + row.mortalityBirds,
          mortalityWeight: sum.mortalityWeight + row.mortalityWeight,
          weightLoss: sum.weightLoss + row.weightLoss,
          openingBalance: sum.openingBalance + row.openingBalance,
          sale: sum.sale + row.sale,
          collection: sum.collection + row.collection,
          closingBalance: sum.closingBalance + row.closingBalance,
        }),
        {
          birds: 0, weight: 0, farmBirds: 0, farmWeight: 0,
          mortalityBirds: 0, mortalityWeight: 0, weightLoss: 0,
          openingBalance: 0, sale: 0, collection: 0, closingBalance: 0,
        },
      ),
    [visibleCumulativeRows],
  );

  // ─── PDF preview modal state ────────────────────────────────
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [pdfViewLanguage, setPdfViewLanguage] = useState<Language>(language);
  const pdfT = useMemo(() => makeT(pdfViewLanguage), [pdfViewLanguage]);
  const [pdfShopSearch, setPdfShopSearch] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const pdfPreviewRef = useRef<PdfPreviewState | null>(null);
  // Synchronous in-flight guard — state alone cannot stop a double-click
  // race because both clicks read the same render's state.
  const pdfGeneratingRef = useRef(false);
  const pdfDownloadBusyRef = useRef(false);
  const ensureShopPdfRef = useRef<
    ((shop: string) => Promise<string | null>) | null
  >(null);
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

  // Warm the viewer and immutable letterhead while the browser is idle. This
  // keeps the table interactive and removes their network/canvas cost from the
  // user's first PDF click.
  useEffect(() => {
    const warm = () => {
      prefetchPdfJs();
      void prepareShopLedgerPdfAssets().catch(() => undefined);
    };
    const id = window.setTimeout(warm, 500);
    return () => window.clearTimeout(id);
  }, []);

  const revokePdfUrls = (state: PdfPreviewState | null) => {
    if (!state) return;
    const urls = new Set<string>();
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

    try {
      setPdfGenerating(true);
      setPdfViewLanguage(language);

      // All Shops is one paginated bulk read, not one request per shop. For a
      // single shop, reuse the same filter-keyed cache as the visible table.
      const allLedgers: ShopLedgerPdfEntry[] =
        appliedSelectedShop === "All Shops"
          ? await getBulkPdfLedgers(appliedDateFrom, appliedDateTo)
          : await (async () => {
              const ledger = await getCachedLedger(
                appliedDateFrom,
                appliedDateTo,
                appliedSelectedShop,
              );
              if (!ledger || ledger.length === 0) return [];
              const master = shopMasterMap.get(appliedSelectedShop);
              return [
                {
                  shop: appliedSelectedShop,
                  data: ledger,
                  ownerName: master?.ownerName || undefined,
                  mobile: master?.phoneNumber || undefined,
                  city: master?.city || undefined,
                },
              ];
            })();

      if (allLedgers.length === 0) {
        showNotification(t("shop_ledger.no_export_data"), "error");
        return;
      }

      if (exportSessionRef.current !== session) return;

      revokePdfUrls(pdfPreviewRef.current);
      const shopData = Object.fromEntries(
        allLedgers.map((entry) => [
          entry.shop,
          filterStatementByType(entry.data, appliedReportType),
        ]),
      );
      const files = allLedgers.map(({ shop }) => ({
        shop,
        url: null,
        filename: `WeeklyStatement_${shop.replace(/\s+/g, "_")}_${formatDisplayDate(appliedDateFrom)}_to_${formatDisplayDate(appliedDateTo)}.pdf`,
      }));
      const nextState: PdfPreviewState = {
        files,
        selectedIndex: 0,
        // PDF and WhatsApp both open with every shop in the applied page
        // scope selected. Users can narrow the list with the shared left-side
        // selector; there is never an ambiguous null selection.
        selectedShops: files.map((file) => file.shop),
        shopData,
      };
      pdfPreviewRef.current = nextState;
      setPdfPreview(nextState);
      setPdfShopSearch("");

      // Paint the modal immediately, then prepare/render only its first shop.
      // A combined PDF is generated only after the user chooses shops.
      prefetchPdfJs();
      window.setTimeout(
        () => void ensureShopPdfRef.current?.(files[0].shop),
        0,
      );
    } catch {
      showNotification(t("shop_ledger.load_failed"), "error");
    } finally {
      pdfGeneratingRef.current = false;
      setPdfGenerating(false);
      setPdfProgress(null);
    }
  }, [
    appliedSelectedShop,
    appliedDateFrom,
    appliedDateTo,
    appliedReportType,
    showNotification,
    shopMasterMap,
    getCachedLedger,
    getBulkPdfLedgers,
    t,
    language,
  ]);

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
    return pdfPreview.files.filter((file) =>
      file.shop.toLowerCase().includes(needle),
    );
  }, [pdfPreview, pdfShopSearch]);

  const activePdfFile = pdfPreview?.files[pdfPreview.selectedIndex] ?? null;

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
        const assets = await prepareShopLedgerPdfAssets();
        const generated = await generateShopLedgerPDF(
          [
            {
              shop,
              data: ledger,
              ownerName: master?.ownerName || undefined,
              mobile: master?.phoneNumber || undefined,
              city: master?.city || undefined,
            },
          ],
          appliedDateFrom,
          appliedDateTo,
          shop,
          assets,
          undefined,
          {
            includeCumulativeSummary: true,
            cumulativeRows: cumulativeRows.filter((row) => row.shop === shop),
          },
        );
        if (
          exportSessionRef.current !== sessionAtStart ||
          !pdfPreviewRef.current
        ) {
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

  useEffect(() => {
    ensureShopPdfRef.current = ensureShopPdf;
  }, [ensureShopPdf]);

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
      prev
        ? { ...prev, selectedShops: prev.files.map((file) => file.shop) }
        : prev,
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
    const chosen = current.files.filter((file) =>
      current.selectedShops.includes(file.shop),
    );
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
    const assets = await prepareShopLedgerPdfAssets();
    const generated = await generateShopLedgerPDF(
      ledgers,
      appliedDateFrom,
      appliedDateTo,
      label,
      assets,
      undefined,
      {
        includeCumulativeSummary: true,
        cumulativeRows: cumulativeRows.filter((row) =>
          current.selectedShops.includes(row.shop)),
      },
    );
    downloadFile(generated.url, generated.filename);
    window.setTimeout(() => URL.revokeObjectURL(generated.url), 10_000);
    showNotification(
      `Combined PDF with ${ledgers.length} shop(s) downloaded.`,
      "success",
    );
  };

  const handleSearch = useCallback(() => {
    // Report Type and text search are client-side views of the ledger already
    // in memory. Never show a network loader for those changes: no request is
    // needed, and previously this left the table spinner waiting forever.
    const needsLedgerRead =
      dateFrom !== appliedDateFrom ||
      dateTo !== appliedDateTo ||
      selectedShop !== appliedSelectedShop;
    if (needsLedgerRead) {
      setLedgerLoading(true);
      setCumulativeLoading(true);
    }

    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedSelectedShop(selectedShop);
    setAppliedReportType(reportType);
    setAppliedSearchTerm(searchValue);
    // Every newly applied ledger filter starts in accounting order: earliest
    // transaction first, latest transaction last.
    setSortBy("date");
    setSortDir("asc");
    resetPage();
  }, [
    dateFrom,
    dateTo,
    selectedShop,
    reportType,
    searchValue,
    appliedDateFrom,
    appliedDateTo,
    appliedSelectedShop,
    resetPage,
  ]);

  const handleReset = useCallback(() => {
    const defaultFrom = toWeekAgoDefault();
    const defaultTo = toDateDefault();

    const needsLedgerRead =
      appliedDateFrom !== defaultFrom ||
      appliedDateTo !== defaultTo ||
      appliedSelectedShop !== "All Shops";
    if (needsLedgerRead) {
      setLedgerLoading(true);
      setCumulativeLoading(true);
    }

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

    // Reset returns to the page's standard chronological ledger order.
    setSortBy("date");
    setSortDir("asc");
    setCurrentPage(1);
  }, [appliedDateFrom, appliedDateTo, appliedSelectedShop]);

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
  const clearAppliedFilter = useCallback(
    (which: "dates" | "shop" | "type" | "search") => {
      // Dates and Shop change the server query. Type and text search filter the
      // in-memory rows immediately and must never enter the network loader.
      if (which === "dates") {
        setLedgerLoading(true);
        const defaultFrom = toWeekAgoDefault();
        const defaultTo = toDateDefault();
        setDateFrom(defaultFrom);
        setDateTo(defaultTo);
        setAppliedDateFrom(defaultFrom);
        setAppliedDateTo(defaultTo);
      } else if (which === "shop") {
        setLedgerLoading(true);
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
    },
    [],
  );

  // Warm the lazy pdf.js viewer during idle time so the very first PDF
  // click paints the preview without waiting on the library download.
  useEffect(() => {
    const timer = window.setTimeout(() => prefetchPdfJs(), 1_500);
    return () => window.clearTimeout(timer);
  }, []);

  const handleRefresh = useCallback(() => {
    // Targeted content refresh only — never reload the whole page/browser tab.
    setLedgerLoading(true); // Rate-Entry style spinner while records reload
    setLedgerRefreshing(true);
    refreshNotifyRef.current = true;
    setRefreshNonce((n) => n + 1);
  }, []);

  /** Excel export follows the active view toggle exactly. Transactions and
   * cumulative summary deliberately have separate schemas and filenames. */
  const handleExportExcel = useCallback(() => {
    const shopLabel =
      appliedSelectedShop === "All Shops" ? "All Shops" : appliedSelectedShop;
    const safeShopFilename =
      appliedSelectedShop === "All Shops"
        ? "All_Shops"
        : appliedSelectedShop.replace(/\s+/g, "_");

    if (viewMode === "cumulative") {
      if (visibleCumulativeRows.length === 0) {
        showNotification(t("shop_ledger.no_export_rows"), "error");
        return;
      }
      const headers = [
        "S.No",
        "Shop Name",
        "Delivered Birds",
        "Mortality Birds",
        "Delivered Weight (KG)",
        "Mortality Weight (KG)",
        "Weight Loss (KG)",
        "Opening Balance",
        "Sales",
        "Collections",
        "Closing Balance",
      ];
      const data: (string | number)[][] = visibleCumulativeRows.map((row, index) => [
        index + 1,
        row.shop,
        row.birds,
        row.mortalityBirds,
        roundLedgerValue(row.weight),
        roundLedgerValue(row.mortalityWeight),
        roundLedgerValue(row.weightLoss),
        roundLedgerValue(row.openingBalance),
        roundLedgerValue(row.sale),
        roundLedgerValue(row.collection),
        roundLedgerValue(row.closingBalance),
      ]);
      data.push([
        "",
        "TOTAL",
        cumulativeTotals.birds,
        cumulativeTotals.mortalityBirds,
        roundLedgerValue(cumulativeTotals.weight),
        roundLedgerValue(cumulativeTotals.mortalityWeight),
        roundLedgerValue(cumulativeTotals.weightLoss),
        roundLedgerValue(cumulativeTotals.openingBalance),
        roundLedgerValue(cumulativeTotals.sale),
        roundLedgerValue(cumulativeTotals.collection),
        roundLedgerValue(cumulativeTotals.closingBalance),
      ]);
      data.push([
        "",
        "FARM TOTALS",
        cumulativeTotals.birds + cumulativeTotals.mortalityBirds,
        "",
        roundLedgerValue(cumulativeTotals.weight + cumulativeTotals.mortalityWeight + cumulativeTotals.weightLoss),
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      exportToExcel(
        `Shop Ledger — Cumulative — ${shopLabel} (${formatDisplayDate(appliedDateFrom)} to ${formatDisplayDate(appliedDateTo)})`,
        headers,
        data,
        `Shop_Ledger_Cumulative_${safeShopFilename}_${appliedDateFrom}_to_${appliedDateTo}`,
      );
      showNotification(t("shop_ledger.excel_exported"), "success");
      return;
    }

    if (sortedBody.length === 0) {
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
    const data = sortedBody.map((tx) => [
      formatDisplayDate(tx.date),
      weekdayOf(tx.date),
      tx.particulars,
      tx.type === "sale"
        ? "Sale"
        : tx.type === "collection"
          ? "Collection"
          : "Correction",
      normalizePaymentMode(tx.paymentMode) || "-",
      tx.type === "sale" ? tx.birds : 0,
      tx.type === "sale" ? Number(tx.weight.toFixed(2)) : 0,
      tx.type === "sale" ? Number(tx.rate.toFixed(2)) : 0,
      roundLedgerValue(tx.debit),
      roundLedgerValue(tx.credit),
      roundLedgerValue(tx.balance),
    ]);
    const title = `Shop Ledger — Transactions — ${shopLabel} (${formatDisplayDate(appliedDateFrom)} to ${formatDisplayDate(appliedDateTo)})`;
    const filename = `Shop_Ledger_Transactions_${safeShopFilename}_${appliedDateFrom}_to_${appliedDateTo}`;
    exportToExcel(title, headers, data, filename);
    showNotification(t("shop_ledger.excel_exported"), "success");
  }, [
    sortedBody,
    viewMode,
    visibleCumulativeRows,
    cumulativeTotals,
    appliedSelectedShop,
    appliedDateFrom,
    appliedDateTo,
    showNotification,
    t,
  ]);

  // ─── WhatsApp modal state ──────────────────────────────────
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [waViewLanguage, setWaViewLanguage] = useState<Language>(language);
  const waT = useMemo(() => makeT(waViewLanguage), [waViewLanguage]);
  // WhatsApp is a delivery view of the page's applied data, just like PDF.
  // It has no second date/type filter state that can drift from the table.
  const waReportType: WaReportType =
    appliedReportType === "sales"
      ? "Sales"
      : appliedReportType === "collection"
        ? "Collection"
        : "All";
  const waDateFrom = appliedDateFrom;
  const waDateTo = appliedDateTo;
  const [waSending, setWaSending] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waSendingShop, setWaSendingShop] = useState<string | null>(null);
  const [waSendCounts, setWaSendCounts] = useState<Record<string, number>>(() =>
    loadStoredRecord<number>(WA_SEND_COUNT_STORAGE_KEY),
  );
  const [waLastSent, setWaLastSent] = useState<Record<string, string>>(() =>
    loadStoredRecord<string>(WA_LAST_SENT_STORAGE_KEY),
  );
  const [waSelectedShops, setWaSelectedShops] = useState<string[]>([]);
  const [waShopSearch, setWaShopSearch] = useState("");
  const [waPreviewShop, setWaPreviewShop] = useState<string | null>(null);
  // Synchronous send guard (double-click race) plus a per-run success ledger
  // so a retry after partial failure never re-sends to shops that already
  // received the report — no duplicate messages, ever.
  const waSendingRef = useRef(false);
  const waSucceededRef = useRef<string[]>([]);
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
  }, []);

  // Lock background scroll while a modal is open (with scrollbar-width
  // compensation) so the page never jumps or scrolls behind the overlay.
  const anyModalOpen = whatsappOpen || pdfPreview !== null;

  // Route changes must release every object URL even when a modal was not
  // explicitly closed. This prevents PDF/attachment blobs accumulating in a
  // long-running production session.
  useEffect(
    () => () => {
      exportSessionRef.current += 1;
      revokePdfUrls(pdfPreviewRef.current);
      pdfPreviewRef.current = null;
      if (waAttachmentUrlRef.current) {
        URL.revokeObjectURL(waAttachmentUrlRef.current);
        waAttachmentUrlRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!anyModalOpen) return;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
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
    const source = Array.from(
      new Set(shops.map((shop: Shop) => shop.shopName).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    // WhatsApp uses exactly the same applied shop scope as the table and PDF.
    // A specific page shop produces one recipient; All Shops produces the
    // complete recipient list.
    return appliedSelectedShop === "All Shops"
      ? source
      : [appliedSelectedShop];
  }, [shops, appliedSelectedShop]);

  /**
   * WhatsApp recipient for a shop — `whatsappNumber` from Shop Master when
   * present, otherwise the regular `phoneNumber`.
   */
  const resolveWaRecipient = useCallback(
    (
      shop: string,
    ): {
      shop: string;
      ownerName: string;
      phoneNumber: string;
      whatsappNumber: string;
    } => {
      const found = shopMasterMap.get(shop);
      if (!found) {
        return {
          shop,
          ownerName: "Shop Owner",
          phoneNumber: "",
          whatsappNumber: "",
        };
      }
      const whatsapp = String(
        found.whatsappNumber || found.phoneNumber || "",
      ).trim();
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
        const ledger =
          (await getCachedLedger(waDateFrom, waDateTo, shop)) ?? [];
        const master = shopMasterMap.get(shop);
        const generated = await generateShopLedgerPDF(
          [
            {
              shop,
              data: filterStatementByType(ledger, waReportType),
              ownerName: master?.ownerName || undefined,
              mobile: master?.phoneNumber || undefined,
              city: master?.city || undefined,
            },
          ],
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
    [waDateFrom, waDateTo, waReportType, shopMasterMap, getCachedLedger],
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
    // WhatsApp follows the currently applied filters, but its language is a
    // local view preference and never changes the page behind it.
    setWaViewLanguage(language);
    const initial = [...waAllShopNames];
    setWaSelectedShops(initial);
    setWaPreviewShop(initial[0] ?? null);
    setWaShopSearch("");
    setWaError(null);
    resetWaSucceeded();
    resetWaAttachment();
    setWhatsappOpen(true);
  }, [
    waAllShopNames,
    resetWaSucceeded,
    resetWaAttachment,
    language,
  ]);

  const closeWhatsApp = useCallback(() => {
    if (waSendingRef.current) return;
    setWhatsappOpen(false);
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
    () => waAllShopNames.filter((name) => waSelectedShops.includes(name)),
    [waAllShopNames, waSelectedShops],
  );

  const toggleWaShop = (shop: string) => {
    setWaSelectedShops((prev) =>
      prev.includes(shop)
        ? prev.filter((name) => name !== shop)
        : [...prev, shop],
    );
  };

  const waPreviewRecipient = waPreviewShop
    ? resolveWaRecipient(waPreviewShop)
    : null;
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
          waViewLanguage,
        )
      : "";

  const sendWhatsApp = useCallback(async () => {
    if (waSendingRef.current) return;
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
    const pendingTargets = targets.filter(
      (shop) => !waSucceededRef.current.includes(shop),
    );
    if (pendingTargets.length === 0) {
      setWaError(t("shop_ledger.wa.already_sent"));
      return;
    }

    waSendingRef.current = true;
    setWaSending(true);
    setWaError(null);

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
            [
              {
                shop,
                data: filterStatementByType(ledger, waReportType),
                ownerName: waMaster?.ownerName || undefined,
                mobile: waMaster?.phoneNumber || undefined,
                city: waMaster?.city || undefined,
              },
            ],
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
              waViewLanguage,
            );
            const pdfBase64 = await blobToBase64(generated.blob);

            const payload: WhatsAppSendPayload = {
              reportType: waReportType,
              dateFrom: waDateFrom,
              dateTo: waDateTo,
              scope: "selected",
              shopName: recipient.shop,
              recipient: recipient.whatsappNumber,
              ownerName: recipient.ownerName,
              shopWhatsApp: recipient.whatsappNumber,
              message,
              pdfBase64,
              fileName: generated.filename,
            };

            await apiPost("/operations/shop-ledger/whatsapp", payload, {
              timeout: 60_000,
            });
          } finally {
            URL.revokeObjectURL(generated.url);
          }

          // Only after the backend confirmed delivery do we count the send
          // and record it as done for this modal run (dedupes any retry).
          successCount += 1;
          waSucceededRef.current = [...waSucceededRef.current, shop];
          const key = weeklySendKey(weekStart, shop);
          setWaSendCounts((prev) => ({
            ...prev,
            [key]: (prev?.[key] || 0) + 1,
          }));
          setWaLastSent((prev) => ({
            ...prev,
            [key]: new Date().toLocaleString(),
          }));
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
      showNotification(
        `WhatsApp report sent to ${successCount} shop(s).`,
        "success",
      );
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
    waTargetShops,
    waDateFrom,
    waDateTo,
    currentWeekKey,
    resolveWaRecipient,
    shopMasterMap,
    buildLedger,
    waReportType,
    waViewLanguage,
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
    { value: "all", label: t("common.all") },
    { value: "sales", label: t("shop_ledger.type.sales") },
    { value: "collection", label: t("shop_ledger.type.collection") },
  ];

  /** Field name + direction — the exact Sort By model the Trip List uses. */
  const sortOptions: MasterDropdownOption[] = [
    { value: "date:asc", label: t("shop_ledger.sort.date_asc") },
    { value: "date:desc", label: t("shop_ledger.sort.date_desc") },
    { value: "particulars:asc", label: t("shop_ledger.sort.particulars_asc") },
    {
      value: "particulars:desc",
      label: t("shop_ledger.sort.particulars_desc"),
    },
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
    const pills: {
      key: "dates" | "shop" | "type" | "search";
      label: string;
      value: string;
    }[] = [];
    const defaultFrom = toWeekAgoDefault();
    const defaultTo = toDateDefault();
    if (appliedDateFrom !== defaultFrom || appliedDateTo !== defaultTo) {
      pills.push({
        key: "dates",
        label: t("common.date"),
        value: `${formatDisplayDate(appliedDateFrom)} → ${formatDisplayDate(appliedDateTo)}`,
      });
    }
    if (appliedSelectedShop !== "All Shops") {
      pills.push({
        key: "shop",
        label: t("common.shop"),
        value: appliedSelectedShop,
      });
    }
    if (appliedReportType !== "all") {
      pills.push({
        key: "type",
        label: t("common.type"),
        value:
          appliedReportType === "sales"
            ? t("shop_ledger.type.sales")
            : t("shop_ledger.type.collection"),
      });
    }
    if (appliedSearchTerm.trim()) {
      pills.push({
        key: "search",
        label: t("common.search"),
        value: appliedSearchTerm.trim(),
      });
    }
    return pills;
  }, [
    appliedDateFrom,
    appliedDateTo,
    appliedSelectedShop,
    appliedReportType,
    appliedSearchTerm,
    t,
  ]);

  /** Static column header. Sorting is controlled centrally by Sort By so the
   *  transaction and cumulative header rows keep one clean visual language. */
  const sortableHeader = (
    key: LedgerSortKey,
    icon: React.ReactNode,
    label: string,
    center = false,
  ) => {
    void key;
    return (
      <span
        className={`flex items-center gap-2 w-full uppercase tracking-wider font-bold text-[12px] ${
          center ? "justify-center" : ""
        }`}
      >
        {icon}
        <span className="whitespace-nowrap">{label}</span>
      </span>
    );
  };

  // ─── UI — Trip-List style toolbar, pills, table and global pagination ───
  return (
    <div
      className={`w-full space-y-5 animate-in fade-in duration-200 text-slate-800 ${
        embedded ? "" : "px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen"
      }`}
    >
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
              value={reportType}
              options={reportTypeOptions}
              onChange={(next) =>
                setReportType((next as ReportTypeFilter) || "all")
              }
              placeholder={t("common.all")}
              className="w-full"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <ArrowUpDown
                size={17}
                className="text-violet-500 flex-shrink-0"
              />
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
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
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
            <button
              type="button"
              onClick={handleSearch}
              className={`group relative ${opsPrimaryButtonClass}`}
              aria-label={t("common.search")}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-search)]">
                <Search size={15} />
              </span>
              {t("common.search")}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className={`group relative ${opsSecondaryButtonClass}`}
              aria-label={t("common.reset")}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
                <RotateCcw size={14} />
              </span>
              {t("common.reset")}
            </button>
            <BrandRefreshButton onClick={handleRefresh} />
            <button
              type="button"
              onClick={() => void handleExportPDF()}
              disabled={pdfGenerating}

              className={`group relative ${opsPdfButtonClass} disabled:opacity-60`}
              aria-label="PDF"
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-pdf)]">
                {pdfGenerating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileText size={15} />
                )}
              </span>
              {pdfProgress ?? "PDF"}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={
                viewMode === "cumulative"
                  ? cumulativeLoading || visibleCumulativeRows.length === 0
                  : sortedBody.length === 0
              }
              className={`group relative ${opsExcelButtonClass} disabled:opacity-60`}
              aria-label="Excel"
            >
              <span
                className={`inline-flex ${
                  (viewMode === "cumulative" ? visibleCumulativeRows.length > 0 : sortedBody.length > 0)
                    ? "motion-safe:group-hover:animate-[var(--animate-action-excel)]"
                    : ""
                }`}
              >
                <FileSpreadsheet size={15} />
              </span>
              Excel
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            {t("shop_ledger.applied_filters")}
          </span>
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
                  aria-label={t("shop_ledger.clear_filter", {
                    label: pill.label,
                  })}
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
      {appliedSelectedShop !== "All Shops" && (
      <div>
        <div className="flex items-end justify-between gap-3 mb-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <BarChart3 size={14} className="text-emerald-500" />
            {t("shop_ledger.statement_overview")}
            {appliedSelectedShop !== "All Shops" && (
              <span className="normal-case tracking-normal font-semibold text-slate-400">
                — {appliedSelectedShop}
              </span>
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 tabular-nums">
            {totalRows === scopeRows
              ? t("shop_ledger.tx_count", { count: scopeRows.toLocaleString() })
              : t("shop_ledger.tx_showing", {
                  shown: totalRows.toLocaleString(),
                  total: scopeRows.toLocaleString(),
                })}
          </p>
        </div>
        <div
          className={`grid grid-cols-2 gap-4 ${appliedSelectedShop === "All Shops" ? "max-w-2xl" : "sm:grid-cols-3 lg:grid-cols-6"}`}
        >
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Scale size={13} className="text-indigo-500" />{" "}
              {t("shop_ledger.opening_balance")}
            </p>
            <p className="text-xl font-bold text-indigo-600 tabular-nums">
              {formatAmount(summary.openingBalance)}
            </p>
          </div>
          {appliedSelectedShop !== "All Shops" && (
            <>
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ArrowUpRight size={13} className="text-emerald-500" />{" "}
                  {t("shop_ledger.total_sales_debit")}
                </p>
                <p className="text-xl font-bold text-emerald-600 tabular-nums">
                  {formatAmount(summary.totalDebit)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ArrowDownLeft size={13} className="text-blue-500" />{" "}
                  {t("shop_ledger.total_collections_credit")}
                </p>
                <p className="text-xl font-bold text-blue-600 tabular-nums">
                  {formatAmount(summary.totalCredit)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Bird size={13} className="text-amber-500" />{" "}
                  {t("shop_ledger.total_birds")}
                </p>
                <p className="text-xl font-bold text-slate-800 tabular-nums">
                  {summary.totalBirds.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Weight size={13} className="text-cyan-500" />{" "}
                  {t("shop_ledger.total_weight_kg")}
                </p>
                <p className="text-xl font-bold text-slate-800 tabular-nums">
                  {summary.totalWeight.toFixed(2)}
                </p>
              </div>
            </>
          )}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <IndianRupee size={13} className="text-violet-500" />{" "}
              {t("shop_ledger.closing_balance")}
            </p>
            <p
              className={`text-xl font-bold tabular-nums ${summary.closingBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {formatAmount(summary.closingBalance)}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* ── TABLE — same card & header treatment as the Trip List ────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-50/80 border border-teal-100 flex items-center justify-center text-teal-600 shadow-inner">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {t("shop_ledger.title")}
            </h3>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              role="switch"
              aria-checked={viewMode === "cumulative"}
              aria-label={t("shop_ledger.view_mode")}
              onClick={() => {
                const nextMode = viewMode === "transactions" ? "cumulative" : "transactions";
                setViewMode(nextMode);
                setCurrentPage(1);
                if (nextMode === "transactions") setSelectedCumulativeShop(null);
                else setSelectedLedgerRowIndex(-1);
              }}
              className={`group relative grid min-h-11 min-w-[272px] grid-cols-2 overflow-hidden rounded-full border p-1 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 ${
                viewMode === "transactions"
                  ? "border-emerald-300/70 bg-emerald-50/90 shadow-inner shadow-emerald-200/70 focus-visible:ring-emerald-400/60"
                  : "border-indigo-300/70 bg-indigo-50/90 shadow-inner shadow-indigo-200/70 focus-visible:ring-indigo-400/60"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${
                  viewMode === "transactions"
                    ? "left-1 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30"
                    : "left-[50%] bg-gradient-to-r from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30"
                }`}
              />
              <span className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors duration-300 ${viewMode === "transactions" ? "text-white" : "text-emerald-700"}`}>
                <ListChecks size={15} strokeWidth={2.5} aria-hidden="true" />
                {t("shop_ledger.view.transactions")}
              </span>
              <span className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors duration-300 ${viewMode === "cumulative" ? "text-white" : "text-indigo-700"}`}>
                <Layers size={15} strokeWidth={2.5} aria-hidden="true" />
                {t("shop_ledger.view.cumulative")}
              </span>
            </button>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">
              {formatDisplayDate(appliedDateFrom)} →{" "}
              {formatDisplayDate(appliedDateTo)}
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50/80 px-2.5 py-1 text-[11px] font-bold text-blue-700 tabular-nums whitespace-nowrap">
              {(viewMode === "cumulative" ? visibleCumulativeRows.length : totalRows) === 0
                ? t("shop_ledger.no_rows")
                : t("shop_ledger.row_count", {
                    count: viewMode === "cumulative" ? visibleCumulativeRows.length : totalRows,
                  })}
              {appliedSelectedShop !== "All Shops"
                ? ` · ${appliedSelectedShop}`
                : ""}
            </span>
          </div>
        </div>
        <div className={`${viewMode === "transactions" ? "block" : "hidden"} max-h-[70vh] overflow-auto`}>
          <table className="w-full min-w-[1180px] table-fixed text-sm">
            {/* S.No and the combined Day/Date stay compact. The six operational
                and amount columns retain their existing widths unchanged. */}
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[12%]" />
              <col className="w-[17.34%]" />
              <col className="w-[11.11%]" />
              <col className="w-[11.11%]" />
              <col className="w-[11.11%]" />
              <col className="w-[11.11%]" />
              <col className="w-[11.11%]" />
              <col className="w-[11.12%]" />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 text-slate-700 shadow-sm">
              <tr>
                {/* Flat 2D icons — no solid tiles, just the coloured glyph */}
                <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  {t("shop_ledger.col.s_no")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "date",
                    <CalendarDays
                      size={16}
                      className="text-indigo-500 shrink-0"
                    />,
                    t("shop_ledger.col.date_day"),
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "particulars",
                    <Store size={16} className="text-emerald-500 shrink-0" />,
                    t("shop_ledger.col.particulars"),
                  )}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "birds",
                    <Bird size={16} className="text-amber-500 shrink-0" />,
                    t("common.birds"),
                    true,
                  )}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "weight",
                    <Weight size={16} className="text-cyan-500 shrink-0" />,
                    t("shop_ledger.col.weight_short_kg"),
                    true,
                  )}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "rate",
                    <IndianRupee
                      size={16}
                      className="text-violet-500 shrink-0"
                    />,
                    t("common.rate"),
                    true,
                  )}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "debit",
                    <ArrowUpRight
                      size={16}
                      className="text-green-500 shrink-0"
                    />,
                    t("common.debit"),
                    true,
                  )}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  {sortableHeader(
                    "credit",
                    <ArrowDownLeft
                      size={16}
                      className="text-sky-500 shrink-0"
                    />,
                    t("common.credit"),
                    true,
                  )}
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
                  <td
                    colSpan={9}
                    className="py-16 text-center text-sm font-medium text-slate-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle
                        size={16}
                        className="animate-spin text-emerald-600"
                        aria-hidden="true"
                      />
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
                        ? {
                            text: t("shop_ledger.tx_type.sale"),
                            color: "text-emerald-600",
                          }
                        : tx.type === "collection"
                          ? {
                              text: paymentMode
                                ? t("shop_ledger.tx_type.collection_mode", {
                                    mode: paymentMode,
                                  })
                                : t("shop_ledger.tx_type.collection"),
                              color: "text-blue-600",
                            }
                          : {
                              text: t("shop_ledger.tx_type.sale"),
                              color: "text-emerald-600",
                            };
                    const isSelected = activeSelectedLedgerRowIndex === idx;
                    return (
                      <tr
                        key={`${isOpening ? "opening" : tx.collectionNo || tx.particulars}-${idx}`}
                        data-shop-ledger-row
                        ref={(element) => {
                          ledgerRowRefs.current[idx] = element;
                        }}
                        tabIndex={isSelected || (activeSelectedLedgerRowIndex < 0 && idx === 0) ? 0 : -1}
                        aria-selected={isSelected}
                        onFocus={() => setSelectedLedgerRowIndex(idx)}
                        onBlur={(event) => {
                          const next = event.relatedTarget;
                          if (!(next instanceof Element) || !next.closest("[data-shop-ledger-row]")) {
                            setSelectedLedgerRowIndex(-1);
                          }
                        }}
                        onClick={(event) => {
                          if (isSelected) {
                            setSelectedLedgerRowIndex(-1);
                            event.currentTarget.blur();
                            return;
                          }
                          setSelectedLedgerRowIndex(idx);
                          event.currentTarget.focus();
                        }}
                        onKeyDown={(event) => handleLedgerRowKeyDown(event, idx)}
                        className={`group/ledger-row cursor-pointer outline-none transition-[background-color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                          isSelected
                            ? "bg-emerald-50 shadow-[inset_4px_0_0_#10b981] hover:bg-emerald-100/80"
                            : isOpening
                              ? "bg-amber-50/50 font-semibold hover:bg-amber-100 hover:shadow-[inset_3px_0_0_#fbbf24]"
                              : "hover:bg-emerald-50 hover:shadow-[inset_3px_0_0_#6ee7b7]"
                        }`}
                      >
                        <td className="px-2 py-3 text-center text-xs font-semibold text-slate-500 tabular-nums">
                          {isOpening ? "-" : (safePage - 1) * pageSize + idx}
                        </td>
                        <td className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap tabular-nums">
                          {formatLedgerDateWithDay(tx.date, language)}
                        </td>
                        <td className="overflow-hidden px-4 py-3 text-xs font-medium text-slate-700">
                          {/* Opening row label follows the UI language; raw
                                particulars stay untouched (searchable data). */}
                          {isOpening ? (
                            t("shop_ledger.opening_balance")
                          ) : (
                            <span
                              className="block truncate whitespace-nowrap"
                              title={[
                                tx.particulars,
                                tx.subShopName,
                                typeLabel.text,
                                tx.remarks,
                              ].filter(Boolean).join(", ")}
                            >
                              {[tx.particulars, tx.subShopName]
                                .filter(Boolean)
                                .join(", ")}
                              <span className={`font-semibold ${typeLabel.color}`}>
                                {`, ${typeLabel.text}`}
                              </span>
                              {tx.remarks ? (
                                <span className="font-normal italic text-slate-500">
                                  {` — ${tx.remarks}`}
                                </span>
                              ) : null}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {isSale ? tx.birds : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {isSale ? tx.weight.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {isSale ? tx.rate.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                          {tx.debit > 0 ? formatAmount(tx.debit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-blue-600 whitespace-nowrap tabular-nums">
                          {tx.credit > 0 ? formatAmount(tx.credit) : "-"}
                        </td>
                        {/* Balance always renders on ONE line, never wraps */}
                        <td
                          className={`px-4 py-3 text-center text-xs font-bold whitespace-nowrap tabular-nums ${tx.balance >= 0 ? "text-slate-800" : "text-rose-600"}`}
                        >
                          {formatAmount(tx.balance)}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length > 0 && (
                    <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                      <td
                        className="px-4 py-3 text-xs text-slate-700"
                        colSpan={3}
                      >
                        {t("shop_ledger.closing_balance")}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">
                        {summary.totalBirds}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">
                        {summary.totalWeight.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">
                        -
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                        {formatAmount(summary.totalDebit)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-blue-700 whitespace-nowrap tabular-nums">
                        {formatAmount(summary.totalCredit)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-800 whitespace-nowrap tabular-nums">
                        {formatAmount(summary.closingBalance)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {viewMode === "cumulative" && (
          <div className="max-h-[70vh] overflow-auto animate-in fade-in slide-in-from-right-1 duration-200">
            <table className="w-full min-w-[1550px] text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 text-slate-700 shadow-sm">
                <tr className="text-xs font-bold uppercase tracking-wider">
                  <th className="px-3 py-3"><span className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap"><ListChecks size={15} className="text-indigo-500" />{t("shop_ledger.col.s_no")}</span></th>
                  <th className="px-3 py-3"><span className="inline-flex w-full items-center gap-1.5 whitespace-nowrap"><Store size={15} className="text-emerald-500" />{t("common.shop")}</span></th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">{t("ops.mortality.col.delivered_birds")}</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">{t("ops.mortality.col.mortality")}</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">{t("ops.mortality.col.delivery_weight")}</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">{t("ops.mortality.col.mortality_weight")}</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">{t("ops.mortality.col.weight_loss")}</th>
                  <th className="px-3 py-3"><span className="inline-flex w-full items-center justify-end gap-1.5 whitespace-nowrap"><Scale size={15} className="text-indigo-500" />{t("shop_ledger.col.opening")}</span></th>
                  <th className="px-3 py-3"><span className="inline-flex w-full items-center justify-end gap-1.5 whitespace-nowrap"><ArrowUpRight size={15} className="text-emerald-500" />{t("shop_ledger.col.sale")}</span></th>
                  <th className="px-3 py-3"><span className="inline-flex w-full items-center justify-end gap-1.5 whitespace-nowrap"><ArrowDownLeft size={15} className="text-blue-500" />{t("shop_ledger.col.collection")}</span></th>
                  <th className="px-3 py-3"><span className="inline-flex w-full items-center justify-end gap-1.5 whitespace-nowrap"><IndianRupee size={15} className="text-violet-500" />{t("shop_ledger.col.closing")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cumulativeLoading ? (
                  <tr><td colSpan={11} className="py-16 text-center text-sm font-medium text-slate-400"><span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin text-emerald-600" />{t("shop_ledger.loading_records")}</span></td></tr>
                ) : cumulativeError ? (
                  <tr><td colSpan={11} className="py-12 text-center text-rose-600 font-semibold">Could not load this ledger range: {cumulativeError}</td></tr>
                ) : visibleCumulativeRows.length === 0 ? (
                  <tr><td colSpan={11} className="py-12 text-center text-slate-400">{t("shop_ledger.no_transactions")}</td></tr>
                ) : (
                  <>
                    {pagedCumulativeRows.map((row, index) => {
                      const selected = selectedCumulativeShop === row.shop;
                      return (
                      <tr
                        key={row.shop}
                        onClick={() => setSelectedCumulativeShop(selected ? null : row.shop)}
                        className={`cursor-pointer transition-colors ${selected ? "bg-emerald-100/80 shadow-[inset_4px_0_0_#10b981]" : "hover:bg-emerald-50/80"}`}
                      >
                        <td className="px-3 py-3 text-center text-xs font-semibold text-slate-500">{(cumulativeSafePage - 1) * pageSize + index + 1}</td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-800 truncate" title={row.shop}>{row.shop}</td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums">{row.birds.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums">{row.mortalityBirds.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums">{row.weight.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums">{row.mortalityWeight.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums text-amber-700">{row.weightLoss.toFixed(2)}</td>
                        {[row.openingBalance, row.sale, row.collection, row.closingBalance].map((value, valueIndex) => (
                          <td key={valueIndex} className={`px-3 py-3 text-right text-xs font-bold whitespace-nowrap tabular-nums ${value < 0 ? "text-rose-600" : valueIndex === 2 ? "text-blue-600" : valueIndex === 1 ? "text-emerald-600" : "text-slate-800"}`}>
                            {formatAmount(value)}
                          </td>
                        ))}
                      </tr>
                    )})}
                    <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-bold">
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 text-xs text-slate-800">{t("shop_ledger.total_row")}</td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums">
                        <div>{formatLedgerNumber(cumulativeTotals.birds)}</div>
                        <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">Farm Birds {formatLedgerNumber(cumulativeTotals.birds + cumulativeTotals.mortalityBirds)}</div>
                      </td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums">{cumulativeTotals.mortalityBirds.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums">
                        <div>{cumulativeTotals.weight.toFixed(2)}</div>
                        <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">Farm Weight {formatLedgerNumber(cumulativeTotals.weight + cumulativeTotals.mortalityWeight + cumulativeTotals.weightLoss)}</div>
                      </td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums">{cumulativeTotals.mortalityWeight.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums text-amber-700">{cumulativeTotals.weightLoss.toFixed(2)}</td>
                      {[cumulativeTotals.openingBalance, cumulativeTotals.sale, cumulativeTotals.collection, cumulativeTotals.closingBalance].map((value, valueIndex) => (
                        <td key={valueIndex} className={`px-3 py-3 text-right text-xs whitespace-nowrap tabular-nums ${value < 0 ? "text-rose-600" : "text-slate-800"}`}>{formatAmount(value)}</td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── GLOBAL PAGINATION — the shared app-wide pager (Trip List,
                 Collections and Shop Ledger all render this one) ───────── */}
        {viewMode === "transactions" && shouldShowPagination(totalRows) && (
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
        {viewMode === "cumulative" && shouldShowPagination(visibleCumulativeRows.length) && (
          <Pagination
            page={cumulativeSafePage}
            pageSize={pageSize}
            totalItems={visibleCumulativeRows.length}
            onPageChange={(page) => {
              setCurrentPage(page);
              setSelectedCumulativeShop(null);
            }}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
              setSelectedCumulativeShop(null);
            }}
            disabled={cumulativeLoading || ledgerRefreshing}
          />
        )}
      </div>

      {/* ── PDF PREVIEW MODAL ──────────────────────────────── */}
      {pdfPreview && activePdfFile && (
        <AppShellModal
          open
          onClose={closePdfPreview}
          zIndex={110}
          ariaLabelledBy="shop-ledger-pdf-title"
          panelClassName="h-full bg-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <FileText size={15} />
              </span>
              <div className="min-w-0">
                <h3
                  id="shop-ledger-pdf-title"
                  className="truncate text-sm font-bold uppercase tracking-wide text-slate-800"
                >
                  {pdfT("shop_ledger.pdf_weekly_statement")}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {pdfT("shop_ledger.pdf_date_range", {
                    from: formatDisplayDate(appliedDateFrom),
                    to: formatDisplayDate(appliedDateTo),
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ViewLanguageToggle
                language={pdfViewLanguage}
                onToggle={() =>
                  setPdfViewLanguage((current) =>
                    current === "en" ? "te" : "en",
                  )
                }
                tone="emerald"
                labelMode="target"
                ariaLabel={
                  pdfViewLanguage === "te"
                    ? "ఇంగ్లీష్‌కు మార్చండి"
                    : "Switch to Telugu"
                }
              />
              <button
                type="button"
                onClick={closePdfPreview}
                aria-label={pdfT("shop_ledger.pdf_close")}
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
              >
                <X
                  size={16}
                  className="transition-transform duration-200 group-hover:rotate-90"
                />
              </button>
            </div>
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
                      {pdfT("shop_ledger.select_shops")}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                        pdfPreview.selectedShops.length ===
                        pdfPreview.files.length
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {pdfPreview.selectedShops.length} /{" "}
                      {pdfPreview.files.length}
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
                            : Math.round(
                                (pdfPreview.selectedShops.length /
                                  pdfPreview.files.length) *
                                  100,
                              )
                        }%`,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllPdfShops}
                      className={`flex h-7 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition ${
                        pdfPreview.selectedShops.length ===
                        pdfPreview.files.length
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
                    <Search
                      size={13}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={pdfShopSearch}
                      onChange={(e) => setPdfShopSearch(e.target.value)}
                      placeholder={pdfT("shop_ledger.pdf_search_placeholder")}
                      aria-label={pdfT("shop_ledger.pdf_search_aria")}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
                    />
                    {pdfShopSearch && (
                      <button
                        type="button"
                        onClick={() => setPdfShopSearch("")}
                        aria-label={pdfT("shop_ledger.pdf_clear_search")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Shop list */}
                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
                  <div className="space-y-0.5">
                    {pdfFilteredFiles.map((file) => {
                      const fileIndex = pdfPreview.files.findIndex(
                        (f) => f.shop === file.shop,
                      );
                      const isActive = pdfPreview.selectedIndex === fileIndex;
                      const isSelected = pdfPreview.selectedShops.includes(
                        file.shop,
                      );
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
                            aria-label={pdfT("shop_ledger.pdf_include_shop", {
                              shop: file.shop,
                            })}
                            className="h-4 w-4 shrink-0 cursor-pointer accent-red-600"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setActivePdfShop(fileIndex, file.shop)
                            }
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition ${
                                isSelected
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {file.shop.charAt(0).toUpperCase()}
                            </span>
                            <span
                              className={`min-w-0 flex-1 truncate text-xs transition ${
                                isActive
                                  ? "font-bold text-red-700"
                                  : isSelected
                                    ? "font-medium text-slate-700"
                                    : "text-slate-600"
                              }`}
                            >
                              {file.shop}
                            </span>
                          </button>
                          {isBusy ? (
                            <Loader2
                              size={13}
                              className="shrink-0 animate-spin text-red-500"
                            />
                          ) : isActive ? (
                            <Eye
                              size={13}
                              className="shrink-0 text-red-600"
                              aria-label={pdfT("shop_ledger.pdf_ready")}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {pdfFilteredFiles.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-slate-400">
                      No shops match “{pdfShopSearch}”.
                    </p>
                  )}
                  {pdfShopSearch && pdfFilteredFiles.length > 0 && (
                    <p className="mt-1.5 px-2 text-center text-[10px] font-medium text-slate-400">
                      Showing {pdfFilteredFiles.length} of{" "}
                      {pdfPreview.files.length} shops
                    </p>
                  )}
                </div>
              </aside>
            )}

            <div className="min-w-0 flex-1 bg-slate-200/60">
              {activePdfFile.url ? (
                <PdfBlobPreview
                  key={activePdfFile.url}
                  url={activePdfFile.url}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                  <Loader2 size={16} className="animate-spin text-red-500" />
                  {pdfT("shop_ledger.pdf_generating_shop", {
                    shop: activePdfFile.shop,
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
            <button
              type="button"
              onClick={() => void handleDownloadSelectedShops()}
              disabled={pdfPreview.selectedShops.length === 0}
              className="group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-all hover:-translate-y-0.5 hover:bg-red-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Download
                size={13}
                className="transition-transform group-hover:translate-y-0.5"
              />
              {pdfT("shop_ledger.pdf_download_selected", {
                count: pdfPreview.selectedShops.length,
              })}
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadSelectedCombined()}
              disabled={pdfPreview.selectedShops.length === 0}
              className="group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-red-600 hover:to-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <FileStack
                size={13}
                className="transition-transform group-hover:-translate-y-0.5"
              />
              {pdfT("shop_ledger.pdf_download_combined")}
            </button>
            <button
              type="button"
              onClick={closePdfPreview}
              className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
            >
              <X
                size={14}
                className="transition-transform duration-200 group-hover:rotate-90"
              />
              {pdfT("common.close")}
            </button>
          </div>
        </AppShellModal>
      )}

      {/* ── WHATSAPP MODAL ─────────────────────────────────── */}
      {whatsappOpen && (
        <AppShellModal
          open
          onClose={closeWhatsApp}
          zIndex={100}
          ariaLabelledBy="shop-ledger-whatsapp-title"
          panelClassName="h-full bg-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
                <ShopLedgerWhatsAppIcon size={16} />
              </span>
              <div>
                <h3
                  id="shop-ledger-whatsapp-title"
                  className="text-sm font-bold text-slate-800"
                >
                  {waT("shop_ledger.wa.title")}
                </h3>
                <p className="text-[11px] font-medium text-slate-400">
                  {waReportType === "All"
                    ? waT("common.all")
                    : waReportType === "Sales"
                      ? waT("shop_ledger.type.sales")
                      : waT("shop_ledger.type.collection")} · {formatDisplayDate(waDateFrom)} – {formatDisplayDate(waDateTo)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ViewLanguageToggle
                language={waViewLanguage}
                onToggle={() =>
                  setWaViewLanguage((current) =>
                    current === "en" ? "te" : "en",
                  )
                }
                tone="emerald"
                labelMode="target"
                ariaLabel={
                  waViewLanguage === "te"
                    ? "ఇంగ్లీష్‌కు మార్చండి"
                    : "Switch to Telugu"
                }
              />
              <button
                type="button"
                onClick={closeWhatsApp}
                aria-label={waT("shop_ledger.wa.close")}
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95"
              >
                <X
                  size={16}
                  className="transition-transform duration-200 group-hover:rotate-90"
                />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1">
            {/* Left: shop selector */}
            <aside className="flex w-72 shrink-0 flex-col border-r border-slate-100 bg-slate-50/70">
              <div className="space-y-2.5 border-b border-slate-100 bg-white/70 px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#25D366] to-[#1DA851] text-white shadow-sm">
                      <ListChecks size={12} />
                    </span>
                    {waT("shop_ledger.select_shops")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                      waSelectedShops.length === waAllShopNames.length
                        ? "bg-[#25D366] text-white shadow-sm"
                        : "bg-[#25D366]/10 text-[#168a43]"
                    }`}
                  >
                    {waSelectedShops.length} / {waAllShopNames.length}
                  </span>
                </div>

                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={waAllShopNames.length}
                  aria-valuenow={waSelectedShops.length}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#25D366] to-[#1DA851] transition-all duration-200"
                    style={{
                      width: `${waAllShopNames.length === 0 ? 0 : Math.round((waSelectedShops.length / waAllShopNames.length) * 100)}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWaSelectedShops(waAllShopNames)}
                    className={`flex h-7 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition ${
                      waSelectedShops.length === waAllShopNames.length
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckSquare size={11} /> {waT("common.all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaSelectedShops([])}
                    disabled={waSelectedShops.length === 0}
                    className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Square size={11} /> {waT("common.none")}
                  </button>
                </div>

                <div className="relative">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={waShopSearch}
                    onChange={(e) => setWaShopSearch(e.target.value)}
                    placeholder={waT("shop_ledger.wa.search_shops")}
                    aria-label={waT("shop_ledger.wa.search_shops_aria")}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-7 text-xs font-medium text-slate-700 placeholder:font-normal placeholder:text-slate-400 focus:border-[#25D366]/50 focus:outline-none focus:ring-2 focus:ring-[#25D366]/25"
                  />
                  {waShopSearch && (
                    <button
                      type="button"
                      onClick={() => setWaShopSearch("")}
                      aria-label={waT("shop_ledger.pdf_clear_search")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2.5">
                {waVisibleShops.map((shop) => {
                  const recipient = resolveWaRecipient(shop);
                  const isSending = waSendingShop === shop;
                  const isPreview = waPreviewShop === shop;
                  const isSelected = waSelectedShops.includes(shop);
                  return (
                    <div
                      key={shop}
                      className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                        isPreview
                          ? "border-emerald-200 bg-emerald-50/80 ring-1 ring-emerald-300"
                          : isSelected
                            ? "border-emerald-100 bg-emerald-50/40"
                            : "border-transparent hover:border-slate-200/70 hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleWaShop(shop)}
                        aria-label={waT("shop_ledger.wa.send_to", { shop })}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-[#25D366]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setWaPreviewShop(shop);
                          resetWaAttachment();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                            isSelected
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {shop.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-xs ${isPreview ? "font-bold text-emerald-700" : "font-semibold text-slate-700"}`}>
                            {shop}
                          </span>
                          <span className="block truncate text-[10px] font-medium text-slate-400">
                            {recipient.ownerName || waT("shop_ledger.wa.shop_owner")} · {recipient.whatsappNumber || waT("shop_ledger.wa.no_number")}
                          </span>
                        </span>
                      </button>
                      {isSending ? (
                        <Loader2
                          size={13}
                          className="shrink-0 animate-spin text-[#25D366]"
                        />
                      ) : isPreview ? (
                        <Eye
                          size={13}
                          className="shrink-0 text-emerald-600"
                          aria-label={waT("shop_ledger.pdf_ready")}
                        />
                      ) : null}
                    </div>
                  );
                })}
                {waVisibleShops.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-slate-400">
                    No shops match “{waShopSearch}”.
                  </p>
                )}
                {waShopSearch && waVisibleShops.length > 0 && (
                  <p className="mt-1.5 px-2 text-center text-[10px] font-medium text-slate-400">
                    Showing {waVisibleShops.length} of {waAllShopNames.length} shops
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
                          <span className="font-semibold text-slate-500">
                            {waT("shop_ledger.wa.shop_label")}
                          </span>{" "}
                          <span className="text-slate-700">
                            {waPreviewShop}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-500">
                            {waT("shop_ledger.wa.owner_label")}
                          </span>{" "}
                          <span className="text-slate-700">
                            {waPreviewRecipient.ownerName ||
                              waT("shop_ledger.wa.shop_owner")}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-500">
                            {waT("shop_ledger.wa.whatsapp_label")}
                          </span>{" "}
                          <span className="text-slate-700">
                            {waPreviewRecipient.whatsappNumber ||
                              waT("shop_ledger.wa.not_available")}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-500">
                            {waT("shop_ledger.wa.sent_this_week")}
                          </span>{" "}
                          <span className="text-slate-700">
                            {waT("shop_ledger.wa.times_count", {
                              count: weeklySendCount(
                                waSendCounts,
                                currentWeekKey,
                                waPreviewShop,
                              ),
                            })}
                          </span>
                        </div>
                      </div>
                      {weeklySendCount(
                        waSendCounts,
                        currentWeekKey,
                        waPreviewShop,
                      ) > 0 &&
                        waLastSent[
                          weeklySendKey(currentWeekKey, waPreviewShop)
                        ] && (
                          <div className="mt-1 min-w-0">
                            <span className="font-semibold text-slate-500">
                              {waT("shop_ledger.wa.last_sent")}
                            </span>{" "}
                            <span className="text-slate-600">
                              {
                                waLastSent[
                                  weeklySendKey(currentWeekKey, waPreviewShop)
                                ]
                              }
                            </span>
                          </div>
                        )}
                    </div>

                    <div>
                      <label className={opsFilterLabelClass}>
                        {waT("shop_ledger.wa.message_preview")}
                      </label>
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
                          <p
                            className="truncate text-xs font-semibold text-slate-700"
                          >
                            {waPreviewFileName}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400">
                            {waT("shop_ledger.wa.pdf_attachment", {
                              from: formatDisplayDate(waDateFrom),
                              to: formatDisplayDate(waDateTo),
                            })}
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
                          {waAttachmentOpen
                            ? waT("shop_ledger.pdf_hide")
                            : waT("shop_ledger.pdf_check")}
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
                            <PdfBlobPreview
                              key={waAttachmentUrl}
                              url={waAttachmentUrl}
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                              <Loader2
                                size={15}
                                className="animate-spin text-red-500"
                              />
                              Building the attachment for {waPreviewShop}…
                            </div>
                          )}
                        </div>
                      )}

                      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                        This is the exact PDF the shop owner receives — built
                        from the report type and date range above. Verify it
                        before sending.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">
                    Select a shop on the left to preview its WhatsApp message.
                  </p>
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
                  className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                >
                  <X
                    size={14}
                    className="transition-transform duration-200 group-hover:rotate-90"
                  />
                  {waT("common.close")}
                </button>
                <button
                  type="button"
                  onClick={() => void sendWhatsApp()}
                  disabled={waSending || waSelectedShops.length === 0}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1DA851] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {waSending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ShopLedgerWhatsAppIcon size={14} />
                  )}
                  {waSending
                    ? `${waT("shop_ledger.wa.sending")}${waSendingShop ? `: ${waSendingShop}` : "…"}`
                    : waT("shop_ledger.wa.send_selected", {
                        count: waSelectedShops.length,
                      })}
                </button>
              </div>
            </div>
          </div>
        </AppShellModal>
      )}
    </div>
  );
};

export default ShopLedgerPage;
