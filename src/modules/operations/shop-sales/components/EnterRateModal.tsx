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
  PackageCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
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
} from "../utils/rateEntryDisplay";
import type { RateEntryMarketRateMasterDto } from "../utils/rateEntryMarketMaster";
import { addCalendarDays } from "../utils/rateEntryMarketMaster";

const SHOPS_PAGE_SIZE = 10; // at least 10 shops in single view

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

function formatDdMm(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

type ShopSortKey = "time" | "shopName" | "birds" | "weight" | "rate" | "amount";

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
  const [shopSortKey, setShopSortKey] = useState<ShopSortKey>("time");
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
    setShopSortKey("time");
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

  const marketTwoDays = useMemo(() => {
    if (!trip?.tripDate || !marketMaster) return [];
    const today = trip.tripDate;
    const yesterday = addCalendarDays(today, -1);
    return [yesterday, today].map((date) => {
      const comp = marketMaster.companyRates.find((r) => r.date === date);
      const add = marketMaster.additionalMetrics.find((r) => r.date === date);
      return { date, comp, add, isToday: date === today };
    });
  }, [trip?.tripDate, marketMaster]);

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
    list.sort((a, b) => {
      const dir = shopSortDir === "asc" ? 1 : -1;
      const ra = a.row;
      const rb = b.row;
      switch (shopSortKey) {
        case "time":
          return (a.originalIndex - b.originalIndex) * dir;
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
  }, [deliveries, shopSortKey, shopSortDir]);

  const shopPageCount = Math.max(1, Math.ceil(filteredSortedDeliveries.length / SHOPS_PAGE_SIZE));
  const pagedDeliveries = useMemo(() => {
    const start = (shopPage - 1) * SHOPS_PAGE_SIZE;
    return filteredSortedDeliveries.slice(start, start + SHOPS_PAGE_SIZE);
  }, [filteredSortedDeliveries, shopPage]);

  useEffect(() => {
    if (shopPage <= shopPageCount) return;
    const timer = window.setTimeout(() => setShopPage(shopPageCount), 0);
    return () => window.clearTimeout(timer);
  }, [shopPage, shopPageCount]);

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
            setShopPage(Math.floor(idxInFiltered / SHOPS_PAGE_SIZE) + 1);
          } else {
            setShopPage(Math.floor(firstMissing / SHOPS_PAGE_SIZE) + 1);
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

  const pageNumbers = Array.from({ length: shopPageCount }, (_, i) => i + 1);

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
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6 flex flex-col items-center gap-3">
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
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
                <button onClick={() => confirmSave("lock")} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-medium text-white shadow-sm">
                  {saving ? t("ops.rate.modal.locking") : t("ops.rate.modal.lock_cannot_edit")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <AppShellModal open={open} onClose={onClose} panelClassName="bg-white">
        <div className="bg-white w-full h-full flex flex-col relative overflow-hidden rounded-2xl">
          {/* Header - logo same size as rate entry table font/size, no subtitle TRP... */}
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Store size={17} />
              </span>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900">
                Enter shop wise rate
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-800 tabular-nums">
                  {totals.ratedCount}/{deliveries.length} • {totals.progressPct}%
                </span>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center border border-slate-200 bg-white">
                <X size={16} className="text-slate-600" />
              </button>
            </div>
          </div>

          {/* Trip info - increased size */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3 shrink-0 bg-slate-50/70 border-b border-slate-100">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <PackageCheck size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trip No</p>
                <p className="text-[14px] font-bold text-emerald-700 truncate">{trip.tripNo}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
                <Truck size={16} className="text-sky-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Vehicle</p>
                <p className="text-[14px] font-bold text-slate-900 truncate">{formatVehicleNumber(trip.vehicleNo)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CalendarDays size={16} className="text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</p>
                <p className="text-[14px] font-bold text-slate-900 truncate">{formatRateEntryTripDate(trip.tripDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Calculator size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total</p>
                <p className="text-[14px] font-bold text-slate-900 tabular-nums">{deliveries.length} shops • {totals.totalWeight.toFixed(1)} KG</p>
              </div>
            </div>
          </div>

          {/* Market Rate - only 2 days, today highlighted, no extra texts like Market Rate Master Quarter Sample Synced Window... */}
          {marketTwoDays.length > 0 && (
            <div className="px-5 py-3 bg-white border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {marketTwoDays.map(({ date, comp, add, isToday }) => (
                  <div
                    key={date}
                    className={`rounded-xl border px-3 py-2.5 ${
                      isToday ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[12px] font-bold ${isToday ? "text-emerald-800" : "text-slate-700"}`}>
                        {formatDdMm(date)} {isToday ? "• Today" : "• Yesterday"}
                      </p>
                      {isToday && <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold">Today</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg bg-white border border-slate-200 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-slate-500">Vencob</p>
                        <p className="font-bold text-slate-800 tabular-nums">{comp?.vencobRate != null ? `₹ ${Number(comp.vencobRate).toFixed(2)}` : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-200 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-slate-500">Vij/Gun</p>
                        <p className="font-bold text-slate-800 tabular-nums">{comp?.vencobVii != null ? comp.vencobVii.toFixed(2) : "—"} / {comp?.vencobGun != null ? comp.vencobGun.toFixed(2) : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-200 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-slate-500">Sneha</p>
                        <p className="font-bold text-slate-800 tabular-nums">{comp?.sneha != null ? comp.sneha.toFixed(2) : "—"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(loadError || lockError) && (
            <div className="px-5 py-2 border-b border-red-200 bg-red-50 flex items-center gap-2 shrink-0">
              <AlertCircle size={14} className="text-red-600" />
              <span className="text-xs font-medium text-red-700">{lockError || loadError}</span>
            </div>
          )}

          {/* Shop table - simple, not bold, perfect rate entry table wise, 10 shops, equally divided, no drag */}
          <div className="px-5 py-3 flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="h-full overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="w-[7%] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button type="button" onClick={() => toggleShopSort("time")} className="w-full flex items-center justify-center gap-1 hover:text-emerald-700">
                          S.No {shopSortKey === "time" && <span className="text-emerald-600">{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[22%] px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Shop Name</th>
                      <th className="w-[13%] px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Association</th>
                      <th className="w-[10%] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">Paper Rate</th>
                      <th className="w-[8%] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button type="button" onClick={() => toggleShopSort("birds")} className="w-full flex items-center justify-center gap-1 hover:text-emerald-700">
                          Birds {shopSortKey === "birds" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[10%] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button type="button" onClick={() => toggleShopSort("weight")} className="w-full flex items-center justify-center gap-1 hover:text-emerald-700">
                          Weight {shopSortKey === "weight" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[15%] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button type="button" onClick={() => toggleShopSort("rate")} className="w-full flex items-center justify-center gap-1 hover:text-emerald-700">
                          Rate {shopSortKey === "rate" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[15%] px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                        <button type="button" onClick={() => toggleShopSort("amount")} className="w-full flex items-center justify-center gap-1 hover:text-emerald-700">
                          Amount {shopSortKey === "amount" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDeliveries.map(({ row: delivery, originalIndex }) => {
                      const rate = normalizeRate(delivery.rate);
                      const isValid = isValidSellingRate(rate);
                      const amount = isValid ? Number((delivery.weight * (rate as number)).toFixed(2)) : 0;
                      const masterShop = resolveShopMaster(delivery, shopMasterLookup);
                      const association = masterShop?.associationType?.trim() ?? "";
                      const paperRate = Number(masterShop?.paperRate ?? 0);
                      const hasPaperRate = Number.isFinite(paperRate) && paperRate > 0;
                      const belowMin = rate != null && rate < 50;
                      const aboveMax = rate != null && rate > 300;
                      const missingForLock = lockAttempted && !isValid;

                      return (
                        <tr key={delivery.id} className={`border-b border-slate-100 ${missingForLock ? "bg-red-50" : originalIndex % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-50"}`}>
                          <td className="px-2 py-2.5 text-center text-[12px] font-medium text-slate-600 tabular-nums">{originalIndex + 1}</td>
                          <td className="px-2 py-2.5">
                            <div className="text-[13px] font-medium text-slate-800 leading-tight truncate">
                              {displayRateEntryShopName(delivery.shopName, language)}
                            </div>
                            {masterShop && <div className="text-[11px] font-normal text-slate-500 truncate">{masterShop.city}</div>}
                          </td>
                          <td className="px-2 py-2.5">
                            {association ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 truncate max-w-full">
                                {displayRateEntryName(association, language)}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[12px]">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            {hasPaperRate ? (
                              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 tabular-nums">
                                {paperRate}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[12px]">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[12px] font-medium text-slate-700 tabular-nums">{delivery.birds.toLocaleString()}</td>
                          <td className="px-2 py-2.5 text-center text-[12px] font-medium text-slate-700 tabular-nums">{delivery.weight.toFixed(2)}</td>
                          <td className="px-2 py-2.5">
                            {rateLocked ? (
                              <span className="block text-center text-[13px] font-medium text-slate-700">{rate != null ? rate.toFixed(2) : "—"}</span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={rate === null ? "" : rate}
                                  placeholder="₹"
                                  disabled={saving}
                                  onChange={(e) => {
                                    const updated = [...deliveries];
                                    const num = e.target.value === "" ? null : Number(e.target.value);
                                    (updated[originalIndex] as Trip["deliveries"][number]).rate = num;
                                    setDeliveries(updated);
                                  }}
                                  className={`h-8 w-full max-w-[90px] rounded-lg border px-2 text-center text-[13px] font-medium outline-none no-spinner ${
                                    rate == null ? "border-slate-300 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100" : isValid ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-red-400 bg-red-50 text-red-700"
                                  }`}
                                />
                                {belowMin && <p className="mt-0.5 text-[9px] text-red-500">Min 50</p>}
                                {aboveMax && <p className="mt-0.5 text-[9px] text-red-500">Max 300</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[12px] font-medium text-slate-800 tabular-nums">₹ {formatInr(amount)}</td>
                        </tr>
                      );
                    })}
                    {pagedDeliveries.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400 text-[12px]">No shops</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination - light green Previous/Next on right side corner */}
            {filteredSortedDeliveries.length > 0 && (
              <div className="mt-3 flex items-center justify-end">
                <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-1.5 py-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShopPage((p) => Math.max(1, p - 1))}
                    disabled={shopPage <= 1 || saving}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-40"
                  >
                    <ChevronLeft size={12} /> Previous
                  </button>
                  {pageNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setShopPage(num)}
                      disabled={saving}
                      className={`h-7 w-7 rounded-md text-[11px] font-bold tabular-nums ${num === shopPage ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShopPage((p) => Math.min(shopPageCount, p + 1))}
                    disabled={shopPage >= shopPageCount || saving}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-40"
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white border-t border-slate-200 px-5 py-3 shrink-0 rounded-b-2xl">
            {rateLocked ? (
              <div className="flex justify-end">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                  {t("common.close")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={resetRates} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <RotateCcw size={12} /> Reset
                  </button>
                  <button type="button" onClick={applyMarketRates} disabled={saving || !canApplyMarketRates} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-[12px] font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50">
                    <IndianRupee size={12} /> Apply Market Rates
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={() => confirmSave("save")} disabled={saving || !isDirty || hasInvalidEnteredRate} className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-[12px] font-medium disabled:opacity-50 ${isDirty ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    <Save size={12} /> {saving ? t("ops.rate.modal.saving") : t("ops.rate.modal.save_progress")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (saving) return;
                      setLockAttempted(true);
                      if (!canLock) {
                        const firstMissing = deliveries.findIndex((row) => !isValidSellingRate(normalizeRate(row.rate)));
                        if (firstMissing >= 0) {
                          const idx = filteredSortedDeliveries.findIndex((f) => f.originalIndex === firstMissing);
                          if (idx >= 0) setShopPage(Math.floor(idx / SHOPS_PAGE_SIZE) + 1);
                          else setShopPage(Math.floor(firstMissing / SHOPS_PAGE_SIZE) + 1);
                        }
                        return;
                      }
                      setShowConfirm(true);
                    }}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Lock size={12} className="text-emerald-100" /> {saving ? t("ops.rate.modal.locking") : t("ops.rate.modal.lock_submit")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </AppShellModal>
    </>
  );
}
