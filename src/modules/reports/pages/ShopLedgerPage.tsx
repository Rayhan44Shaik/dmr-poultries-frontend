import React, { useState, useMemo, useCallback, useEffect } from "react";
import { format, subDays } from "date-fns";
import {
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
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
import { generateShopLedgerPDF } from "../components/ShopLedgerPDF";
import type { LedgerTransaction } from "../components/ShopLedgerPDF";

interface ShopLedgerProps {
  embedded?: boolean;
}

type ReportTypeFilter = "all" | "sales" | "collection";
type WaReportType = "Sales" | "Collection";
type WaScope = "selected" | "all";
interface SelectOption {
  value: string;
  label: string;
}

interface WhatsAppPayload {
  reportType: WaReportType;
  dateFrom: string;
  dateTo: string;
  scope: WaScope;
  shopName?: string;
}

const WHATSAPP_BACKEND_ENABLED =
  import.meta.env.VITE_WHATSAPP_BACKEND_ENABLED === "true";

const REFRESH_TOAST_DURATION = 3500;

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

const normalizePaymentMode = (value?: string): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/upi/i.test(raw)) return "UPI";
  if (/union/i.test(raw)) return "Union Bank";
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

const SAMPLE_PAYMENT_MODES = ["Cash", "UPI", "Union Bank", "SBI"];

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

  const [dateFrom, setDateFrom] = useState(toWeekAgoDefault);
  const [dateTo, setDateTo] = useState(toDateDefault);
  const [selectedShop, setSelectedShop] = useState("All Shops");
  const [reportType, setReportType] = useState<ReportTypeFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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
    return selectedShop === "All Shops"
      ? undefined
      : shops.find((s: Shop) => s.shopName === selectedShop)?.id;
  }, [selectedShop, shops]);

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
      // (search, filters, PDF, refresh, pagination, badges) is testable
      // without a backend. Filter active date/shop locally.
      const sample = makeSampleLedger(dateFrom, dateTo, selectedShop);
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

    buildLedger(dateFrom, dateTo, selectedShopId)
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
  }, [dateFrom, dateTo, selectedShop, selectedShopId, buildLedger, refreshNonce, sampleMode]);

  const filteredLedger = useMemo(() => {
    const opening = ledgerData.slice(0, 1);
    const body = ledgerData.slice(1);

    const scoped = body.filter((tx) => {
      if (reportType === "sales" && tx.type !== "sale") return false;
      if (reportType === "collection" && tx.type !== "collection") return false;
      if (!searchTerm.trim()) return true;
      const needle = searchTerm.trim().toLowerCase();
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
  }, [ledgerData, reportType, searchTerm]);

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

  const resetPage = useCallback(() => setCurrentPage(1), []);

  // ─── Export Functions ──────────────────────────────────────

  const handleExportPDF = useCallback(async () => {
    try {
      let shopNames: string[] = [];

      if (sampleMode) {
        // Sample mode: export from local page data without a backend.
        shopNames = selectedShop !== "All Shops"
          ? [selectedShop]
          : SAMPLE_SHOP_NAMES;
      } else if (selectedShop === "All Shops") {
        const all = await fetchShopLedger({ fromDate: dateFrom, toDate: dateTo });
        const names = new Set<string>();
        all.data.forEach((r) => {
          if (r.shopName) names.add(r.shopName);
        });
        shopNames = Array.from(names).sort();
      } else {
        shopNames = [selectedShop];
      }

      if (shopNames.length === 0) {
        showNotification("No shops found in the selected date range.", "error");
        return;
      }

      const allLedgers: { shop: string; data: LedgerTransaction[] }[] = [];
      for (const shop of shopNames) {
        const ledger = sampleMode
          ? makeSampleLedger(dateFrom, dateTo, shop)
          : (await buildLedger(
              dateFrom,
              dateTo,
              shops.find((s: Shop) => s.shopName === shop)?.id,
            ));
        if (ledger.length > 1) {
          allLedgers.push({ shop, data: ledger });
        }
      }

      if (allLedgers.length === 0) {
        showNotification("No transaction data to export.", "error");
        return;
      }

      generateShopLedgerPDF(allLedgers, dateFrom, dateTo, selectedShop);
      showNotification("PDF downloaded successfully.", "success");
    } catch {
      showNotification("Failed to load ledger data. Please try again.", "error");
    }
  }, [selectedShop, dateFrom, dateTo, sampleMode, showNotification, shops, buildLedger]);

  const handleSearch = useCallback(() => {
    setSearchTerm(searchValue);
    resetPage();
  }, [searchValue, resetPage]);

  const handleReset = useCallback(() => {
    setDateFrom(toWeekAgoDefault());
    setDateTo(toDateDefault());
    setSelectedShop("All Shops");
    setReportType("all");
    setSearchValue("");
    setSearchTerm("");
    setCurrentPage(1);
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

  const resetPaginationForChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // ─── WhatsApp modal state ──────────────────────────────────
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [waReportType, setWaReportType] = useState<WaReportType>("Sales");
  const [waDateFrom, setWaDateFrom] = useState(toWeekAgoDefault);
  const [waDateTo, setWaDateTo] = useState(toDateDefault);
  const [waScope, setWaScope] = useState<WaScope>("selected");
  const [waShop, setWaShop] = useState("All Shops");
  const [waSending, setWaSending] = useState(false);
  const [waConfirmAll, setWaConfirmAll] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  const waShopOptions = useMemo(() => {
    const all = [{ value: "All Shops", label: "Select Shop" }];
    const source = sampleMode ? SAMPLE_SHOP_NAMES : shops.map((shop: Shop) => shop.shopName);
    const unique = Array.from(new Set(source));
    const shopList = unique.map((name) => ({
      value: name,
      label: name,
    }));
    return [...all, ...shopList];
  }, [shops, sampleMode]);

  const openWhatsApp = useCallback(() => {
    setWaReportType("Sales");
    setWaDateFrom(dateFrom);
    setWaDateTo(dateTo);
    setWaScope(selectedShop === "All Shops" ? "all" : "selected");
    setWaShop(selectedShop === "All Shops" ? "All Shops" : selectedShop);
    setWaConfirmAll(false);
    setWaError(null);
    setWhatsappOpen(true);
  }, [dateFrom, dateTo, selectedShop]);

  const closeWhatsApp = useCallback(() => {
    if (waSending) return;
    setWhatsappOpen(false);
    setWaConfirmAll(false);
    setWaError(null);
  }, [waSending]);

  const sendWhatsApp = useCallback(async () => {
    if (waSending) return;
    if (waScope === "all" && !waConfirmAll) {
      setWaConfirmAll(true);
      return;
    }
    if (waScope === "selected" && waShop === "All Shops") {
      setWaError("Please select a shop before sending.");
      return;
    }
    if (!waDateFrom || !waDateTo) {
      setWaError("Please choose a valid date range.");
      return;
    }

    const payload: WhatsAppPayload = {
      reportType: waReportType,
      dateFrom: waDateFrom,
      dateTo: waDateTo,
      scope: waScope,
      shopName: waScope === "selected" ? waShop : undefined,
    };

    try {
      setWaSending(true);
      setWaError(null);

      if (!WHATSAPP_BACKEND_ENABLED) {
        // Never fake success. The endpoint / service must be explicitly enabled
        // and the backend must confirm delivery before we report success.
        setWaError("WhatsApp report service is not configured.");
        showNotification("WhatsApp report service is not configured.", "info");
        return;
      }

      await apiPost("/operations/shop-ledger/whatsapp", payload, { timeout: 60_000 });
      showNotification("WhatsApp report sent successfully.", "success");
      closeWhatsApp();
    } catch {
      setWaError("Unable to send WhatsApp report. Please try again.");
      showNotification("Unable to send WhatsApp report. Please try again.", "error");
    } finally {
      setWaSending(false);
    }
  }, [waSending, waScope, waConfirmAll, waShop, waDateFrom, waDateTo, waReportType, closeWhatsApp, showNotification]);

  // ─── React-Select styles (original) ───
  const selectStyles: StylesConfig<SelectOption, false> = {
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
  };

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
    "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700";

  const pdfButtonClass =
    "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700";

  const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1";

  // ─── UI (Original Colors) ──────────────────────────────────
  return (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 text-slate-800 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen'
    }`}>
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200/85 shadow-sm space-y-4">

        {sampleMode && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-2 text-xs font-medium text-indigo-700">
            Sample data only on this page — used to test search, filters, refresh, pagination, PDF &amp; WhatsApp behavior.
          </div>
        )}

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
                resetPaginationForChange();
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
                resetPaginationForChange();
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
            <button type="button" onClick={() => void handleExportPDF()} className={`${actionButtonClass} ${pdfButtonClass}`}>
              <FileText size={14} /> PDF
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
              title="WhatsApp"
              aria-label="WhatsApp"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#25D366]/50 bg-[#25D366] text-white shadow-sm transition hover:bg-[#1DA851] focus:outline-none focus:ring-2 focus:ring-[#25D366]/35"
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

        {/* ── KPI CARDS ────────────────────────────────────── */}
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

        {/* ── TABLE ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/70 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Particulars</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Birds</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Weight (KG)</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Debit</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Credit</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Balance</th>
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

      {/* ── WHATSAPP MODAL ─────────────────────────────────── */}
      {whatsappOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
                  <ShopLedgerWhatsAppIcon size={16} />
                </span>
                <h3 className="text-sm font-bold text-slate-800">WhatsApp Report</h3>
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

            <div className="space-y-3 px-5 py-4">
              <div>
                <label className={labelClass}>Report Type</label>
                <Select
                  options={[
                    { value: "Sales", label: "Sales" },
                    { value: "Collection", label: "Collection" },
                  ]}
                  value={{ value: waReportType, label: waReportType }}
                  onChange={(selected) => setWaReportType((selected?.value as WaReportType) || "Sales")}
                  styles={selectStyles}
                  maxMenuHeight={200}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Date From</label>
                  <DatePicker value={waDateFrom} onChange={setWaDateFrom} placeholder="From date" className="w-full" />
                </div>
                <div>
                  <label className={labelClass}>Date To</label>
                  <DatePicker value={waDateTo} onChange={setWaDateTo} placeholder="To date" className="w-full" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Recipient</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "selected" as const, label: "Selected Shop" },
                    { value: "all" as const, label: "All Shops" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setWaScope(opt.value);
                        setWaConfirmAll(false);
                        if (opt.value === "all") setWaShop("All Shops");
                      }}
                      className={`h-8 rounded-lg border text-xs font-medium transition ${
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

              {waScope === "selected" && (
                <div>
                  <label className={labelClass}>Shop</label>
                  <Select
                    options={waShopOptions}
                    value={waShopOptions.find((opt) => opt.value === waShop)}
                    onChange={(selected) => setWaShop(selected?.value || "All Shops")}
                    isSearchable
                    placeholder="Select Shop"
                    styles={selectStyles}
                    maxMenuHeight={200}
                  />
                </div>
              )}

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 text-xs text-slate-600">
                <div className="grid grid-cols-1 gap-1">
                  <div><span className="font-semibold text-slate-500">Report:</span> {waReportType}</div>
                  <div><span className="font-semibold text-slate-500">Period:</span> {waDateFrom} – {waDateTo}</div>
                  <div><span className="font-semibold text-slate-500">Recipient:</span> {waScope === "selected" ? waShop : "All applicable shops"}</div>
                  {waScope === "all" && <div className="text-[11px] text-slate-400">This will send the report to all applicable shops.</div>}
                </div>
              </div>

              {waError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800">
                  {waError}
                </div>
              )}

              {waScope === "all" && waConfirmAll && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs font-medium text-amber-800">
                  Send this report to all applicable shops?
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
              <button
                type="button"
                onClick={closeWhatsApp}
                disabled={waSending}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendWhatsApp()}
                disabled={waSending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1DA851] disabled:opacity-60"
              >
                {waSending ? <Loader2 size={14} className="animate-spin" /> : <ShopLedgerWhatsAppIcon size={15} />}
                {waSending
                  ? "Sending…"
                  : waScope === "all" && waConfirmAll
                    ? "Confirm & Send"
                    : "Send WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopLedgerPage;
