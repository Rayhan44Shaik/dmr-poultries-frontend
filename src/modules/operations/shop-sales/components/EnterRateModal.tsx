import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Truck,
  CalendarDays,
  Store,
  CheckCircle2,
  AlertCircle,
  Lock,
  Save,
  RotateCcw,
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
import { addCalendarDays, sizeCategoryHeaders } from "../utils/rateEntryMarketMaster";

const SHOPS_PAGE_SIZE = 10;

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
  return cleanRateEntryShopName(value).toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function resolveShopMaster(delivery: Trip["deliveries"][number], lookup: ShopMasterLookup): Shop | null {
  if (delivery.shopId > 0) {
    const byId = lookup.byId.get(delivery.shopId);
    if (byId) return byId;
  }
  return lookup.byName.get(shopLookupKey(delivery.shopName)) ?? null;
}

function formatInr(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDdMmYy(iso: string): string {
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
  const [shopSearch, setShopSearch] = useState("");

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
    setShopSearch("");
    setDeliveries(trip.deliveries.map((d) => ({ ...d, rate: normalizeRate(d.rate) })));
  }, [trip]);

  const hasInvalidEnteredRate = useMemo(
    () => deliveries.some((row) => { const rate = normalizeRate(row.rate); return rate !== null && !isValidSellingRate(rate); }),
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
    return (trip as Trip & { marketRateMaster?: RateEntryMarketRateMasterDto | null } | null)?.marketRateMaster;
  }, [trip]);

  // 3 days: yesterday, today, tomorrow - like market rates page but only 3 days, today highlighted
  const marketThreeDays = useMemo(() => {
    if (!trip?.tripDate || !marketMaster) return [];
    const today = trip.tripDate;
    const yesterday = addCalendarDays(today, -1);
    const tomorrow = addCalendarDays(today, 1);
    return [yesterday, today, tomorrow].map((date) => {
      const comp = marketMaster.companyRates.find((r) => r.date === date);
      const add = marketMaster.additionalMetrics.find((r) => r.date === date);
      const size = marketMaster.sizeCategoryBreakdown.find((r) => r.date === date);
      return { date, comp, add, size, isToday: date === today };
    });
  }, [trip?.tripDate, marketMaster]);

  const sizeKeys = useMemo(() => sizeCategoryHeaders(marketMaster).slice(0, 5), [marketMaster]);

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
    const progressPct = deliveries.length ? Math.round((ratedCount / deliveries.length) * 100) : 0;
    return { ratedCount, totalWeight, totalAmount, totalBirds, progressPct };
  }, [deliveries]);

  const filteredSortedDeliveries = useMemo(() => {
    let list = deliveries.map((row, idx) => ({ row, originalIndex: idx }));
    if (shopSearch.trim()) {
      const q = shopSearch.trim().toLowerCase();
      list = list.filter(({ row }) => row.shopName.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const dir = shopSortDir === "asc" ? 1 : -1;
      const ra = a.row;
      const rb = b.row;
      switch (shopSortKey) {
        case "time": return (a.originalIndex - b.originalIndex) * dir;
        case "shopName": return ra.shopName.localeCompare(rb.shopName) * dir;
        case "birds": return (ra.birds - rb.birds) * dir;
        case "weight": return (ra.weight - rb.weight) * dir;
        case "rate": { const av = normalizeRate(ra.rate) ?? -1; const bv = normalizeRate(rb.rate) ?? -1; return (av - bv) * dir; }
        case "amount": { const ar = normalizeRate(ra.rate) ? ra.weight * (normalizeRate(ra.rate) as number) : 0; const br = normalizeRate(rb.rate) ? rb.weight * (normalizeRate(rb.rate) as number) : 0; return (ar - br) * dir; }
        default: return 0;
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

  const resetRates = () => {
    if (!trip) return;
    setLockError(null);
    setLockAttempted(false);
    setDeliveries(trip.deliveries.map((d) => ({ ...d, rate: normalizeRate(d.rate) })));
  };

  const confirmSave = async (mode: "save" | "lock") => {
    if (saving) return;
    if (mode === "save") {
      if (hasInvalidEnteredRate) { setLockError(t("ops.rate.modal.rate_range_error")); return; }
      if (!isDirty) return;
    }
    if (mode === "lock") {
      setLockAttempted(true);
      if (!canLock) {
        const firstMissing = deliveries.findIndex((row) => !isValidSellingRate(normalizeRate(row.rate)));
        if (firstMissing >= 0) {
          const idx = filteredSortedDeliveries.findIndex((f) => f.originalIndex === firstMissing);
          setShopPage(idx >= 0 ? Math.floor(idx / SHOPS_PAGE_SIZE) + 1 : Math.floor(firstMissing / SHOPS_PAGE_SIZE) + 1);
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
      setTimeout(() => { setShowSuccessToast(false); if (mode === "lock") onClose(); }, 1200);
    } finally { setBusy(false); }
  };

  const toggleShopSort = (key: ShopSortKey) => {
    if (shopSortKey === key) setShopSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setShopSortKey(key); setShopSortDir("asc"); }
    setShopPage(1);
  };

  if (!open || !trip) return null;

  const pageNumbers = Array.from({ length: shopPageCount }, (_, i) => i + 1);

  return (
    <>
            <style>{`
        .no-spinner::-webkit-inner-spin-button,.no-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        .no-spinner{-moz-appearance:textfield}
        /* global animations - like trip list */
        .btn-anim{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}
        .btn-anim:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .btn-anim:active{transform:scale(0.96)}
        .x-anim{transition:all 0.25s ease}
        .x-anim:hover{transform:rotate(90deg) scale(1.1);background:#f1f5f9}
        .x-anim:active{transform:rotate(90deg) scale(0.9)}
        /* reset animation like trip list - icon spins -180 */
        .reset-anim{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}
        .reset-anim svg{transition:transform 0.45s cubic-bezier(0.4,0,0.2,1)}
        .reset-anim:hover{transform:translateY(-1px) scale(1.03);box-shadow:0 4px 12px rgba(0,0,0,0.08);background:#f8fafc}
        .reset-anim:hover svg{transform:rotate(-180deg)}
        .reset-anim:active{transform:scale(0.96)}
        .reset-anim:active svg{transform:rotate(-360deg)}
        /* cancel animation */
        .cancel-anim{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}
        .cancel-anim:hover{transform:translateY(-1px) scale(1.03);box-shadow:0 4px 12px rgba(0,0,0,0.08);background:#f8fafc}
        .cancel-anim:active{transform:scale(0.96)}
        /* save animation - enhanced */
        @keyframes save-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.15)}}
        .save-anim{transition:all 0.25s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden}
        .save-anim:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 8px 20px rgba(0,0,0,0.15)}
        .save-anim:active{transform:scale(0.97)}
        .save-anim svg{transition:transform 0.3s ease}
        .save-anim:hover svg{animation:save-float 0.7s ease infinite}
        .save-anim::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent);transition:left 0.5s}
        .save-anim:hover::after{left:100%}
        /* save & lock big lock animation - more enhanced */
        @keyframes lock-bounce{0%,100%{transform:translateY(0) rotate(0deg)}35%{transform:translateY(-4px) rotate(-12deg)}70%{transform:translateY(0) rotate(0deg)}}10%{transform:scale(1.4) translateY(-4px) rotate(-15deg)}20%{transform:scale(1.35) translateY(-2px) rotate(5deg)}30%{transform:scale(1.5) translateY(-6px) rotate(15deg)}40%{transform:scale(1.3) translateY(0) rotate(-12deg)}50%{transform:scale(1.2) translateY(0) rotate(0deg)}60%{transform:scale(1.4) translateY(-3px) rotate(12deg)}70%{transform:scale(1.3) translateY(-1px) rotate(-8deg)}80%{transform:scale(1.25) translateY(0) rotate(6deg)}90%{transform:scale(1.15) translateY(0) rotate(0deg)}}
        @keyframes lock-open-close{0%,100%{transform:translateY(0) rotate(0deg)}35%{transform:translateY(-5px) rotate(-14deg)}70%{transform:translateY(0) rotate(0deg)}}10%{transform:scale(1.4) translateY(-6px) rotate(-18deg)}20%{transform:scale(1.3) translateY(-2px) rotate(0deg)}30%{transform:scale(1.5) translateY(-5px) rotate(18deg)}40%{transform:scale(1.2) translateY(0) rotate(-10deg)}50%{transform:scale(1) translateY(0) rotate(0deg)}60%{transform:scale(1.35) translateY(-4px) rotate(10deg)}70%{transform:scale(1.2) translateY(-1px) rotate(-8deg)}80%{transform:scale(1.15) translateY(0) rotate(5deg)}90%{transform:scale(1.1) translateY(0) rotate(0deg)}100%{transform:scale(1) translateY(0) rotate(0deg)}}
        .lock-anim{transition:all 0.3s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden}
        .lock-anim:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 12px 28px rgba(249,115,22,0.35)}
        .lock-anim:active{transform:scale(0.96)}
        .lock-anim svg{transition:transform 0.3s ease; transform-origin:center}
        .lock-anim:hover svg{animation:lock-open-close 0.6s ease-in-out; transform-origin:center left}
        .lock-anim:hover .lock-icon-wrap{animation:lock-pulse 1.5s infinite}
        .lock-anim:hover .lock-icon-wrap{animation:lock-pulse 1.2s infinite, lock-open-close 0.9s ease infinite}
        .lock-anim::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent);transition:left 0.6s}
        .lock-anim:hover::before{left:100%}
        .rate-input-market{border:1px solid #e2e8f0;background:white;border-radius:8px;padding:6px 8px;text-align:center;font-weight:600;transition:all 0.2s}
        .rate-input-market:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.1);outline:none}
        .rate-input-market.valid{border-color:#10b981;background:#ecfdf5;color:#065f46}
        .rate-input-market.invalid{border-color:#ef4444;background:#fef2f2;color:#991b1b}
        /* perf scroll - fix freezing */
        @keyframes lock-pulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.45)}50%{box-shadow:0 0 0 8px rgba(249,115,22,0)}}
        .lock-icon-wrap{animation:lock-pulse 2s infinite; border-radius:9999px; transform-origin:center left}
        .scroll-perf{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;transform:translateZ(0);will-change:scroll-position}
        .no-drag-table{overflow:hidden;transform:translateZ(0)}
        .no-drag-table table{width:100%;table-layout:fixed}
        @media (min-width:1280px){.modal-responsive{max-width:1150px}} @media (min-width:1536px){.modal-responsive{max-width:1250px}} @media (min-width:1920px){.modal-responsive{max-width:1350px}} @media (min-width:2560px){.modal-responsive{max-width:1500px}}
      `}</style>

      {showSuccessToast && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6 flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={28} /></div>
            <div className="text-center"><h3 className="text-base font-bold text-slate-800">{t("ops.rate.modal.saved_title")}</h3><p className="text-xs text-slate-500 mt-0.5">{t("ops.rate.modal.saved_desc")}</p></div>
          </div>
        </div>, document.body
      )}

      {showConfirm && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0"><AlertCircle size={20} /></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">{t("ops.rate.modal.locking_title")}</h3>
                <p className="text-sm text-slate-600 mt-1">{t("ops.rate.modal.locking_desc")}</p>
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Total Weight</span><span className="font-bold text-slate-800">{totals.totalWeight.toFixed(2)} KG</span></div>
                  <div className="flex justify-between mt-1"><span className="text-slate-500">Grand Amount</span><span className="font-bold text-emerald-700">₹ {formatInr(totals.totalAmount)}</span></div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cancel-anim"><span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={14} /></span> Cancel</button>
              <button onClick={() => confirmSave("lock")} disabled={saving} className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 border border-orange-600 text-white text-sm font-bold shadow-md hover:bg-orange-700 hover:shadow-lg lock-anim"><span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white border border-orange-200 text-orange-600 shadow-sm lock-icon-wrap"><Lock size={16} /></span> Lock</button>
            </div>
          </div>
        </div>, document.body
      )}

      <AppShellModal open={open} onClose={onClose} panelClassName="bg-white modal-responsive mx-auto">
        <div className="bg-white w-full h-full flex flex-col relative overflow-hidden rounded-2xl max-h-full mx-auto animate-fade-in-up">
          {/* Header - logo with hen dance animation like refresh + trip list search animation */}
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
            <div className="flex items-center gap-3 group">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm group-hover:animate-[var(--animate-brand-dance)] motion-safe:group-hover:animate-[var(--animate-brand-dance)]"><Store size={17} className="group-hover:animate-[var(--animate-action-search)]" /></span>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Enter shop wise rate</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-800 tabular-nums">{totals.ratedCount}/{deliveries.length} • {totals.progressPct}%</span>
              </div>
              <button onClick={onClose} className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95 x-anim"><span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={16} /></span></button>
            </div>
          </div>

          {/* Trip info - TRIP NO light green, Vehicle light blue, Date light violet, Total light amber - perfect colour neat */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3 shrink-0 bg-slate-50/70 border-b border-slate-100">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm btn-anim">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-emerald-200 text-emerald-700 shadow-sm"><PackageCheck size={16} /></span>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-emerald-700/70 font-semibold">Trip No</p><p className="text-[13px] font-bold text-emerald-900 truncate">{trip.tripNo}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm btn-anim">
              <div className="h-9 w-9 rounded-lg bg-white border border-sky-200 flex items-center justify-center text-sky-700 shadow-sm"><Truck size={16} /></div>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-sky-700/70 font-semibold">Vehicle</p><p className="text-[13px] font-bold text-sky-900 truncate">{formatVehicleNumber(trip.vehicleNo)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm btn-anim">
              <div className="h-9 w-9 rounded-lg bg-white border border-violet-200 flex items-center justify-center text-violet-700 shadow-sm"><CalendarDays size={16} /></div>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-violet-700/70 font-semibold">Date</p><p className="text-[13px] font-bold text-violet-900 truncate">{formatRateEntryTripDate(trip.tripDate)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm btn-anim">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-amber-200 text-amber-700 shadow-sm"><Calculator size={16} /></span>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-amber-700/70 font-semibold">Total</p><p className="text-[12px] font-bold text-amber-900 tabular-nums leading-tight">{deliveries.length} shops • {totals.totalBirds.toLocaleString()} birds • {totals.totalWeight.toFixed(1)} KG</p></div>
            </div>
          </div>

          {/* Market Rate - 3 tables side wise like Masters > Market Rates image, only 3 days, today highlighted, no Window texts - with gap */}
          {marketThreeDays.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0 max-h-[22vh] overflow-auto scroll-perf scroll-smooth">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                {/* Company & Association Rates */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">📊</span>
                      <p className="text-[12px] font-bold text-slate-800">Company & Association Rates</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">3 days • Today highlighted</span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                          <th className="px-2 py-2 text-left font-semibold">Date</th>
                          <th className="px-2 py-2 text-center font-semibold">Sneha / Farmer</th>
                          <th className="px-2 py-2 text-center font-semibold">Ven Vij</th>
                          <th className="px-2 py-2 text-center font-semibold">Ven Gun</th>
                          <th className="px-2 py-2 text-center font-semibold">Ass Vij</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketThreeDays.map(({ date, comp, isToday }) => (
                          <tr key={date} className={`border-t border-slate-100 ${isToday ? "bg-indigo-50/60" : "bg-white"}`}>
                            <td className="px-2 py-2 font-medium text-slate-700">{formatDdMmYy(date)}</td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.sneha != null ? Number(comp.sneha).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.vencobVii != null ? Number(comp.vencobVii).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.vencobGun != null ? Number(comp.vencobGun).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.associationVii != null ? Number(comp.associationVii).toFixed(0) : "—"}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional Metrics Entry */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-sky-600">Σ</span>
                      <p className="text-[12px] font-bold text-slate-800">Additional Metrics Entry</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">3 days</span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                          <th className="px-2 py-2 text-left font-semibold">Date</th>
                          <th className="px-2 py-2 text-center font-semibold">Vij</th>
                          <th className="px-2 py-2 text-center font-semibold">Gun</th>
                          <th className="px-2 py-2 text-center font-semibold">R.P</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketThreeDays.map(({ date, add, isToday }) => (
                          <tr key={date} className={`border-t border-slate-100 ${isToday ? "bg-indigo-50/60" : "bg-white"}`}>
                            <td className="px-2 py-2 font-medium text-slate-700">{formatDdMmYy(date)}</td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>{add?.vij != null ? Number(add.vij).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>{add?.gun != null ? Number(add.gun).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums font-bold ${isToday ? "bg-white border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-emerald-600"}`}>{add?.rp != null ? Number(add.rp).toFixed(0) : "—"}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Shop Rates Less Breakdown */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600">◈</span>
                      <p className="text-[12px] font-bold text-slate-800">Shop Rates Less Breakdown</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">3 days</span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                          <th className="px-2 py-2 text-left font-semibold">Date</th>
                          {sizeKeys.map((k) => (
                            <th key={k} className="px-2 py-2 text-center font-semibold">{k.replace(/^c/i, "")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {marketThreeDays.map(({ date, size, isToday }) => (
                          <tr key={date} className={`border-t border-slate-100 ${isToday ? "bg-indigo-50/60" : "bg-white"}`}>
                            <td className="px-2 py-2 font-medium text-slate-700">{formatDdMmYy(date)}</td>
                            {sizeKeys.map((k) => (
                              <td key={k} className="px-2 py-2">
                                <div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-white border-slate-200 font-bold text-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>
                                  {size?.columns?.[k] != null ? Number(size.columns[k]).toFixed(0) : "—"}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(loadError || lockError) && (
            <div className="px-5 py-2 border-b border-red-200 bg-red-50 flex items-center gap-2 shrink-0">
              <AlertCircle size={14} className="text-red-600" /><span className="text-xs font-medium text-red-700">{lockError || loadError}</span>
            </div>
          )}

          {/* Shop table search - same animation as trip list search + refresh hen + login close/open */}
          <div className="px-5 py-2 flex items-center gap-2 shrink-0 bg-white border-b border-slate-100">
            <div className="relative flex-1 max-w-[280px] group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:animate-[var(--animate-action-search)] motion-safe:group-hover:animate-[var(--animate-action-search)]"><Store size={14} /></span>
              <input
                type="search"
                value={shopSearch}
                onChange={(e) => { setShopSearch(e.target.value); setShopPage(1); }}
                placeholder="Search shops..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
            {shopSearch && (
              <button type="button" onClick={() => { setShopSearch(""); setShopPage(1); }} className="group relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 reset-anim">
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><X size={12} /></span> Clear
              </button>
            )}
            <span className="ml-auto text-[11px] font-medium text-slate-500 tabular-nums">{filteredSortedDeliveries.length} shops</span>
          </div>

          {/* Shop table - no colour for S.No/association/paper, birds weight same colour, amount simple, 10 shops, no drag, perfect middle with gaps */}
          <div className="px-5 py-3 flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm no-drag-table flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto scroll-perf scroll-smooth">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="w-[7%] px-2 py-3 text-center">
                        <button type="button" onClick={() => toggleShopSort("time")} className={`w-full flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "time" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          S.No {shopSortKey === "time" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[22%] px-2 py-3 text-left">
                        <button type="button" onClick={() => toggleShopSort("shopName")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "shopName" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          Shop Name {shopSortKey === "shopName" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[13%] px-2 py-3 text-left text-[12px] font-bold uppercase tracking-wider text-slate-600">Association</th>
                      <th className="w-[10%] px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-slate-600">Paper Rate</th>
                      <th className="w-[8%] px-2 py-3 text-center">
                        <button type="button" onClick={() => toggleShopSort("birds")} className={`w-full flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "birds" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          Birds {shopSortKey === "birds" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[10%] px-2 py-3 text-center">
                        <button type="button" onClick={() => toggleShopSort("weight")} className={`w-full flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "weight" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          Weight {shopSortKey === "weight" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[15%] px-2 py-3 text-center">
                        <button type="button" onClick={() => toggleShopSort("rate")} className={`w-full flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "rate" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          Rate {shopSortKey === "rate" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[15%] px-2 py-3 text-center">
                        <button type="button" onClick={() => toggleShopSort("amount")} className={`w-full flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "amount" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
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
                          <td className="px-2 py-3 text-center text-[13px] font-normal text-slate-700 tabular-nums">{originalIndex + 1}</td>
                          <td className="px-3 py-3">
                            <div className="text-[14px] font-medium text-slate-700 leading-tight truncate">{displayRateEntryShopName(delivery.shopName, language)}</div>
                            {masterShop && <div className="text-[11px] font-normal text-slate-500 truncate">{masterShop.city}</div>}
                          </td>
                          <td className="px-2 py-3"><span className="inline-flex items-center justify-center rounded-lg border bg-violet-50 border-violet-200 text-violet-800 px-2.5 py-1 text-[12px] font-medium truncate max-w-full">{association ? displayRateEntryName(association, language) : "—"}</span></td>
                          <td className="px-2 py-3 text-center"><span className="inline-flex items-center justify-center rounded-lg border bg-sky-50 border-sky-200 text-sky-800 px-2.5 py-1 text-[12px] font-semibold tabular-nums">{hasPaperRate ? paperRate : "—"}</span></td>
                          <td className="px-2 py-3 text-center text-[13px] font-normal text-slate-700 tabular-nums">{delivery.birds.toLocaleString()}</td>
                          <td className="px-2 py-3 text-center text-[13px] font-normal text-slate-700 tabular-nums">{delivery.weight.toFixed(2)}</td>
                          <td className="px-2 py-3">
                            {rateLocked ? (
                              <span className="block text-center text-[13px] font-semibold text-slate-800 tabular-nums rate-input-market valid">{rate != null ? rate.toFixed(2) : "—"}</span>
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
                                  className={`rate-input-market h-8 w-full max-w-[100px] text-[13px] no-spinner ${rate == null ? "" : isValid ? "valid" : "invalid"}`}
                                />
                                {belowMin && <p className="mt-0.5 text-[9px] text-red-500">Min 50</p>}
                                {aboveMax && <p className="mt-0.5 text-[9px] text-red-500">Max 300</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="inline-flex items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 text-[12px] font-semibold tabular-nums">
                              ₹ {formatInr(amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedDeliveries.length === 0 && (
                      <tr><td colSpan={8} className="py-10 text-center text-slate-400 text-[12px]">No shops</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredSortedDeliveries.length > 0 && (
              <div className="mt-3 flex items-center justify-end">
                <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-1.5 py-1 shadow-sm">
                  <button type="button" onClick={() => setShopPage((p) => Math.max(1, p - 1))} disabled={shopPage <= 1 || saving} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-40 btn-anim">
                    <ChevronLeft size={12} /> Previous
                  </button>
                  {pageNumbers.map((num) => (
                    <button key={num} type="button" onClick={() => setShopPage(num)} disabled={saving} className={`h-7 w-7 rounded-md text-[11px] font-bold tabular-nums btn-anim ${num === shopPage ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{num}</button>
                  ))}
                  <button type="button" onClick={() => setShopPage((p) => Math.min(shopPageCount, p + 1))} disabled={shopPage >= shopPageCount || saving} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-40 btn-anim">
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border-t border-slate-200 px-5 py-3 shrink-0 rounded-b-2xl">
            {rateLocked ? (
              <div className="flex justify-end"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 btn-anim">Close</button></div>
            ) : (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={resetRates} disabled={saving} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 reset-anim min-w-[100px]">
                    <RotateCcw size={16} /> Reset
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={onClose} className="group relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white text-[14px] font-semibold text-slate-600 hover:bg-slate-50 cancel-anim min-w-[110px]"><span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={14} /></span> Cancel</button>
                  <button type="button" onClick={() => confirmSave("save")} disabled={saving || !isDirty || hasInvalidEnteredRate} className={`group relative inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-[14px] font-bold disabled:opacity-50 save-anim min-w-[130px] hover:bg-emerald-100 hover:border-emerald-400`}>
                    <span className="inline-flex text-emerald-700 motion-safe:group-hover:animate-[var(--animate-action-edit)]"><Save size={16} /></span> Save
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
                          setShopPage(idx >= 0 ? Math.floor(idx / SHOPS_PAGE_SIZE) + 1 : Math.floor(firstMissing / SHOPS_PAGE_SIZE) + 1);
                        }
                        return;
                      }
                      setShowConfirm(true);
                    }}
                    disabled={saving}
                    className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-orange-600 border border-orange-600 text-white text-[15px] font-extrabold shadow-xl hover:bg-orange-700 hover:shadow-2xl hover:border-orange-700 disabled:opacity-50 lock-anim min-w-[190px]"
                  >
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white border border-orange-200 text-orange-600 shadow-sm lock-icon-wrap"><Lock size={20} /></span> Save & Lock
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
