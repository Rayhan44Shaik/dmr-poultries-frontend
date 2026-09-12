import { useEffect, useMemo, useState } from "react";
import {
  X,
  Truck,
  CalendarDays,
  Store,
  Package,
  Scale,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Lock,
  Save,
  RotateCcw,
  Users,
  FileText,
} from "lucide-react";
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
import RateEntryMarketMasterTables from "./RateEntryMarketMasterTables";
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

  const saving = isSaving || busy;
  const rateLocked = trip?.rateCompleted === true;

  useEffect(() => {
    if (!trip) return;
    /* eslint-disable react-hooks/set-state-in-effect -- controlled modal: sync trip prop into local state on open */
    setShowSuccessToast(false);
    setShowConfirm(false);
    setLockError(null);
    setLockAttempted(false);
    setShopPage(1);
    setDeliveries(
      trip.deliveries.map((d) => ({
        ...d,
        rate: normalizeRate(d.rate),
      }))
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [trip]);

  const totalBirds = useMemo(() => deliveries.reduce((sum, row) => sum + row.birds, 0), [deliveries]);
  const totalWeight = useMemo(() => deliveries.reduce((sum, row) => sum + row.weight, 0), [deliveries]);
  const grandAmount = useMemo(
    () =>
      deliveries.reduce((sum, row) => {
        if (isValidSellingRate(row.rate)) {
          return sum + Number((row.weight * (row.rate as number)).toFixed(2));
        }
        return sum;
      }, 0),
    [deliveries]
  );

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

  const canApplyMarketRates = useMemo(
    () =>
      deliveries.some((row) => {
        const currentRate = normalizeRate(row.rate);
        return !isValidSellingRate(currentRate) && suggestedMarketRate(row, tripDateVenRate) != null;
      }),
    [deliveries, tripDateVenRate]
  );

  const applyMarketRate = (index: number, rate: number) => {
    if (saving || rateLocked) return;
    setLockError(null);
    setDeliveries((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, rate } : row))
    );
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

  const shopPageCount = Math.max(1, Math.ceil(deliveries.length / shopPageSize));
  const pagedDeliveries = useMemo(() => {
    const start = (shopPage - 1) * shopPageSize;
    return deliveries.slice(start, start + shopPageSize).map((row, i) => ({
      row,
      index: start + i,
    }));
  }, [deliveries, shopPage, shopPageSize]);

  useEffect(() => {
    if (shopPage <= shopPageCount) return;
    const timer = window.setTimeout(() => setShopPage(shopPageCount), 0);
    return () => window.clearTimeout(timer);
  }, [shopPage, shopPageCount]);

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
          setShopPage(Math.floor(firstMissing / shopPageSize) + 1);
        }
        return;
      }
    }
    setShowConfirm(false);
    setBusy(true);
    setLockError(null);
    try {
      const ok =
        mode === "lock" ? await onSaveAndLock(deliveries) : await onSave(deliveries);
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

  if (!open || !trip) return null;

  return (
    <>
      <style>{`
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner { -moz-appearance: textfield; }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 overflow-y-auto">
        {showSuccessToast && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6 flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800">{t("ops.rate.modal.saved_title")}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("ops.rate.modal.saved_desc")}</p>
              </div>
            </div>
          </div>
        )}

        {showConfirm && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full mx-4 p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{t("ops.rate.modal.locking_title")}</h3>
                  <p className="text-sm text-slate-600 mt-1">{t("ops.rate.modal.locking_desc")}</p>
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
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-medium text-white"
                >
                  {saving ? t("ops.rate.modal.locking") : t("ops.rate.modal.lock_cannot_edit")}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col relative overflow-hidden">
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-start justify-between shrink-0">
            <h2 className="text-xl font-bold text-slate-900">
              {rateLocked ? t("ops.rate.modal.title_readonly") : t("ops.rate.modal.title_enter")}
            </h2>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
              aria-label={t("common.close")}
            >
              <X size={18} className="text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3 shrink-0">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("ops.rate.modal.trip_number")}</p>
                <p className="text-sm font-bold text-emerald-700">{trip.tripNo}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5">
              <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
                <Truck size={18} className="text-sky-700" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("ops.rate.modal.vehicle_no")}</p>
                <p className="text-sm font-bold text-slate-800">{formatVehicleNumber(trip.vehicleNo)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CalendarDays size={18} className="text-emerald-700" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("ops.rate.modal.trip_date")}</p>
                <p className="text-sm font-bold text-slate-800">{formatRateEntryTripDate(trip.tripDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("ops.rate.modal.day")}</p>
                <p className="text-sm font-bold text-slate-800">{formatRateEntryWeekday(trip.tripDate, language)}</p>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100">
            <RateEntryMarketMasterTables
              master={marketMaster}
              tripDate={trip.tripDate}
              loadError={null}
            />
          </div>

          {(loadError || lockError) && (
            <div className="px-5 py-2 border-b border-red-200 bg-red-50 flex items-center gap-2 shrink-0">
              <AlertCircle size={14} className="text-red-600" />
              <span className="text-xs font-medium text-red-700">{lockError || loadError}</span>
            </div>
          )}

          <div className="px-5 py-2 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="overflow-auto flex-1 min-h-0">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">{t("ops.rate.modal.s_no")}</th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">{t("ops.rate.modal.shop_name")}</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">{t("common.birds")}</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">{t("ops.trip.weight_kg")}</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">{t("ops.rate.modal.market_rate")}</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">{t("ops.rate.modal.rate")}</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">{t("ops.rate.modal.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDeliveries.map(({ row: delivery, index }) => {
                    const rate = normalizeRate(delivery.rate);
                    const isValid = isValidSellingRate(rate);
                    const amount = isValid ? Number((delivery.weight * (rate as number)).toFixed(2)) : 0;
                    const marketRateValue = suggestedMarketRate(delivery, tripDateVenRate);
                    const masterShop = resolveShopMaster(delivery, shopMasterLookup);
                    const association = masterShop?.associationType?.trim() ?? "";
                    const paperRate = Number(masterShop?.paperRate ?? 0);
                    const belowMin = rate != null && rate < 50;
                    const aboveMax = rate != null && rate > 300;
                    const missingForLock = lockAttempted && !isValid;

                    return (
                      <tr
                        key={delivery.id}
                        className={`border-b border-slate-100 ${missingForLock ? "bg-red-50" : ""}`}
                      >
                        <td className="px-2 py-2.5 text-center text-xs text-slate-500">{index + 1}</td>
                        <td className="px-2 py-2.5 text-xs text-slate-800 min-w-[260px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900">{displayRateEntryShopName(delivery.shopName, language)}</span>
                            {association && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                <Users size={11} />
                                {t("ops.rate.modal.association_short")}: {displayRateEntryName(association, language)}
                              </span>
                            )}
                            {Number.isFinite(paperRate) && paperRate > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                <FileText size={11} />
                                {t("ops.rate.modal.paper_short")}: {paperRate}
                              </span>
                            )}
                            {!masterShop && shopsLoading && (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                {t("ops.rate.modal.shop_master_loading")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs font-semibold text-emerald-600">
                          {delivery.birds.toLocaleString()}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs font-semibold text-orange-500">
                          {delivery.weight.toFixed(2)}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs font-semibold text-sky-600">
                          {marketRateValue != null ? (
                            <span className="inline-flex items-center overflow-hidden rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-xs">
                              <span className="px-2 py-1 tabular-nums">₹ {Number(marketRateValue).toFixed(2)}</span>
                              {!rateLocked && (
                                <button
                                  type="button"
                                  onClick={() => applyMarketRate(index, marketRateValue)}
                                  disabled={saving}
                                  className="border-l border-sky-200 bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {t("ops.rate.modal.use_market")}
                                </button>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2">
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
                                placeholder=""
                                disabled={saving}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const updated = [...deliveries];
                                  const num = value === "" ? null : Number(value);
                                  (updated[index] as Trip["deliveries"][number]).rate = num;
                                  setDeliveries(updated);
                                }}
                                className={`w-[88px] px-2 py-1 rounded-md border text-center text-sm font-semibold outline-none no-spinner ${
                                  rate == null
                                    ? "border-slate-300"
                                    : isValid
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                      : "border-red-500 bg-red-50 text-red-700"
                                }`}
                              />
                              {belowMin && <p className="text-[10px] text-red-500 mt-0.5">⚠ {t("ops.rate.modal.min_rate")}</p>}
                              {aboveMax && <p className="text-[10px] text-red-500 mt-0.5">⚠ {t("ops.rate.modal.max_rate")}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs font-semibold text-slate-700">
                          ₹ {formatInr(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {deliveries.length > 0 && (
              <Pagination
                page={shopPage}
                pageSize={shopPageSize}
                totalItems={deliveries.length}
                onPageChange={setShopPage}
                onPageSizeChange={(nextPageSize) => {
                  setShopPageSize(nextPageSize);
                  setShopPage(1);
                }}
                disabled={saving}
                ariaLabel={t("ops.rate.modal.shop_rates_pagination")}
                className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            )}
          </div>

          <div className="bg-slate-50/95 border-t border-slate-200 px-5 py-3 shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                  <Store size={16} className="text-slate-500" />
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase">{t("ops.trip.shops")}</p>
                    <p className="text-base font-bold text-slate-800">{deliveries.length}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                  <Package size={16} className="text-slate-500" />
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase">{t("common.birds")}</p>
                    <p className="text-base font-bold text-slate-800">{totalBirds.toLocaleString()}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                  <Scale size={16} className="text-orange-500" />
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase">{t("ops.rate.modal.total_weight")}</p>
                    <p className="text-base font-bold text-orange-500">{totalWeight.toFixed(2)} {t("common.kg")}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                  <IndianRupee size={16} className="text-emerald-700" />
                  <div>
                    <p className="text-[9px] text-emerald-700 uppercase">{t("ops.rate.modal.grand_amount")}</p>
                    <p className="text-base font-bold text-emerald-700">₹ {formatInr(grandAmount)}</p>
                  </div>
                </div>
              </div>

              {rateLocked ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {t("common.close")}
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                            setShopPage(Math.floor(firstMissing / shopPageSize) + 1);
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
      </div>
    </>
  );
}
