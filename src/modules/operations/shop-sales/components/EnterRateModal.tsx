import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Truck,
  CalendarDays,
  Store,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Lock,
  Save,
  RotateCcw,
  Users,
  FileText,
  Search,
  Filter,
  PackageCheck,
  Zap,
  Calculator,
} from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import type { Shop } from "../../../masters/shops/types/shop";
import { useI18n } from "../../../../i18n";
import { formatVehicleNumber } from "../../../../utils/format";
import {
  cleanRateEntryShopName,
  displayRateEntryName,
  displayRateEntryShopName,
  formatRateEntryTripDate,
  formatRateEntryWeekday,
} from "../utils/rateEntryDisplay";
import type { RateEntryMarketRateMasterDto } from "../utils/rateEntryMarketMaster";
import { Pagination } from "../../../../ui/Pagination";

const DEFAULT_SHOPS_PAGE_SIZE = 10;

function isValidSellingRate(rate: number | null | undefined): boolean {
  return rate != null && Number.isFinite(rate) && rate >= 50 && rate <= 300;
}

function normalizeRate(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate === 0) return null;
  return rate;
}

type ShopMasterLookup = {
  byId: Map<number, Shop>;
  byName: Map<string, Shop>;
};

function shopLookupKey(value: string | null | undefined): string {
  return cleanRateEntryShopName(value)
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function resolveShopMaster(
  delivery: Trip["deliveries"][number],
  lookup: ShopMasterLookup,
): Shop | null {
  if (delivery.shopId > 0) {
    const byId = lookup.byId.get(delivery.shopId);
    if (byId) return byId;
  }
  return lookup.byName.get(shopLookupKey(delivery.shopName)) ?? null;
}

function suggestedMarketRate(
  row: Trip["deliveries"][number],
  tripDateFallback: number | null,
): number | null {
  const candidate = row.marketRate?.masterRate != null ? Number(row.marketRate.masterRate) : tripDateFallback;
  return isValidSellingRate(candidate) ? Number(candidate) : null;
}

function formatInr(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ShopSortKey = "shopName" | "birds" | "weight" | "rate" | "amount";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSave: (deliveries: Trip["deliveries"]) => Promise<boolean> | boolean | void;
  onSaveAndLock: (deliveries: Trip["deliveries"]) => Promise<boolean> | boolean | void;
  isSaving?: boolean;
  loadError?: string | null;
  shops?: Shop[];
  shopsLoading?: boolean;
}

export default function EnterRateModal({
  open,
  trip,
  onClose,
  onSave,
  onSaveAndLock,
  isSaving = false,
  loadError,
  shops = [],
  shopsLoading = false,
}: Props) {
  const { t, language } = useI18n();
  const [deliveries, setDeliveries] = useState<Trip["deliveries"]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockAttempted, setLockAttempted] = useState(false);
  const [shopPage, setShopPage] = useState(1);
  const [shopPageSize, setShopPageSize] = useState(DEFAULT_SHOPS_PAGE_SIZE);
  const [shopSearch, setShopSearch] = useState("");
  const [bulkRate, setBulkRate] = useState<string>("");
  const [shopSortKey, setShopSortKey] = useState<ShopSortKey>("shopName");
  const [shopSortDir, setShopSortDir] = useState<"asc" | "desc">("asc");

  const saving = isSaving || busy;
  const rateLocked = trip?.rateCompleted === true;

  useEffect(() => {
    if (!trip) return;
    setShowSuccessToast(false);
    setShowConfirm(false);
    setLockError(null);
    setLockAttempted(false);
    setShopPage(1);
    setShopSearch("");
    setBulkRate("");
    setShopSortKey("shopName");
    setShopSortDir("asc");
    setDeliveries(
      trip.deliveries.map((d) => ({
        ...d,
        rate: normalizeRate(d.rate),
      }))
    );
  }, [trip]);

  const hasInvalidEnteredRate = useMemo(
    () =>
      deliveries.some((row) => {
        const rate = normalizeRate(row.rate);
        return rate !== null && !isValidSellingRate(rate);
      }),
    [deliveries]
  );

  const canLock = useMemo(
    () => deliveries.length > 0 && deliveries.every((row) => isValidSellingRate(normalizeRate(row.rate))),
    [deliveries]
  );

  const shopMasterLookup = useMemo<ShopMasterLookup>(() => {
    const byId = new Map<number, Shop>();
    const byName = new Map<string, Shop>();
    shops.forEach((shop) => {
      if (shop.id > 0) byId.set(shop.id, shop);
      const key = shopLookupKey(shop.shopName);
      if (key) byName.set(key, shop);
    });
    return { byId, byName };
  }, [shops]);

  const marketMaster = useMemo(() => {
    return (trip as Trip & { marketRateMaster?: RateEntryMarketRateMasterDto | null } | null)
      ?.marketRateMaster;
  }, [trip]);

  const tripDateVenRate = useMemo(() => {
    const row = marketMaster?.companyRates.find((r) => r.date === trip?.tripDate);
    if (!row?.entered || row.vencobRate == null) return null;
    return row.vencobRate;
  }, [marketMaster, trip?.tripDate]);

  const isDirty = useMemo(() => {
    if (!trip) return false;
    return deliveries.some((row, i) => normalizeRate(row.rate) !== normalizeRate(trip.deliveries[i]?.rate));
  }, [deliveries, trip]);

  const totals = useMemo(() => {
    let ratedCount = 0;
    let totalWeight = 0;
    let totalAmount = 0;
    let totalBirds = 0;
    for (const d of deliveries) {
      const rate = normalizeRate(d.rate);
      totalWeight += d.weight ?? 0;
      totalBirds += d.birds ?? 0;
      if (isValidSellingRate(rate)) {
        ratedCount += 1;
        totalAmount += (d.weight ?? 0) * (rate as number);
      }
    }
    const pendingCount = deliveries.length - ratedCount;
    const progressPct = deliveries.length ? Math.round((ratedCount / deliveries.length) * 100) : 0;
    const avgRate = totalWeight ? totalAmount / totalWeight : 0;
    return {
      ratedCount,
      pendingCount,
      totalWeight,
      totalBirds,
      totalAmount,
      progressPct,
      avgRate,
    };
  }, [deliveries]);

  const canApplyMarketRates = useMemo(
    () =>
      deliveries.some((row) => {
        const currentRate = normalizeRate(row.rate);
        return !isValidSellingRate(currentRate) && suggestedMarketRate(row, tripDateVenRate) != null;
      }),
    [deliveries, tripDateVenRate]
  );

  const filteredSortedDeliveries = useMemo(() => {
    let list = deliveries.map((row, idx) => ({ row, originalIndex: idx }));
    if (shopSearch.trim()) {
      const q = shopSearch.toLowerCase().trim();
      list = list.filter(({ row }) => {
        const shopName = row.shopName.toLowerCase();
        const master = resolveShopMaster(row, shopMasterLookup);
        const assoc = master?.associationType?.toLowerCase() ?? "";
        const city = master?.city?.toLowerCase() ?? "";
        return shopName.includes(q) || assoc.includes(q) || city.includes(q) || String(row.birds).includes(q);
      });
    }
    list.sort((a, b) => {
      const dir = shopSortDir === "asc" ? 1 : -1;
      const ra = a.row;
      const rb = b.row;
      switch (shopSortKey) {
        case "shopName":
          return ra.shopName.localeCompare(rb.shopName) * dir;
        case "birds":
          return (ra.birds - rb.birds) * dir;
        case "weight":
          return (ra.weight - rb.weight) * dir;
        case "rate": {
          const av = normalizeRate(ra.rate) ?? -1;
          const bv = normalizeRate(rb.rate) ?? -1;
          return (av - bv) * dir;
        }
        case "amount": {
          const ar = normalizeRate(ra.rate) ? ra.weight * (normalizeRate(ra.rate) as number) : 0;
          const br = normalizeRate(rb.rate) ? rb.weight * (normalizeRate(rb.rate) as number) : 0;
          return (ar - br) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [deliveries, shopSearch, shopSortKey, shopSortDir, shopMasterLookup]);

  const shopPageCount = Math.max(1, Math.ceil(filteredSortedDeliveries.length / shopPageSize));
  const pagedDeliveries = useMemo(() => {
    const start = (shopPage - 1) * shopPageSize;
    return filteredSortedDeliveries.slice(start, start + shopPageSize);
  }, [filteredSortedDeliveries, shopPage, shopPageSize]);

  useEffect(() => {
    if (shopPage <= shopPageCount) return;
    const timer = window.setTimeout(() => setShopPage(shopPageCount), 0);
    return () => window.clearTimeout(timer);
  }, [shopPage, shopPageCount]);

  useEffect(() => {
    setShopPage(1);
  }, [shopSearch]);

  const applyMarketRate = (originalIndex: number, rate: number) => {
    if (saving || rateLocked) return;
    setLockError(null);
    setDeliveries((prev) => prev.map((row, rowIndex) => (rowIndex === originalIndex ? { ...row, rate } : row)));
  };

  const applyMarketRates = () => {
    if (saving || rateLocked) return;
    let changed = false;
    const nextDeliveries = deliveries.map((row) => {
      const marketRate = suggestedMarketRate(row, tripDateVenRate);
      const currentRate = normalizeRate(row.rate);
      if (marketRate == null || isValidSellingRate(currentRate)) return row;
      if (shopSearch.trim()) {
        const q = shopSearch.toLowerCase().trim();
        const match = row.shopName.toLowerCase().includes(q);
        if (!match) return row;
      }
      changed = true;
      return { ...row, rate: marketRate };
    });
    if (!changed) {
      setLockError(t("ops.rate.modal.no_market_rates"));
      return;
    }
    setDeliveries(nextDeliveries);
    setLockError(null);
  };

  const applyBulkRate = () => {
    const rateNum = Number(bulkRate);
    if (!isValidSellingRate(rateNum)) {
      setLockError(t("ops.rate.modal.rate_range_error"));
      return;
    }
    const q = shopSearch.trim().toLowerCase();
    const next = deliveries.map((row) => {
      if (q) {
        const match = row.shopName.toLowerCase().includes(q);
        if (!match) return row;
      }
      return { ...row, rate: rateNum };
    });
    setDeliveries(next);
    setBulkRate("");
    setLockError(null);
  };

  const clearFilteredRates = () => {
    const q = shopSearch.trim().toLowerCase();
    const next = deliveries.map((row) => {
      if (q) {
        const match = row.shopName.toLowerCase().includes(q);
        if (!match) return row;
      }
      return { ...row, rate: null };
    });
    setDeliveries(next);
    setLockError(null);
  };

  const resetRates = () => {
    if (!trip) return;
    setLockError(null);
    setLockAttempted(false);
    setDeliveries(
      trip.deliveries.map((d) => ({
        ...d,
        rate: normalizeRate(d.rate),
      }))
    );
  };

  const confirmSave = async (mode: "save" | "lock") => {
    if (saving) return;
    if (mode === "save") {
      if (hasInvalidEnteredRate) {
        setLockError(t("ops.rate.modal.rate_range_error"));
        return;
      }
      if (!isDirty) return;
    }
    if (mode === "lock") {
      setLockAttempted(true);
      if (!canLock) {
        const firstMissing = deliveries.findIndex((row) => !isValidSellingRate(normalizeRate(row.rate)));
        if (firstMissing >= 0) {
          const idxInFiltered = filteredSortedDeliveries.findIndex((f) => f.originalIndex === firstMissing);
          if (idxInFiltered >= 0) {
            setShopPage(Math.floor(idxInFiltered / shopPageSize) + 1);
          } else {
            setShopPage(Math.floor(firstMissing / shopPageSize) + 1);
          }
        }
        return;
      }
    }
    setShowConfirm(false);
    setBusy(true);
    setLockError(null);
    try {
      const ok = mode === "lock" ? await onSaveAndLock(deliveries) : await onSave(deliveries);
      if (ok === false) return;
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        if (mode === "lock") onClose();
      }, 1200);
    } finally {
      setBusy(false);
    }
  };

  const toggleShopSort = (key: ShopSortKey) => {
    if (shopSortKey === key) {
      setShopSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setShopSortKey(key);
      setShopSortDir("asc");
    }
    setShopPage(1);
  };

  if (!open || !trip) return null;

  // Main modal now uses AppShellModal with gaps from header/sidebar/page edges
  return (
    <>
      <style>{`
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner { -moz-appearance: textfield; }
      `}</style>

      {showSuccessToast &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20">
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6 flex flex-col items-center gap-3 animate-in zoom-in">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800">{t("ops.rate.modal.saved_title")}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("ops.rate.modal.saved_desc")}</p>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full mx-4 p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{t("ops.rate.modal.locking_title")}</h3>
                  <p className="text-sm text-slate-600 mt-1">{t("ops.rate.modal.locking_desc")}</p>
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Weight</span>
                      <span className="font-bold text-slate-800">{totals.totalWeight.toFixed(2)} KG</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-500">Grand Amount</span>
                      <span className="font-bold text-emerald-700">₹ {formatInr(totals.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-500">Avg Rate</span>
                      <span className="font-bold text-slate-800">₹ {totals.avgRate.toFixed(2)}/KG</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => confirmSave("lock")}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-medium text-white shadow-sm"
                >
                  {saving ? t("ops.rate.modal.locking") : t("ops.rate.modal.lock_cannot_edit")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <AppShellModal open={open} onClose={onClose} panelClassName="bg-white">
        <div className="bg-white w-full h-full flex flex-col relative overflow-hidden rounded-2xl">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-start justify-between shrink-0 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <IndianRupee size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-extrabold tracking-tight text-slate-900">
                  {rateLocked ? t("ops.rate.modal.title_readonly") : t("ops.rate.modal.title_enter")}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Progress</p>
                  <p className="text-[12px] font-bold text-slate-800">
                    {totals.ratedCount}/{deliveries.length} • {totals.progressPct}%
                  </p>
                </div>
                <div className="h-2 w-20 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${totals.progressPct}%` }} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                aria-label={t("common.close")}
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
          </div>

          {/* Trip info cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 px-5 py-3 shrink-0 bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 shadow-xs">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <PackageCheck size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trip</p>
                <p className="text-[12px] font-bold text-emerald-700 truncate">{trip.tripNo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center">
                <Truck size={15} className="text-sky-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Vehicle</p>
                <p className="text-[12px] font-bold text-slate-800 truncate">{formatVehicleNumber(trip.vehicleNo)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CalendarDays size={15} className="text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</p>
                <p className="text-[12px] font-bold text-slate-800 truncate">{formatRateEntryTripDate(trip.tripDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Day</p>
                <p className="text-[12px] font-bold text-slate-800 truncate">
                  {formatRateEntryWeekday(trip.tripDate, language)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Calculator size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total</p>
                <p className="text-[12px] font-bold text-slate-800 tabular-nums">
                  ₹ {formatInr(totals.totalAmount)} • {totals.totalWeight.toFixed(1)} KG
                </p>
              </div>
            </div>
          </div>

          {(loadError || lockError) && (
            <div className="px-5 py-2 border-b border-red-200 bg-red-50 flex items-center gap-2 shrink-0">
              <AlertCircle size={14} className="text-red-600" />
              <span className="text-xs font-medium text-red-700">{lockError || loadError}</span>
            </div>
          )}

          {/* Shop rates section — enhanced */}
          <div className="px-5 py-3 flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
            <div className="mb-3 flex flex-col gap-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <Store size={17} />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      {t("ops.rate.modal.shop_rates")}
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        {filteredSortedDeliveries.length}/{deliveries.length}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      placeholder="Search shops, association, city..."
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-[13px] font-medium text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <IndianRupee size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        value={bulkRate}
                        onChange={(e) => setBulkRate(e.target.value)}
                        placeholder="Bulk ₹"
                        className="h-9 w-28 rounded-xl border border-slate-200 bg-white pl-7 pr-2 text-[13px] font-bold tabular-nums placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none no-spinner"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyBulkRate}
                      disabled={saving || !bulkRate}
                      className="h-9 inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 text-[12px] font-bold text-white hover:bg-black disabled:opacity-50"
                    >
                      <Zap size={12} /> Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Progress</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-white border border-slate-200 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${totals.progressPct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                      {totals.ratedCount}/{deliveries.length} • {totals.progressPct}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 font-bold text-emerald-700">
                    ₹ {formatInr(totals.totalAmount)} total
                  </span>
                  <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-1 font-bold text-sky-700">
                    {totals.totalWeight.toFixed(2)} KG
                  </span>
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-1 font-bold text-amber-700">
                    Avg ₹ {totals.avgRate.toFixed(2)}
                  </span>
                  {totals.pendingCount > 0 && (
                    <span className="rounded-full bg-red-50 border border-red-200 px-2 py-1 font-bold text-red-700">
                      {totals.pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={clearFilteredRates}
                    disabled={saving || rateLocked}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Filter size={12} /> Clear {shopSearch ? "filtered" : "all"}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-full overflow-auto">
                <table className="min-w-[1050px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        {t("ops.rate.modal.s_no")}
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => toggleShopSort("shopName")}
                          className="flex items-center gap-1 hover:text-emerald-700"
                        >
                          {t("ops.rate.modal.shop_name")}
                          {shopSortKey === "shopName" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                        {t("ops.rate.modal.association")}
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        {t("ops.rate.modal.paper_rate")}
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => toggleShopSort("birds")}
                          className="flex items-center justify-center gap-1 w-full hover:text-emerald-700"
                        >
                          {t("common.birds")}
                          {shopSortKey === "birds" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => toggleShopSort("weight")}
                          className="flex items-center justify-center gap-1 w-full hover:text-emerald-700"
                        >
                          {t("ops.trip.weight_kg")}
                          {shopSortKey === "weight" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        {t("ops.rate.modal.market_rate")}
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => toggleShopSort("rate")}
                          className="flex items-center justify-center gap-1 w-full hover:text-emerald-700"
                        >
                          {t("ops.rate.modal.rate")}
                          {shopSortKey === "rate" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => toggleShopSort("amount")}
                          className="flex items-center justify-center gap-1 w-full hover:text-emerald-700"
                        >
                          {t("ops.rate.modal.amount")}
                          {shopSortKey === "amount" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDeliveries.map(({ row: delivery, originalIndex }) => {
                      const rate = normalizeRate(delivery.rate);
                      const isValid = isValidSellingRate(rate);
                      const amount = isValid ? Number((delivery.weight * (rate as number)).toFixed(2)) : 0;
                      const marketRateValue = suggestedMarketRate(delivery, tripDateVenRate);
                      const masterShop = resolveShopMaster(delivery, shopMasterLookup);
                      const association = masterShop?.associationType?.trim() ?? "";
                      const paperRate = Number(masterShop?.paperRate ?? 0);
                      const hasPaperRate = Number.isFinite(paperRate) && paperRate > 0;
                      const belowMin = rate != null && rate < 50;
                      const aboveMax = rate != null && rate > 300;
                      const missingForLock = lockAttempted && !isValid;

                      return (
                        <tr
                          key={delivery.id}
                          className={`border-b border-slate-100 transition-colors ${
                            missingForLock
                              ? "bg-red-50"
                              : originalIndex % 2 === 0
                                ? "bg-white hover:bg-emerald-50/30"
                                : "bg-slate-50/40 hover:bg-emerald-50/30"
                          }`}
                        >
                          <td className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
                            {originalIndex + 1}
                          </td>
                          <td className="min-w-[220px] px-3 py-3 text-xs text-slate-800">
                            <div className="font-bold text-slate-900">{displayRateEntryShopName(delivery.shopName, language)}</div>
                            {masterShop && (
                              <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                <span>{masterShop.city}</span>
                                <span>•</span>
                                <span className="tabular-nums">Bal ₹ {formatInr(masterShop.currentBalance ?? 0)}</span>
                              </div>
                            )}
                            {!masterShop && shopsLoading && (
                              <div className="mt-1 text-[10px] font-semibold text-slate-500">
                                {t("ops.rate.modal.shop_master_loading")}
                              </div>
                            )}
                          </td>
                          <td className="min-w-[150px] px-3 py-3 text-xs">
                            {association ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                                  association === "Association"
                                    ? "border-violet-200 bg-violet-50 text-violet-700"
                                    : association === "Non-Association"
                                      ? "border-slate-200 bg-slate-50 text-slate-600"
                                      : association === "Direct"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                }`}
                              >
                                <Users size={12} />
                                {displayRateEntryName(association, language)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-xs">
                            {hasPaperRate ? (
                              <span className="inline-flex items-center justify-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 tabular-nums">
                                <FileText size={12} />
                                {paperRate}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-xs font-semibold text-emerald-600">
                            {delivery.birds.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-center text-xs font-semibold text-orange-500">
                            {delivery.weight.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-center text-xs font-semibold text-sky-600">
                            {marketRateValue != null ? (
                              <span className="inline-flex items-center overflow-hidden rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-xs">
                                <span className="px-2 py-1 tabular-nums">₹ {Number(marketRateValue).toFixed(2)}</span>
                                {!rateLocked && (
                                  <button
                                    type="button"
                                    onClick={() => applyMarketRate(originalIndex, marketRateValue)}
                                    disabled={saving}
                                    className="border-l border-sky-200 bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {t("ops.rate.modal.use_market")}
                                  </button>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {rateLocked ? (
                              <span className="block text-center text-sm font-bold text-slate-600">
                                {rate != null ? rate.toFixed(2) : "—"}
                              </span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={rate === null ? "" : rate}
                                  placeholder="₹"
                                  disabled={saving}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const updated = [...deliveries];
                                    const num = value === "" ? null : Number(value);
                                    (updated[originalIndex] as Trip["deliveries"][number]).rate = num;
                                    setDeliveries(updated);
                                  }}
                                  className={`h-8 w-[92px] rounded-lg border px-2 text-center text-sm font-semibold outline-none no-spinner ${
                                    rate == null
                                      ? "border-slate-300 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                      : isValid
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                        : "border-red-500 bg-red-50 text-red-700"
                                  }`}
                                />
                                {belowMin && <p className="mt-0.5 text-[10px] text-red-500">⚠ {t("ops.rate.modal.min_rate")}</p>}
                                {aboveMax && <p className="mt-0.5 text-[10px] text-red-500">⚠ {t("ops.rate.modal.max_rate")}</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-xs font-semibold text-slate-700">
                            ₹ {formatInr(amount)}
                          </td>
                        </tr>
                      );
                    })}
                    {pagedDeliveries.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <Search size={20} />
                            <p className="text-xs font-medium">No shops match &quot;{shopSearch}&quot;</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredSortedDeliveries.length > 0 && (
              <Pagination
                page={shopPage}
                pageSize={shopPageSize}
                totalItems={filteredSortedDeliveries.length}
                onPageChange={setShopPage}
                onPageSizeChange={(nextPageSize) => {
                  setShopPageSize(nextPageSize);
                  setShopPage(1);
                }}
                disabled={saving}
                ariaLabel={t("ops.rate.modal.shop_rates_pagination")}
                className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            )}
          </div>

          {/* Footer — totals & actions, synced */}
          <div className="bg-slate-50/95 border-t border-slate-200 px-5 py-3 shrink-0 rounded-b-2xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Weight</p>
                  <p className="text-[13px] font-extrabold text-slate-800 tabular-nums">{totals.totalWeight.toFixed(2)} KG</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Amount</p>
                  <p className="text-[13px] font-extrabold text-emerald-800 tabular-nums">₹ {formatInr(totals.totalAmount)}</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-sky-700 font-semibold">Avg Rate</p>
                  <p className="text-[13px] font-extrabold text-sky-800 tabular-nums">₹ {totals.avgRate.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Progress</p>
                  <p className="text-[13px] font-extrabold text-amber-800 tabular-nums">
                    {totals.ratedCount}/{deliveries.length} • {totals.progressPct}%
                  </p>
                </div>
              </div>

              {rateLocked ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {t("common.close")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={resetRates}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-sky-300 bg-white text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      {t("ops.rate.modal.reset_rates")}
                    </button>
                    <button
                      type="button"
                      onClick={applyMarketRates}
                      disabled={saving || !canApplyMarketRates}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orange-300 bg-orange-50 text-sm font-semibold text-orange-700 transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:border-orange-400 hover:bg-orange-100 hover:text-orange-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <IndianRupee size={14} />
                      {t("ops.rate.modal.apply_market_rates")}
                      {shopSearch && <span className="text-[10px]">(filtered)</span>}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmSave("save")}
                      disabled={saving || !isDirty || hasInvalidEnteredRate}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                        isDirty
                          ? "border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-200 hover:bg-amber-100"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800"
                      }`}
                      title={t("ops.rate.modal.save_progress")}
                    >
                      <Save size={14} />
                      {saving ? t("ops.rate.modal.saving") : t("ops.rate.modal.save_progress")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (saving) return;
                        setLockAttempted(true);
                        if (!canLock) {
                          const firstMissing = deliveries.findIndex(
                            (row) => !isValidSellingRate(normalizeRate(row.rate))
                          );
                          if (firstMissing >= 0) {
                            const idxInFiltered = filteredSortedDeliveries.findIndex(
                              (f) => f.originalIndex === firstMissing
                            );
                            if (idxInFiltered >= 0) {
                              setShopPage(Math.floor(idxInFiltered / shopPageSize) + 1);
                            } else {
                              setShopPage(Math.floor(firstMissing / shopPageSize) + 1);
                            }
                          }
                          return;
                        }
                        setShowConfirm(true);
                      }}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold shadow-sm transition-[color,background-color,box-shadow,transform] duration-150 hover:bg-emerald-700 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Lock size={14} className="text-orange-200" />
                      {saving ? t("ops.rate.modal.locking") : t("ops.rate.modal.lock_submit")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShellModal>
    </>
  );
}
