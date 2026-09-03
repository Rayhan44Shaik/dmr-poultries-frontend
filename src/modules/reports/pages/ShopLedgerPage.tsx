import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { format, subDays } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bird,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Download,
  FileStack,
  FileText,
  IndianRupee,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Square,
  Store,
  Weight,
  X,
} from "lucide-react";
import Select, { type StylesConfig } from "react-select";
import { useShops } from "../../masters/shops/hooks/useShops";
import type { Shop } from "../../masters/shops/types/shop";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { DatePicker } from "../../../components/common/DatePicker";
import { apiPost } from "../../../api";
import {
  fetchShopLedger,
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

interface SelectOption {
  value: string;
  label: string;
}

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

const PAGE_SIZES = [10, 15, 20, 25, 30] as const;
const DEFAULT_PAGE_SIZE = 10;

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

const toDateDefault = () => format(new Date(), "yyyy-MM-dd");
const toWeekAgoDefault = () => format(subDays(new Date(), 7), "yyyy-MM-dd");

/** yyyy-MM-dd → dd-MM-yyyy for display (WhatsApp text, weekly labels). */
const formatDisplayDate = (value: string): string => {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

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

// ── Frontend sample data (verification only) ────────────────────────────────
// The page is seeded with ~50 shops and a mix of sales + collections so the
// ledger table, filters, search, pagination, PDF and badges can be checked.
// No backend or database is touched.
const SAMPLE_SHOP_NAMES = Array.from({ length: 50 }, (_, i) => {
  const names = [
    "Srinivasa", "Lakshmi", "Venkateswara", "Sri Sai", "Balaji",
    "Anjaneya", "Krishna", "Mallikarjuna", "Padmavathi", "Ganesh",
    "Durga", "Vijaya", "Nandini", "Amrutha", "Raghava",
    "Sai", "Karthik", "Teja", "Mahesh", "Naveen",
    "Prasad", "Kiran", "Ravi", "Shiva", "Bhavani",
    "Sarada", "Kali", "Hanuman", "Ranganatha", "Sundara",
    "Chandra", "Surya", "Vamsi", "Harika", "Devi",
    "Mounika", "Pooja", "Reshma", "Chaitanya", "Manoj",
    "Santhosh", "Praveen", "Ramesh", "Suresh", "Ashok",
    "Vinod", "Sravan", "Anand", "Bhaskar", "Murali",
  ];
  return `${names[i]} Chicken Centre`;
});

const SAMPLE_PAYMENT_MODES = ["Cash", "UPI", "Union", "SBI"];

const SAMPLE_OWNER_FIRST_NAMES = [
  "Ramesh", "Suresh", "Anil", "Prakash", "Mohan",
  "Vijay", "Srinivas", "Lakshman", "Narayana", "Gopal",
];

const SAMPLE_OWNER_LAST_NAMES = ["Reddy", "Kumar", "Rao", "Naidu", "Prasad"];

const SAMPLE_CITIES = [
  "Peddapuram",
  "Samarlakota",
  "Rajahmundry",
  "Kakinada",
  "Ramachandrapuram",
  "Vijayawada",
];

/** Deterministic sample city per shop (stable across re-renders). */
const sampleCityFor = (shop: string): string => {
  const idx = Math.max(0, SAMPLE_SHOP_NAMES.indexOf(shop));
  return SAMPLE_CITIES[idx % SAMPLE_CITIES.length];
};

/** Deterministic sample owner + phone per shop (stable across re-renders). */
const sampleRecipientFor = (
  shop: string,
): { ownerName: string; phoneNumber: string; whatsappNumber: string } => {
  const idx = Math.max(0, SAMPLE_SHOP_NAMES.indexOf(shop));
  const ownerName = `${SAMPLE_OWNER_FIRST_NAMES[idx % SAMPLE_OWNER_FIRST_NAMES.length]} ${
    SAMPLE_OWNER_LAST_NAMES[idx % SAMPLE_OWNER_LAST_NAMES.length]
  }`;
  const phone = `98${String(40000000 + idx * 11111111).slice(0, 8)}`;
  return { ownerName, phoneNumber: phone, whatsappNumber: phone };
};

function makeSampleLedger(
  from: string,
  to: string,
  shopName?: string
): LedgerTransaction[] {
  const fromTime = new Date(`${from}T00:00:00`).getTime();
  const toTime = new Date(`${to}T23:59:59`).getTime();
  const shops = shopName && shopName !== "All Shops"
    ? [shopName]
    : SAMPLE_SHOP_NAMES;

  const spanDays = Math.max(1, Math.round((toTime - fromTime) / 86400000) + 1);

  // Opening balance from a deterministic value per shop.
  let balance = 0;
  const rows: LedgerTransaction[] = [
    {
      date: from,
      particulars: "Opening Balance",
      birds: 0,
      weight: 0,
      rate: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      type: "sale",
    },
  ];

  const buildRand = (current: number) => (n: number) => {
    const x = Math.sin(current * 999 + n) * 10000;
    return x - Math.floor(x);
  };

  shops.forEach((shop, shopIdx) => {
    let r = buildRand(shopIdx + 1);

    // Every shop gets at least 1 sale and 1 collection; larger shops get more.
    const totalLines = 6 + Math.floor(r(1) * 6); // 6..11
    let localSeed = shopIdx + 1;

    for (let i = 0; i < totalLines; i++) {
      r = buildRand(localSeed * 131 + i);

      const dayOffset = Math.min(
        spanDays - 1,
        Math.floor(r(2) * spanDays)
      );
      const base = new Date(fromTime);
      const dateObj = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + Math.max(0, dayOffset),
      );
      // Local date components only — never toISOString() (avoids rollover).
      const date = [
        dateObj.getFullYear(),
        String(dateObj.getMonth() + 1).padStart(2, "0"),
        String(dateObj.getDate()).padStart(2, "0"),
      ].join("-");

      // Mostly sales, with a solid mix of collections and a few corrections.
      const kind =
        i % 3 === 2
          ? "collection"
          : i % 7 === 5
            ? "correction"
            : "sale";

      const birds = kind === "sale" ? 220 + Math.round(r(4) * 620) : 0;
      const rate = kind === "sale"
        ? 110 + Math.round(r(5) * 18)
        : 0;
      const weight = kind === "sale"
        ? Math.round(birds * 2.1 * 10) / 10
        : 0;

      const amount = kind === "sale"
        ? Math.round(weight * rate * 100) / 100
        : kind === "collection"
          ? Math.round((6000 + r(6) * 30000) * 100) / 100
          : Math.round(r(7) * 1800 * 100) / 100;

      const tx: LedgerTransaction = {
        date,
        // Particulars = shop name only — no trip / collection reference numbers.
        particulars: shop,
        birds,
        weight,
        rate,
        debit: kind === "sale" ? amount : 0,
        credit: kind === "collection" ? amount : 0,
        balance: 0,
        type: kind as "sale" | "collection" | "correction",
        collectionNo: undefined,
        paymentMode:
          kind === "collection"
            ? SAMPLE_PAYMENT_MODES[(shopIdx + i) % SAMPLE_PAYMENT_MODES.length]
            : undefined,
      };

      if (tx.type === "sale") balance += tx.debit;
      else if (tx.type === "collection") balance -= tx.credit;
      tx.balance = balance;
      rows.push(tx);

      localSeed++;
    }
  });

  // Fix the opening row balance so the running balance is coherent.
  rows[0].balance = rows.length > 1 ? rows[1].balance - (rows[1].debit - rows[1].credit) : 0;
  if (rows[0].balance < 0) rows[0].balance = 0;

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

const ShopLedgerPage: React.FC<ShopLedgerProps> = ({ embedded = false }) => {
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

  const [ledgerData, setLedgerData] = useState<LedgerTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerRefreshing, setLedgerRefreshing] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [refreshToast, setRefreshToast] = useState(false);
  const [sampleMode] = useState(true); // Page-level sample data for first verification.

  // In sample mode the page uses the 50 sample shops so the Shop filter works
  // without a backend. Real mode uses the shops master from the API.
  const shopOptions = useMemo(() => {
    const all = [{ value: "All Shops", label: "All Shops" }];
    const source = sampleMode ? SAMPLE_SHOP_NAMES : shops.map((shop: Shop) => shop.shopName);
    const unique = Array.from(new Set(source));
    const shopList = unique.map((name) => ({ value: name, label: name }));
    return [...all, ...shopList];
  }, [shops, sampleMode]);

  const selectedShopId = useMemo(() => {
    return appliedSelectedShop === "All Shops"
      ? undefined
      : shopMasterMap.get(appliedSelectedShop)?.id;
  }, [appliedSelectedShop, shopMasterMap]);

  const buildLedger = useCallback(
    async (from: string, to: string, shopId?: number): Promise<LedgerTransaction[]> => {
      const res = await fetchShopLedger({ fromDate: from, toDate: to, shopId });
      const openingRow: LedgerTransaction = {
        date: from,
        particulars: "Opening Balance",
        birds: 0,
        weight: 0,
        rate: 0,
        debit: 0,
        credit: 0,
        balance: Number(res.openingBalance) || 0,
        type: "sale",
      };
      return [openingRow, ...res.data.map(mapRowToTx)];
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    if (sampleMode) {
      // Sample mode: build directly from deterministic local rows so the UI
      // (search, filters, PDF, refresh, pagination) is testable without a
      // backend. Only the committed (Search) date/shop filters are applied.
      const sample = makeSampleLedger(appliedDateFrom, appliedDateTo, appliedSelectedShop);
      queueMicrotask(() => {
        if (!cancelled) {
          setLedgerLoading(false);
          setLedgerRefreshing(false);
          setLedgerError(null);
          setLedgerData(sample);
        }
      });
      return () => {
        cancelled = true;
      };
    }

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
          setLedgerError("Unable to load ledger data. Please make sure the backend is running.");
        }
      });
    return () => {
      cancelled = true;
    };
    // `refreshNonce` drives a targeted content refresh (same pattern used by
    // other ERP tabs): the loader keeps the existing table visible while the
    // data is reloaded, so the page itself is never fully reloaded.
  }, [appliedDateFrom, appliedDateTo, appliedSelectedShop, selectedShopId, buildLedger, refreshNonce, sampleMode]);

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

  const totalRows = useMemo(() => Math.max(0, filteredLedger.length - 1), [filteredLedger]);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const rangeStart = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalRows, safePage * pageSize);

  const visibleRows = useMemo(() => {
    const opening = filteredLedger.slice(0, 1);
    const start = (safePage - 1) * pageSize;
    return [...opening, ...filteredLedger.slice(1 + start, 1 + start + pageSize)];
  }, [filteredLedger, safePage, pageSize]);

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
    const closingBalance =
      filteredLedger.length > 0
        ? filteredLedger[filteredLedger.length - 1].balance
        : 0;
    return { totalDebit, totalCredit, totalBirds, totalWeight, closingBalance };
  }, [filteredLedger]);

  // KPIs are calculated only when the user applies a meaningful filter:
  // a custom date range or a specific shop. These are committed on Search.
  const hasKpiFilter =
    appliedDateFrom !== toWeekAgoDefault() ||
    appliedDateTo !== toDateDefault() ||
    appliedSelectedShop !== "All Shops";

  const resetPage = useCallback(() => setCurrentPage(1), []);

  // ─── PDF preview modal state ────────────────────────────────
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [pdfShopSearch, setPdfShopSearch] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
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
    URL.revokeObjectURL(state.combinedUrl);
    state.files.forEach((file) => {
      if (file.url) URL.revokeObjectURL(file.url);
    });
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

      if (sampleMode) {
        // Sample mode: export from local page data without a backend.
        shopNames = appliedSelectedShop !== "All Shops"
          ? [appliedSelectedShop]
          : [...SAMPLE_SHOP_NAMES];
      } else if (appliedSelectedShop === "All Shops") {
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
        showNotification("No shops found in the selected date range.", "error");
        return;
      }

      // Statements are presented in clean alphabetical shop order.
      shopNames.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

      const allLedgers: ShopLedgerPdfEntry[] = [];
      const shopData: Record<string, LedgerTransaction[]> = {};
      for (const shop of shopNames) {
        const shopId = shopMasterMap.get(shop)?.id;
        if (!sampleMode && shopId == null) continue; // never fetch "all shops" by mistake
        const ledger = sampleMode
          ? makeSampleLedger(appliedDateFrom, appliedDateTo, shop)
          : (await buildLedger(appliedDateFrom, appliedDateTo, shopId));
        if (ledger.length > 1) {
          const master = shopMasterMap.get(shop);
          allLedgers.push({
            shop,
            data: ledger,
            ownerName: sampleMode ? sampleRecipientFor(shop).ownerName : master?.ownerName || undefined,
            mobile: sampleMode ? sampleRecipientFor(shop).phoneNumber : master?.phoneNumber || undefined,
            city: sampleMode ? sampleCityFor(shop) : master?.city || undefined,
          });
          shopData[shop] = ledger;
        }
      }

      if (allLedgers.length === 0) {
        showNotification("No transaction data to export.", "error");
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
        allLedgers, appliedDateFrom, appliedDateTo, appliedSelectedShop, letterheadAssets,
      );
      createdUrls.push(combined.url);

      const files: { shop: string; url: string | null; filename: string }[] = allLedgers.map(
        ({ shop }) => ({
          shop,
          url: null,
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
        "PDF ready. Preview it below — download each shop separately or the combined file.",
        "success",
      );
    } catch {
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
      showNotification("Failed to load ledger data. Please try again.", "error");
    } finally {
      pdfGeneratingRef.current = false;
      setPdfGenerating(false);
    }
  }, [appliedSelectedShop, appliedDateFrom, appliedDateTo, sampleMode, showNotification, shopMasterMap, buildLedger]);

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

      perShopBusyRef.current.add(shop);
      setPdfBusyShop(shop);
      try {
        const ledger = current.shopData[shop] ?? [];
        const master = shopMasterMap.get(shop);
        const generated = await generateShopLedgerPDF(
          [{
            shop,
            data: ledger,
            ownerName: sampleMode ? sampleRecipientFor(shop).ownerName : master?.ownerName || undefined,
            mobile: sampleMode ? sampleRecipientFor(shop).phoneNumber : master?.phoneNumber || undefined,
            city: sampleMode ? sampleCityFor(shop) : master?.city || undefined,
          }],
          appliedDateFrom,
          appliedDateTo,
          shop,
        );
        const latest = pdfPreviewRef.current;
        if (!latest || latest !== current) {
          // Modal closed or replaced while generating — discard this file.
          URL.revokeObjectURL(generated.url);
          return null;
        }
        const nextState: PdfPreviewState = {
          ...latest,
          files: latest.files.map((file) =>
            file.shop === shop ? { ...file, url: generated.url, filename: generated.filename } : file,
          ),
        };
        pdfPreviewRef.current = nextState;
        setPdfPreview(nextState);
        return generated.url;
      } finally {
        perShopBusyRef.current.delete(shop);
        setPdfBusyShop((prev) => (prev === shop ? null : prev));
      }
      // appliedDateFrom/To pinned via useCallback deps
    },
    [appliedDateFrom, appliedDateTo, sampleMode, shopMasterMap],
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
      showNotification("Select at least one shop to download.", "info");
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
          ownerName: sampleMode ? sampleRecipientFor(shop).ownerName : master?.ownerName || undefined,
          mobile: sampleMode ? sampleRecipientFor(shop).phoneNumber : master?.phoneNumber || undefined,
          city: sampleMode ? sampleCityFor(shop) : master?.city || undefined,
        };
      })
      .filter((entry) => entry.data.length > 0);
    if (ledgers.length === 0) {
      showNotification("Select at least one shop to download.", "info");
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
    setLedgerRefreshing(true);
    setRefreshToast(true);
    setRefreshNonce((n) => n + 1);
  }, []);

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
    const source = sampleMode ? SAMPLE_SHOP_NAMES : shops.map((shop: Shop) => shop.shopName);
    return Array.from(new Set(source)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [shops, sampleMode]);

  /**
   * WhatsApp recipient for a shop — `whatsappNumber` from Shop Master when
   * present, otherwise the regular `phoneNumber`. Sample mode uses
   * deterministic sample owner/phone values.
   */
  const resolveWaRecipient = useCallback(
    (shop: string): { shop: string; ownerName: string; phoneNumber: string; whatsappNumber: string } => {
      if (sampleMode) {
        return { shop, ...sampleRecipientFor(shop) };
      }
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
    [sampleMode, shopMasterMap],
  );

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
    setWhatsappOpen(true);
  }, [appliedReportType, appliedDateFrom, appliedDateTo, appliedSelectedShop, waAllShopNames, resetWaSucceeded]);

  const closeWhatsApp = useCallback(() => {
    if (waSendingRef.current) return;
    setWhatsappOpen(false);
    setWaConfirmAll(false);
    setWaError(null);
    setWaSendingShop(null);
  }, []);

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
      setWaError("Please select at least one shop before sending.");
      return;
    }
    if (!waDateFrom || !waDateTo) {
      setWaError("Please choose a valid date range.");
      return;
    }
    if (!WHATSAPP_BACKEND_ENABLED) {
      // Never fake success. The endpoint/service must be explicitly enabled
      // and the backend must confirm delivery before we report success.
      setWaError("WhatsApp report service is not configured.");
      showNotification("WhatsApp report service is not configured.", "info");
      return;
    }

    // Retry safety: skip shops that already received this exact report.
    const pendingTargets = targets.filter((shop) => !waSucceededRef.current.includes(shop));
    if (pendingTargets.length === 0) {
      setWaError("Every selected shop already received this report for these settings.");
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
        if (!sampleMode && shopId == null) {
          throw new Error(`Shop ${shop} is not in the shops master.`);
        }

        // Same per-shop PDF the preview modal generates.
        const ledger = sampleMode
          ? makeSampleLedger(waDateFrom, waDateTo, shop)
          : await buildLedger(waDateFrom, waDateTo, shopId);

        const waMaster = shopMasterMap.get(shop);
        const generated = await generateShopLedgerPDF(
          [{
            shop,
            data: ledger,
            ownerName: sampleMode ? recipient.ownerName : waMaster?.ownerName || undefined,
            mobile: sampleMode ? recipient.phoneNumber : waMaster?.phoneNumber || undefined,
            city: sampleMode ? sampleCityFor(shop) : waMaster?.city || undefined,
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
      setWaError("Unable to send WhatsApp report. Please try again.");
      showNotification("Unable to send WhatsApp report. Please try again.", "error");
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
    sampleMode,
    buildLedger,
    waReportType,
    showNotification,
  ]);

  // ─── React-Select styles (original) ───
  const selectStyles = useMemo<StylesConfig<SelectOption, false>>(() => ({
    control: (base) => ({
      ...base,
      borderRadius: 8,
      borderColor: "#cbd5e1",
      boxShadow: "none",
      minHeight: 38,
      fontSize: "14px",
      "&:hover": { borderColor: "#94a3b8" },
      "&:focus-within": {
        borderColor: "#3b82f6",
        boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.15)",
      },
    }),
    option: (base, { isFocused, isSelected }) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#1e293b",
      fontSize: "13px",
      padding: "6px 12px",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
      border: "1px solid #f1f5f9",
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: "200px",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#94a3b8",
    }),
  }), []);

  const reportTypeOptions: { value: ReportTypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "sales", label: "Sales" },
    { value: "collection", label: "Collection" },
  ];

  const actionButtonClass =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const iconOnlyButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const iconOnlyTone =
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900";

  const searchButtonClass =
    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800";

  const resetButtonClass =
    "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none";

  const pdfButtonClass =
    "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 focus-visible:outline-none";

  const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1";

  // ─── UI (Original Colors) ──────────────────────────────────
  return (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 text-slate-800 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen'
    }`}>
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200/85 shadow-sm space-y-4">

        {/* ── FILTER ROW ───────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <label className={labelClass}>Date From</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" className="w-full" />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Date To</label>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" className="w-full" />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Shop</label>
            <Select
              options={shopOptions}
              value={shopOptions.find((opt) => opt.value === selectedShop)}
              onChange={(selected) => {
                setSelectedShop(selected?.value || "All Shops");
              }}
              isSearchable
              placeholder="Search or select shop..."
              styles={selectStyles}
              maxMenuHeight={200}
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Report Type</label>
            <Select
              options={reportTypeOptions}
              value={reportTypeOptions.find((opt) => opt.value === reportType)}
              onChange={(selected) => {
                setReportType((selected?.value as ReportTypeFilter) || "all");
              }}
              placeholder="All"
              styles={selectStyles}
              maxMenuHeight={200}
            />
          </div>
        </div>

        {/* ── ACTION ROW ───────────────────────────────────── */}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 md:flex-row md:items-center">
          {/* Search box fills the available empty space; actions stay right. */}
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Search all details — date, particulars, birds, weight, rate, debit, credit, payment mode…"
              aria-label="Search all Shop Ledger details"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={handleSearch} className={`${actionButtonClass} ${searchButtonClass}`}>
              <Search size={14} /> Search
            </button>
            <button type="button" onClick={handleReset} className={`${actionButtonClass} ${resetButtonClass}`}>
              <RotateCcw size={14} /> Reset
            </button>
            <button
              type="button"
              onClick={() => void handleExportPDF()}
              disabled={pdfGenerating}
              className={`${actionButtonClass} ${pdfButtonClass} disabled:opacity-60`}
            >
              {pdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
              title="WhatsApp"
              aria-label="WhatsApp"
              disabled={waSending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#25D366]/50 bg-[#25D366] text-white shadow-sm transition hover:bg-[#1DA851] focus:outline-none focus:ring-2 focus:ring-[#25D366]/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShopLedgerWhatsAppIcon size={17} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh"
              aria-label="Refresh"
              disabled={ledgerRefreshing}
              className={`${iconOnlyButtonClass} ${iconOnlyTone} disabled:opacity-60`}
            >
              <RefreshCw size={16} className={ledgerRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {ledgerError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-800">
            {ledgerError}
          </div>
        )}

        {/* ── KPI CARDS (only for an applied date/shop filter) ── */}
        {hasKpiFilter ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500">Total Debit (Sales)</p>
              <p className="text-xl font-bold text-emerald-600">{formatAmount(summary.totalDebit)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500">Total Credit (Collections)</p>
              <p className="text-xl font-bold text-blue-600">{formatAmount(summary.totalCredit)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500">Total Birds</p>
              <p className="text-xl font-bold text-slate-800">{summary.totalBirds}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500">Total Weight (KG)</p>
              <p className="text-xl font-bold text-slate-800">{summary.totalWeight.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500">Closing Balance</p>
              <p className={`text-xl font-bold ${summary.closingBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatAmount(summary.closingBalance)}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-medium text-slate-500">
            KPI totals appear after you filter by a date range or select a shop.
          </div>
        )}

        {/* ── TABLE ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/70 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-sm">
                        <CalendarDays size={13} />
                      </span>
                      Date
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                        <Store size={13} />
                      </span>
                      Particulars
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                        <Bird size={13} />
                      </span>
                      Birds
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sm">
                        <Weight size={13} />
                      </span>
                      Weight (KG)
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                        <IndianRupee size={13} />
                      </span>
                      Rate
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm">
                        <ArrowUpRight size={13} />
                      </span>
                      Debit
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
                        <ArrowDownLeft size={13} />
                      </span>
                      Credit
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-sm">
                        <Scale size={13} />
                      </span>
                      Balance
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {ledgerLoading ? "Loading ledger..." : "No transactions found for the selected filters."}
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
                          ? { text: "Sale", color: "text-emerald-600" }
                          : tx.type === "collection"
                            ? { text: paymentMode ? `Collection - ${paymentMode}` : "Collection", color: "text-blue-600" }
                            : { text: "Correction", color: "text-rose-600" };
                      return (
                        <tr
                          key={`${isOpening ? "opening" : tx.collectionNo || tx.particulars}-${idx}`}
                          className={`transition-colors ${isOpening ? "bg-amber-50/50 font-semibold" : "hover:bg-slate-50/80"}`}
                        >
                          <td className="px-4 py-3 text-xs font-medium text-slate-600">{tx.date}</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700">
                            {tx.particulars}
                            {!isOpening && (
                              <span className={`ml-2 text-[10px] font-semibold ${typeLabel.color}`}>
                                {typeLabel.text}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">{isSale ? tx.birds : "-"}</td>
                          <td className="px-4 py-3 text-center text-xs">{isSale ? tx.weight.toFixed(2) : "-"}</td>
                          <td className="px-4 py-3 text-center text-xs">{isSale ? tx.rate.toFixed(2) : "-"}</td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600">
                            {tx.debit > 0 ? formatAmount(tx.debit) : "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-blue-600">
                            {tx.credit > 0 ? formatAmount(tx.credit) : "-"}
                          </td>
                          <td className={`px-4 py-3 text-center text-xs font-bold ${tx.balance >= 0 ? "text-slate-800" : "text-rose-600"}`}>
                            {formatAmount(tx.balance)}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleRows.length > 1 && (
                      <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                        <td className="px-4 py-3 text-xs text-slate-700" colSpan={2}>TOTAL</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-800">{summary.totalBirds}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-800">{summary.totalWeight.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-800">-</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-emerald-700">{formatAmount(summary.totalDebit)}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-blue-700">{formatAmount(summary.totalCredit)}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-800">{formatAmount(summary.closingBalance)}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ─────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>{totalRows === 0 ? "0–0 of 0" : `${rangeStart}–${rangeEnd} of ${totalRows}`}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label="Rows per page"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-medium text-slate-600">{safePage} / {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── REFRESHED TOAST (top-right) ─────────────────────── */}
      {refreshToast && (
        <div className="fixed right-4 top-4 z-[200] flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 size={16} />
          </span>
          <span className="text-sm font-semibold text-emerald-800">Shop Ledger Refreshed</span>
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
                    Weekly Statement
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {formatDisplayDate(appliedDateFrom)} to {formatDisplayDate(appliedDateTo)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePdfPreview}
                aria-label="Close PDF preview"
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
                        Select shops
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
                        placeholder="Search shops..."
                        aria-label="Search shops in PDF preview"
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
                      />
                      {pdfShopSearch && (
                        <button
                          type="button"
                          onClick={() => setPdfShopSearch("")}
                          aria-label="Clear shop search"
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
                              aria-label={`Include ${file.shop} in downloads`}
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
                              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" aria-label="PDF ready" />
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
                  <h3 className="text-sm font-bold text-slate-800">WhatsApp Report</h3>
                  <p className="text-[11px] text-slate-400">
                    Send each shop’s ledger PDF to its owner’s WhatsApp number
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWhatsApp}
                aria-label="Close WhatsApp report"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Top bar */}
            <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>Report Type</label>
                <Select
                  options={[
                    { value: "All", label: "All (Sales + Collection)" },
                    { value: "Sales", label: "Sales" },
                    { value: "Collection", label: "Collection" },
                  ]}
                  value={{
                    value: waReportType,
                    label: waReportType === "All" ? "All (Sales + Collection)" : waReportType,
                  }}
                  onChange={(selected) => {
                    setWaReportType((selected?.value as WaReportType) || "All");
                    resetWaSucceeded();
                  }}
                  styles={selectStyles}
                  maxMenuHeight={200}
                />
              </div>
              <div>
                <label className={labelClass}>Date From</label>
                <DatePicker
                  value={waDateFrom}
                  onChange={(value) => {
                    setWaDateFrom(value);
                    resetWaSucceeded();
                  }}
                  placeholder="From date"
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelClass}>Date To</label>
                <DatePicker
                  value={waDateTo}
                  onChange={(value) => {
                    setWaDateTo(value);
                    resetWaSucceeded();
                  }}
                  placeholder="To date"
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelClass}>Recipient</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "selected" as const, label: "Selected" },
                    { value: "all" as const, label: "All" },
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
                      {waScope === "all" ? "All shops" : "Select shops"}
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
                      placeholder="Search shops..."
                      aria-label="Search shops in WhatsApp report"
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
                            aria-label={`Send report to ${shop}`}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#25D366]"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setWaPreviewShop(shop)}
                          title={shop}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs font-semibold text-slate-700">{shop}</span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {recipient.ownerName || "Shop Owner"} · {recipient.whatsappNumber || "No number"}
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
                      ? `Sending${waSendingShop ? `: ${waSendingShop}` : "…"}`
                      : waScope === "all"
                        ? waConfirmAll
                          ? "Confirm & Send All"
                          : "Send All Shops"
                        : `Send Selected (${waSelectedShops.length})`}
                  </button>
                  {waScope === "all" && waConfirmAll && !waSending && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
                      Press again to send to all {waAllShopNames.length} shop(s).
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
                            <span className="font-semibold text-slate-500">Shop:</span>{" "}
                            <span className="text-slate-700">{waPreviewShop}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">Owner:</span>{" "}
                            <span className="text-slate-700">{waPreviewRecipient.ownerName || "Shop Owner"}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">WhatsApp:</span>{" "}
                            <span className="text-slate-700">{waPreviewRecipient.whatsappNumber || "Not available"}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">Sent this week:</span>{" "}
                            <span className="text-slate-700">
                              {weeklySendCount(waSendCounts, currentWeekKey, waPreviewShop)} time(s)
                            </span>
                          </div>
                        </div>
                        {weeklySendCount(waSendCounts, currentWeekKey, waPreviewShop) > 0 &&
                          waLastSent[weeklySendKey(currentWeekKey, waPreviewShop)] && (
                            <div className="mt-1 min-w-0">
                              <span className="font-semibold text-slate-500">Last sent:</span>{" "}
                              <span className="text-slate-600">
                                {waLastSent[weeklySendKey(currentWeekKey, waPreviewShop)]}
                              </span>
                            </div>
                          )}
                      </div>

                      <div>
                        <label className={labelClass}>Message preview</label>
                        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-3 font-sans text-[11px] leading-relaxed text-slate-700">
                          {waPreviewMessage}
                        </pre>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 text-xs text-slate-600">
                        <FileText size={14} className="shrink-0 text-red-500" />
                        <span className="min-w-0 truncate font-medium" title={waPreviewFileName}>
                          {waPreviewFileName}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                          PDF attachment
                        </span>
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
