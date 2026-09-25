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
  PackageCheck, Package, Scale,
  Calculator,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import { ActionTooltip } from "../../../../ui/ActionTooltip";
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

type ShopSortKey = "shopName" | "paperRate" | "time" | "birds" | "weight" | "rate" | "amount";

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
  const [localLanguage, setLocalLanguage] = useState(language);
  const [showMarketReference, setShowMarketReference] = useState(false);

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
    setShowMarketReference(false);
    setLocalLanguage(language);
    setDeliveries(trip.deliveries.map((d) => ({ ...d, rate: normalizeRate(d.rate) })));
  }, [trip, language]);

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

  // 2 days: yesterday, today - today highlighted, as per request only 2 days
  const marketThreeDays = useMemo(() => {
    if (!trip?.tripDate || !marketMaster) return [];
    const today = trip.tripDate;
    const yesterday = addCalendarDays(today, -1);
    return [yesterday, today].map((date) => {
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

  const marketLabels = useMemo(() => {
    if (localLanguage === "te") {
      return {
        companyTitle: "కంపెనీ & అసోసియేషన్ రేట్లు",
        additionalTitle: "అదనపు మెట్రిక్స్ ఎంట్రీ",
        shopBreakdownTitle: "షాప్ రేట్ల తగ్గింపు వివరాలు",
        threeDaysToday: "2 రోజులు • నేడు హైలైట్",
        threeDays: "2 రోజులు",
        date: "తేదీ",
        snehaFarmer: "స్నేహ / ఫార్మర్",
        venVij: "వెన్ విజ్",
        venGun: "వెన్ గన్",
        assVij: "అసో విజ్",
        vij: "విజ్",
        gun: "గన్",
        rp: "ఆర్.పి",
      };
    }
    return {
      companyTitle: "Company & Association Rates",
      additionalTitle: "Additional Metrics Entry",
      shopBreakdownTitle: "Shop Rates Less Breakdown",
      threeDaysToday: "2 days • Today highlighted",
      threeDays: "2 days",
      date: "Date",
      snehaFarmer: "Sneha / Farmer",
      venVij: "Ven Vij",
      venGun: "Ven Gun",
      assVij: "Ass Vij",
      vij: "Vij",
      gun: "Gun",
      rp: "R.P",
    };
  }, [localLanguage]);

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

  const loadTotals = useMemo(() => {
    const byLoad = new Map<number, { birds: number; weight: number }>();
    for (const delivery of deliveries) {
      const load = Math.max(1, Number(delivery.legIndex || 1));
      const current = byLoad.get(load) ?? { birds: 0, weight: 0 };
      current.birds += Number(delivery.birds || 0);
      current.weight += Number(delivery.weight || 0);
      byLoad.set(load, current);
    }
    return [...byLoad.entries()].sort(([a], [b]) => a - b);
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
      // Loads are always contiguous. User sorting applies within each load so
      // the single Load 2 divider remains meaningful and deterministic.
      const loadDiff = Math.max(1, Number(ra.legIndex || 1)) - Math.max(1, Number(rb.legIndex || 1));
      if (loadDiff !== 0) return loadDiff;
      const masterA = resolveShopMaster(ra, shopMasterLookup);
      const masterB = resolveShopMaster(rb, shopMasterLookup);
      switch (shopSortKey) {
        case "paperRate": {
          const pa = Number(masterA?.paperRate ?? 0);
          const pb = Number(masterB?.paperRate ?? 0);
          return (pa - pb) * dir;
        }
        case "shopName":
          return ra.shopName.localeCompare(rb.shopName) * dir;
        case "time": {
          const ta = String(
            (ra as { autoCaptureTime?: string }).autoCaptureTime || ""
          );
          const tb = String(
            (rb as { autoCaptureTime?: string }).autoCaptureTime || ""
          );
          if (ta || tb) {
            if (ta !== tb) return ta.localeCompare(tb) * dir;
          }
          return (a.originalIndex - b.originalIndex) * dir;
        }
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
  }, [deliveries, shopSortKey, shopSortDir, shopSearch, shopMasterLookup]);

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
        @keyframes lock-bounce{0%,100%{transform:translateY(0) rotate(0deg) scale(1)}30%{transform:translateY(-6px) rotate(-16deg) scale(1.18)}60%{transform:translateY(0) rotate(0deg) scale(1)}}35%{transform:translateY(-5px) rotate(-14deg)}70%{transform:translateY(0) rotate(0deg)}}35%{transform:translateY(-4px) rotate(-12deg)}70%{transform:translateY(0) rotate(0deg)}}10%{transform:scale(1.4) translateY(-4px) rotate(-15deg)}20%{transform:scale(1.35) translateY(-2px) rotate(5deg)}30%{transform:scale(1.5) translateY(-6px) rotate(15deg)}40%{transform:scale(1.3) translateY(0) rotate(-12deg)}50%{transform:scale(1.2) translateY(0) rotate(0deg)}60%{transform:scale(1.4) translateY(-3px) rotate(12deg)}70%{transform:scale(1.3) translateY(-1px) rotate(-8deg)}80%{transform:scale(1.25) translateY(0) rotate(6deg)}90%{transform:scale(1.15) translateY(0) rotate(0deg)}}
        @keyframes lock-open-close{0%{transform:translateY(0) rotate(0deg) scale(1)}15%{transform:translateY(-2px) rotate(-6deg) scale(1.05)}30%{transform:translateY(-6px) rotate(-16deg) scale(1.18)}45%{transform:translateY(-5px) rotate(-14deg) scale(1.15)}60%{transform:translateY(-2px) rotate(-6deg) scale(1.08)}75%{transform:translateY(0) rotate(0deg) scale(1)}100%{transform:translateY(0) rotate(0deg) scale(1)}}35%{transform:translateY(-5px) rotate(-14deg)}70%{transform:translateY(0) rotate(0deg)}}35%{transform:translateY(-5px) rotate(-14deg)}70%{transform:translateY(0) rotate(0deg)}}10%{transform:scale(1.4) translateY(-6px) rotate(-18deg)}20%{transform:scale(1.3) translateY(-2px) rotate(0deg)}30%{transform:scale(1.5) translateY(-5px) rotate(18deg)}40%{transform:scale(1.2) translateY(0) rotate(-10deg)}50%{transform:scale(1) translateY(0) rotate(0deg)}60%{transform:scale(1.35) translateY(-4px) rotate(10deg)}70%{transform:scale(1.2) translateY(-1px) rotate(-8deg)}80%{transform:scale(1.15) translateY(0) rotate(5deg)}90%{transform:scale(1.1) translateY(0) rotate(0deg)}100%{transform:scale(1) translateY(0) rotate(0deg)}}
        .lock-anim{transition:all 0.3s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden}
        .lock-anim:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 12px 28px rgba(249,115,22,0.35)}
        .lock-anim:active{transform:scale(0.96)}
        .lock-anim svg{transition:transform 0.3s ease; transform-origin:center}
        .lock-anim:hover svg{animation:lock-open-close 0.9s ease-in-out infinite; transform-origin:center left}
        .lock-anim:hover         .lock-anim:hover         .lock-anim::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent);transition:left 0.6s}
        .lock-anim:hover::before{left:100%}
        .rate-input-market{border:1px solid #e2e8f0;background:white;border-radius:8px;padding:6px 8px;text-align:center;font-weight:600;transition:all 0.2s}
        .rate-input-market:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.1);outline:none}
        .rate-input-market.valid{border-color:#10b981;background:#ecfdf5;color:#065f46}
        .rate-input-market.invalid{border-color:#ef4444;background:#fef2f2;color:#991b1b}
        /* perf scroll - fix freezing */
        @keyframes lock-pulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.45)}50%{box-shadow:0 0 0 8px rgba(249,115,22,0)}}50%{box-shadow:0 0 0 8px rgba(249,115,22,0)}}
                .scroll-perf{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
        .no-drag-table{overflow:hidden;contain:layout paint}
        .no-drag-table table{width:100%;table-layout:fixed}
        @media (min-width:1280px){.modal-responsive{max-width:1250px}} @media (min-width:1536px){.modal-responsive{max-width:1350px}} @media (min-width:1920px){.modal-responsive{max-width:1480px}} @media (min-width:2560px){.modal-responsive{max-width:1650px}} .modal-responsive{height:88vh; max-height:88vh} .no-drag-table{max-height:100%}
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
                  <div className="flex justify-between"><span className="text-slate-500">{t("ops.rate.modal.total_weight")}</span><span className="font-bold text-slate-800">{totals.totalWeight.toFixed(2)} {t("common.kg")}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-slate-500">{t("ops.rate.modal.grand_amount")}</span><span className="font-bold text-emerald-700">₹ {formatInr(totals.totalAmount)}</span></div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cancel-anim"><span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={14} /></span>{t("common.cancel")}</button>
              <button onClick={() => confirmSave("lock")} disabled={saving} className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-50 border border-orange-300 text-orange-800 text-sm font-bold shadow-sm hover:bg-orange-100 hover:shadow-md lock-anim"><span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white border border-orange-200 text-orange-600 shadow-sm lock-icon-wrap"><Lock size={16} /></span>{t("ops.rate.modal.lock_submit")}</button>
            </div>
          </div>
        </div>, document.body
      )}

      <AppShellModal open={open} onClose={onClose} panelClassName="bg-white modal-responsive mx-auto">
        <div className="bg-white w-full h-full flex flex-col relative overflow-hidden rounded-2xl max-h-full mx-auto">
          {/* Header - logo with hen dance + search beside title + local Telugu toggle */}
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 rounded-t-2xl gap-3">
            <div className="flex items-center gap-3 group flex-1 min-w-0">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm group-hover:animate-[var(--animate-brand-dance)] motion-safe:group-hover:animate-[var(--animate-brand-dance)] shrink-0"><Store size={17} className="group-hover:animate-[var(--animate-action-search)]" /></span>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900 shrink-0">{rateLocked ? t("ops.rate.modal.title_readonly") : t("ops.rate.modal.title_enter")}</h2>
              <div className="relative flex-1 max-w-[320px] ml-2 group/search">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover/search:animate-[var(--animate-action-search)] motion-safe:group-hover/search:animate-[var(--animate-action-search)]"><Store size={14} /></span>
                <input
                  type="search"
                  value={shopSearch}
                  onChange={(e) => { setShopSearch(e.target.value); setShopPage(1); }}
                  placeholder={localLanguage === "te" ? "షాప్ వెతకండి..." : "Search shops..."}
                  className="w-full h-9 pl-9 pr-9 rounded-xl border border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm hover:border-slate-300 hover:bg-white"
                />
                {shopSearch ? (
                  <button
                    type="button"
                    onClick={() => { setShopSearch(""); setShopPage(1); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all x-anim"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ViewLanguageToggle
                language={localLanguage}
                onToggle={() => setLocalLanguage((prev) => (prev === "te" ? "en" : "te"))}
                tone="emerald"
                labelMode="target"
                ariaLabel={t("ops.rate.modal.popup_language_toggle")}
                tooltip={<ActionTooltip label={t("ops.rate.modal.popup_language_tooltip")} side="bottom" />}
              />
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
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-emerald-700/70 font-semibold">{t("ops.rate.modal.trip_number")}</p><p className="text-[13px] font-bold text-emerald-900 truncate">{displayRateEntryName(trip.tripNo, language)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm btn-anim">
              <div className="h-9 w-9 rounded-lg bg-white border border-sky-200 flex items-center justify-center text-sky-700 shadow-sm"><Truck size={16} /></div>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-sky-700/70 font-semibold">{t("ops.rate.modal.vehicle_no")}</p><p className="text-[13px] font-bold text-sky-900 truncate">{displayRateEntryName(formatVehicleNumber(trip.vehicleNo), language)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm btn-anim">
              <div className="h-9 w-9 rounded-lg bg-white border border-violet-200 flex items-center justify-center text-violet-700 shadow-sm"><CalendarDays size={16} /></div>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-violet-700/70 font-semibold">Day</p><p className="text-[13px] font-bold text-violet-900 truncate">{formatRateEntryTripDate(trip.tripDate)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm btn-anim">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-amber-200 text-amber-700 shadow-sm"><Calculator size={16} /></span>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-amber-700/70 font-semibold">{t("common.total")}</p><p className="text-[12px] font-bold text-amber-900 tabular-nums leading-tight">{totals.totalBirds.toLocaleString()} {t("common.birds")} • {totals.totalWeight.toFixed(1)} {t("common.kg")}</p>{loadTotals.length > 1 && loadTotals.map(([load, value]) => <p key={load} className="text-[10px] font-semibold text-amber-700">Load {load}: {value.birds.toLocaleString()} • {value.weight.toFixed(2)} kg</p>)}</div>
            </div>
          </div>

          {marketThreeDays.length > 0 && (
            <div className="flex items-center justify-end border-b border-slate-100 bg-white px-5 py-1.5">
              <button type="button" onClick={() => setShowMarketReference((visible) => !visible)} className="btn-anim inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100" aria-expanded={showMarketReference}>
                {showMarketReference ? "Hide market reference" : "Show market reference"}
              </button>
            </div>
          )}

          {/* Kept out of the initial render so rate inputs stay responsive. */}
          {showMarketReference && marketThreeDays.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0 max-h-[18vh] overflow-auto scroll-perf">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                {/* Company & Association Rates - Telugu supported via language */}
                <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/80 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-emerald-200 text-emerald-700 shadow-sm">📊</span>
                      <p className="text-[12px] font-bold text-emerald-900">{marketLabels.companyTitle}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700/70">{marketLabels.threeDaysToday}</span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                          <th className="px-2 py-2 text-left font-semibold">{marketLabels.date}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.snehaFarmer}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.venVij}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.venGun}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.assVij}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketThreeDays.map(({ date, comp, isToday }) => (
                          <tr key={date} className={`border-t ${isToday ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white"}`}>
                            <td className="px-2 py-2 font-medium text-slate-700">{formatDdMmYy(date)}</td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-emerald-50 border-emerald-200 font-bold text-emerald-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.sneha != null ? Number(comp.sneha).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-emerald-50 border-emerald-200 font-bold text-emerald-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.vencobVii != null ? Number(comp.vencobVii).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-emerald-50 border-emerald-200 font-bold text-emerald-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.vencobGun != null ? Number(comp.vencobGun).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-emerald-50 border-emerald-200 font-bold text-emerald-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>{comp?.associationVii != null ? Number(comp.associationVii).toFixed(0) : "—"}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional Metrics Entry - Telugu supported */}
                <div className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-sky-50/80 border-b border-sky-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-sky-200 text-sky-700 shadow-sm">Σ</span>
                      <p className="text-[12px] font-bold text-sky-900">{marketLabels.additionalTitle}</p>
                    </div>
                    <span className="text-[10px] font-bold text-sky-700/70">{marketLabels.threeDays}</span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                          <th className="px-2 py-2 text-left font-semibold">{marketLabels.date}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.vij}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.gun}</th>
                          <th className="px-2 py-2 text-center font-semibold">{marketLabels.rp}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketThreeDays.map(({ date, add, isToday }) => (
                          <tr key={date} className={`border-t ${isToday ? "border-sky-200 bg-sky-50/40" : "border-slate-100 bg-white"}`}>
                            <td className="px-2 py-2 font-medium text-slate-700">{formatDdMmYy(date)}</td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-sky-50 border-sky-200 font-bold text-sky-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>{add?.vij != null ? Number(add.vij).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-sky-50 border-sky-200 font-bold text-sky-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>{add?.gun != null ? Number(add.gun).toFixed(0) : "—"}</div></td>
                            <td className="px-2 py-2"><div className={`rounded-lg border px-2 py-1 text-center tabular-nums font-bold ${isToday ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm" : "bg-white border-slate-200 text-emerald-600"}`}>{add?.rp != null ? Number(add.rp).toFixed(0) : "—"}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Shop Rates Less Breakdown - Telugu supported */}
                <div className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-violet-50/80 border-b border-violet-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-violet-200 text-violet-700 shadow-sm">◈</span>
                      <p className="text-[12px] font-bold text-violet-900">{marketLabels.shopBreakdownTitle}</p>
                    </div>
                    <span className="text-[10px] font-bold text-violet-700/70">{marketLabels.threeDays}</span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                          <th className="px-2 py-2 text-left font-semibold">{marketLabels.date}</th>
                          {sizeKeys.map((k) => (
                            <th key={k} className="px-2 py-2 text-center font-semibold">{k.replace(/^c/i, "")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {marketThreeDays.map(({ date, size, isToday }) => (
                          <tr key={date} className={`border-t ${isToday ? "border-violet-200 bg-violet-50/40" : "border-slate-100 bg-white"}`}>
                            <td className="px-2 py-2 font-medium text-slate-700">{formatDdMmYy(date)}</td>
                            {sizeKeys.map((k) => (
                              <td key={k} className="px-2 py-2">
                                <div className={`rounded-lg border px-2 py-1 text-center tabular-nums ${isToday ? "bg-violet-50 border-violet-200 font-bold text-violet-900 shadow-sm" : "bg-white border-slate-200 text-slate-600"}`}>
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

          {/* Shop count minimal - info bar removed as per request, only pagination below */}
          {shopSearch && (
            <div className="px-5 py-2 flex items-center gap-2 shrink-0 bg-white border-b border-slate-100">
              <span className="text-[11px] font-medium text-violet-600">Filtered: "{shopSearch}" • {filteredSortedDeliveries.length} shops</span>
              <button type="button" onClick={() => { setShopSearch(""); setShopPage(1); }} className="ml-2 group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 reset-anim">
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><X size={12} /></span> {t("ops.rate.modal.clear")}
              </button>
            </div>
          )}

          {/* Shop table - increased size by way, bigger table, perfect middle with gaps */}
          <div className="px-5 py-3 flex-[1.6] min-h-[380px] flex flex-col overflow-hidden bg-white">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm no-drag-table flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto scroll-perf">
                <table className="w-full table-fixed text-[13.5px]">
                  <thead className="bg-slate-50 sticky top-0 z-[1]">
                    <tr className="border-b border-slate-200">
                      <th className="w-[7%] px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-slate-600">{t("ops.rate.modal.s_no")}</th>
                      <th className="w-[22%] px-2 py-3 text-left">
                        <button type="button" onClick={() => toggleShopSort("shopName")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "shopName" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          {t("ops.rate.modal.shop_name")} {shopSortKey === "shopName" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[13%] px-2 py-3 text-left text-[12px] font-bold uppercase tracking-wider text-slate-600">{t("ops.rate.modal.association")}</th>
                      <th className="w-[10%] px-2 py-3 text-center">
                        <button type="button" onClick={() => toggleShopSort("paperRate")} className={`w-full flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] font-bold uppercase tracking-wider ${shopSortKey === "paperRate" ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200" : "text-slate-600 hover:text-slate-700 hover:bg-slate-100"}`}>
                          {t("ops.rate.modal.paper_rate")} {shopSortKey === "paperRate" && <span>{shopSortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th className="w-[8%] px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-slate-600">{t("common.birds")}</th>
                      <th className="w-[10%] px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-slate-600">{t("common.weight")}</th>
                      <th className="w-[15%] px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-slate-600">{t("ops.rate.modal.rate")}</th>
                      <th className="w-[15%] px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-slate-600">{t("ops.rate.modal.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDeliveries.map(({ row: delivery, originalIndex }, idx) => {
                      const serialNo = (shopPage - 1) * SHOPS_PAGE_SIZE + idx + 1;
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
                      const load = Math.max(1, Number(delivery.legIndex || 1));
                      const previousLoad = idx > 0 ? Math.max(1, Number(pagedDeliveries[idx - 1]?.row.legIndex || 1)) : load;
                      const startsLoad = idx === 0 || load !== previousLoad;

                      return (
                        <tr key={delivery.id} className={`${startsLoad && load > 1 ? "border-t-4 border-t-indigo-300" : ""} border-b border-slate-100 ${missingForLock ? "bg-red-50" : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-50"}`}>
                          <td className="px-2 py-3.5 text-center text-[13px] font-bold text-slate-700 tabular-nums bg-slate-50/50 border-r border-slate-100">{serialNo}</td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1.5"><span className="min-w-0 text-[14px] font-bold text-slate-800 leading-tight truncate">{displayRateEntryShopName(delivery.shopName, localLanguage)}</span>{delivery.deliveryMode === "weight" ? (<span title={t("ops.trip.weight_mode")} aria-label={t("ops.trip.weight_mode")} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600"><Scale size={15} /></span>) : (<span title={t("ops.trip.box_mode")} aria-label={t("ops.trip.box_mode")} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Package size={15} /></span>)}</div>
                            {masterShop?.city?.trim() ? <div className="text-[11px] font-normal text-slate-500 truncate">{displayRateEntryName(masterShop.city, language)}</div> : null}
                            {delivery.subShopName?.trim() ? <div className="text-[11px] font-semibold text-indigo-600 truncate">{delivery.subShopName.trim()}</div> : null}
                            {delivery.remarks?.trim() ? <div className="mt-0.5 text-[10px] font-medium italic text-slate-500 line-clamp-2" title={delivery.remarks.trim()}>{delivery.remarks.trim()}</div> : null}
                          </td>
                          <td className="px-2 py-3.5"><span className="inline-flex items-center justify-center rounded-lg border bg-violet-50 border-violet-200 text-violet-800 px-2.5 py-1 text-[12px] font-medium truncate max-w-full">{association ? displayRateEntryName(association, localLanguage) : "—"}</span></td>
                          <td className="px-2 py-3.5 text-center"><span className="inline-flex items-center justify-center rounded-lg border bg-sky-50 border-sky-200 text-sky-800 px-2.5 py-1 text-[12px] font-semibold tabular-nums">{hasPaperRate ? paperRate : "—"}</span></td>
                          <td className="px-2 py-3.5 text-center text-[13px] font-normal text-slate-700 tabular-nums">{delivery.birds.toLocaleString()}</td>
                          <td className="px-2 py-3.5 text-center text-[13px] font-normal text-slate-700 tabular-nums">{delivery.weight.toFixed(2)}</td>
                          <td className="px-2 py-3.5">
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
                                {belowMin && <p className="mt-0.5 text-[9px] text-red-500">{t("ops.rate.modal.min_rate")}</p>}
                                {aboveMax && <p className="mt-0.5 text-[9px] text-red-500">{t("ops.rate.modal.max_rate")}</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 text-[12px] font-semibold tabular-nums">
                              ₹ {formatInr(amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedDeliveries.length === 0 && (
                      <tr><td colSpan={8} className="py-10 text-center text-slate-400 text-[12px]">{t("empty.no_shops")}</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/60 border-t-2 border-emerald-200">
                      <td className="px-2 py-3 text-center text-[11px] font-bold text-slate-400">—</td>
                      <td className="px-3 py-3"><div className="flex flex-col"><span className="text-[13px] font-bold text-slate-800">{t("common.total")}: {deliveries.length} {t("ops.trip.shops")} • {displayRateEntryName(trip.tripNo, language)}</span><span className="text-[11px] font-medium text-slate-500">{totals.totalBirds.toLocaleString()} {t("common.birds")} • {totals.totalWeight.toFixed(2)} {t("common.kg")}</span></div></td>
                      <td className="px-2 py-3"><span className="inline-flex items-center justify-center rounded-lg border bg-violet-50 border-violet-200 text-violet-800 px-2.5 py-1 text-[11px] font-bold">{t("ops.rate.modal.association_short")} • {totals.totalBirds.toLocaleString()}</span></td>
                      <td className="px-2 py-3 text-center"><span className="inline-flex items-center justify-center rounded-lg border bg-sky-50 border-sky-200 text-sky-800 px-2.5 py-1 text-[11px] font-bold tabular-nums">{totals.totalBirds > 0 ? (totals.totalWeight / totals.totalBirds * 1).toFixed(2) : "—"}</span></td>
                      <td className="px-2 py-3 text-center"><span className="inline-flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 text-[12px] font-bold tabular-nums">{totals.totalBirds.toLocaleString()}</span></td>
                      <td className="px-2 py-3 text-center"><span className="inline-flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 text-[12px] font-bold tabular-nums">{totals.totalWeight.toFixed(2)}</span></td>
                      <td className="px-2 py-3"></td>
                      <td className="px-2 py-3 text-center"><span className="inline-flex items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 text-[13px] font-bold tabular-nums shadow-sm">₹ {formatInr(totals.totalAmount)}</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {filteredSortedDeliveries.length > 0 && (
              <div className="mt-3 flex items-center justify-end">
                <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-1.5 py-1 shadow-sm">
                  <button type="button" onClick={() => setShopPage((p) => Math.max(1, p - 1))} disabled={shopPage <= 1 || saving} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-40 btn-anim">
                    <ChevronLeft size={12} /> {t("common.previous")}
                  </button>
                  {pageNumbers.map((num) => (
                    <button key={num} type="button" onClick={() => setShopPage(num)} disabled={saving} className={`h-7 w-7 rounded-md text-[11px] font-bold tabular-nums btn-anim ${num === shopPage ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{num}</button>
                  ))}
                  <button type="button" onClick={() => setShopPage((p) => Math.min(shopPageCount, p + 1))} disabled={shopPage >= shopPageCount || saving} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-40 btn-anim">
                    {t("common.next")} <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border-t border-slate-200 px-5 py-3 shrink-0 rounded-b-2xl">
            {rateLocked ? (
              <div className="flex justify-end"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 btn-anim">{t("common.close")}</button></div>
            ) : (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={resetRates} disabled={saving} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 reset-anim min-w-[100px]">
                    <RotateCcw size={16} /> {t("ops.rate.modal.reset_rates")}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={onClose} className="group relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white text-[14px] font-semibold text-slate-600 hover:bg-slate-50 cancel-anim min-w-[110px]"><span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={14} /></span>{t("common.cancel")}</button>
                  <button type="button" onClick={() => confirmSave("save")} disabled={saving || !isDirty || hasInvalidEnteredRate} className={`group relative inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border text-[14px] font-bold disabled:opacity-50 save-anim min-w-[130px] ${isDirty ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-edit)]"><Save size={16} /></span>{t("ops.rate.modal.save_progress")}
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
                    className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-orange-50 border border-orange-300 text-orange-800 text-[15px] font-extrabold shadow-lg hover:bg-orange-100 hover:shadow-xl hover:border-orange-400 disabled:opacity-50 lock-anim min-w-[190px]"
                  >
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white border border-orange-200 text-orange-600 shadow-sm lock-icon-wrap"><Lock size={20} /></span>{t("ops.rate.modal.lock_submit")}
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
