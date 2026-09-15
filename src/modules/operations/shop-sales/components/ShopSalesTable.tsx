// Shop Sales table. Rows are backend-authoritative: the edit/lock state comes
// exclusively from the API response, and the table only presents that state.

import React, { useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Bird,
  Calendar,
  Check,
  Pencil,
  FileText,
  Hash,
  IndianRupee,
  Lock,
  Scale,
  Store,
  X,
} from "lucide-react";
import type { ShopSale } from "../types/shopSale";
import { notify as globalNotify } from "../../../../ui/notifications/notificationStore";
import {
  formatSaleAmount,
  formatSaleRate,
  formatSaleRemark,
  formatSaleWeight,
  shopSaleLockState,
} from "../utils/shopSaleFormat";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { cleanDeliveryShopName } from "../../vehicle-trips/utils/shopDisplayName";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { useI18n } from "../../../../i18n";

interface Props {
  sales: ShopSale[];
  isLoading?: boolean;
  /** Number of rows before this page, so serial numbers do not restart at 1. */
  startIndex?: number;
  sortBy?: string;
  onSortChange?: (sortBy: string) => void;
  onUpdateSale?: (updatedSale: ShopSale) => void | Promise<void>;
}

type SortColumn = "saleNo" | "tripDate" | "shopName" | "birds" | "weight" | "rate" | "amount" | "remark";

const SORT_VALUES: Record<SortColumn, { asc: string; desc: string }> = {
  saleNo: { asc: "sale_asc", desc: "sale_desc" },
  tripDate: { asc: "oldest", desc: "latest" },
  shopName: { asc: "shop_asc", desc: "shop_desc" },
  birds: { asc: "birds_asc", desc: "birds_desc" },
  weight: { asc: "weight_asc", desc: "weight_desc" },
  rate: { asc: "rate_asc", desc: "rate_desc" },
  amount: { asc: "amount_asc", desc: "amount_desc" },
  remark: { asc: "remark_asc", desc: "remark_desc" },
};

function SortArrows({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && direction === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && direction === "desc" ? on : off}`} />
    </span>
  );
}

function ShopSalesTable({
  sales,
  isLoading = false,
  startIndex = 0,
  sortBy = "latest",
  onSortChange,
  onUpdateSale,
}: Props) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ShopSale>>({});
  const [saving, setSaving] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const selectedSale = sales.find((sale) => sale.id === selectedId) ?? null;
  const selectedLock = selectedSale ? shopSaleLockState(selectedSale) : null;
  const selectedBirdLimit = Number(selectedSale?.maxEditableBirds);
  const hasSelectedBirdLimit = Number.isSafeInteger(selectedBirdLimit) && selectedBirdLimit >= 0;

  const currentSort = (column: SortColumn): "asc" | "desc" | undefined => {
    const values = SORT_VALUES[column];
    if (sortBy === values.asc) return "asc";
    if (sortBy === values.desc) return "desc";
    return undefined;
  };

  const sortable = (column: SortColumn, content: React.ReactNode, center = false) => {
    const direction = currentSort(column);
    if (!onSortChange) return content;
    return (
      <button
        type="button"
        onClick={() => onSortChange(direction === "asc" ? SORT_VALUES[column].desc : SORT_VALUES[column].asc)}
        aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
        className={`group/sort flex w-full items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${direction ? "text-emerald-700" : "text-slate-700"}`}
      >
        {content}
        <SortArrows active={Boolean(direction)} direction={direction} />
      </button>
    );
  };

  const startEditing = useCallback(() => {
    if (!selectedSale || !selectedSale.editable || saving) return;
    setEditingId(selectedSale.id);
    setEditData({
      totalBirds: selectedSale.totalBirds,
      totalWeight: selectedSale.totalWeight,
    });
  }, [selectedSale, saving]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditData({});
  }, []);

  const handleInputChange = useCallback((field: keyof ShopSale, value: number) => {
    setEditData((previous) => ({ ...previous, [field]: value }));
  }, []);

  const saveEditing = useCallback(async () => {
    if (!onUpdateSale || !editingId || saving) return;
    const originalSale = sales.find((sale) => sale.id === editingId);
    if (!originalSale) return;

    const newBirds = editData.totalBirds ?? originalSale.totalBirds ?? 0;
    const newWeight = editData.totalWeight ?? originalSale.totalWeight ?? 0;
    if (!Number.isInteger(newBirds) || newBirds < 0) {
      globalNotify.error(t("ops.shop_sales.birds_integer"));
      return;
    }
    if (newWeight < 0) {
      globalNotify.error(t("ops.shop_sales.invalid_weight"));
      return;
    }
    const maximumBirds = Number(originalSale.maxEditableBirds);
    if (Number.isSafeInteger(maximumBirds) && maximumBirds >= 0 && newBirds > maximumBirds) {
      globalNotify.error(t("ops.shop_sales.max_birds_error", { maximum: maximumBirds }));
      return;
    }

    setSaving(true);
    try {
      await onUpdateSale({
        ...originalSale,
        totalBirds: newBirds,
        totalWeight: newWeight,
      });
      setEditingId(null);
      setEditData({});
    } catch {
      // The parent reloads the backend-authoritative data after a failed edit.
      setEditingId(null);
      setEditData({});
    } finally {
      setSaving(false);
    }
  }, [editData, editingId, onUpdateSale, sales, saving, t]);

  const handleRowSelect = useCallback((sale: ShopSale) => {
    if (saving) return;
    setSelectedId(sale.id);
    if (editingId && editingId !== sale.id) {
      setEditingId(null);
      setEditData({});
    }
  }, [editingId, saving]);

  const handleRowKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const sale = sales[rowIndex];
      if (sale) handleRowSelect(sale);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    const nextIndex = event.key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;
    const nextSale = sales[nextIndex];
    if (!nextSale) return;
    handleRowSelect(nextSale);
    // Keep keyboard navigation visual and predictable even after React applies
    // the new selected-row state.
    requestAnimationFrame(() => rowRefs.current.get(nextSale.id)?.focus());
  }, [handleRowSelect, sales]);

  const canEditSelectedSale = Boolean(selectedSale && selectedLock?.editable && !saving);
  const selectedUnassignedBirds = Number(selectedSale?.unassignedBirds);
  const hasSelectedUnassignedBirds = Number.isSafeInteger(selectedUnassignedBirds) && selectedUnassignedBirds > 0;
  const selectedBlockedByAssignment = Boolean(
    selectedSale &&
      selectedSale.assignmentLockTripId != null &&
      selectedSale.numericTripId !== selectedSale.assignmentLockTripId,
  );

  return (
    <>
      {/* Same static title treatment as the Trip List table. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-5 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner">
            <Store className="h-5 w-5" />
          </div>
          <h3 className="truncate text-base font-bold tracking-tight text-slate-800">Shop Sales</h3>
          {selectedSale && (
            <span className="hidden truncate rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline">
              {selectedSale.tripNo}
            </span>
          )}
          {hasSelectedUnassignedBirds && selectedSale && (
            <span className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 lg:inline-flex">
              <AlertTriangle size={12} aria-hidden="true" />
              {t("ops.shop_sales.unassigned_birds", { count: selectedUnassignedBirds })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editingId ? (
            <>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Bird size={13} className="text-cyan-600" />
                <input
                  type="number"
                  aria-label={t("ops.shop_sales.birds")}
                  value={editData.totalBirds ?? 0}
                  onChange={(event) => handleInputChange("totalBirds", parseFloat(event.target.value) || 0)}
                  className="h-9 w-20 rounded-lg border border-blue-300 bg-white px-2 text-center text-xs font-bold text-blue-700 shadow-2xs outline-none transition-all [appearance:textfield] focus:border-blue-500 focus:ring-2 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  min={0}
                  max={hasSelectedBirdLimit ? selectedBirdLimit : undefined}
                  step={1}
                />
                {hasSelectedBirdLimit ? (
                  <span className="hidden whitespace-nowrap text-[10px] font-medium text-slate-500 lg:inline">{t("ops.shop_sales.max_birds", { maximum: selectedBirdLimit })}</span>
                ) : null}
                <Scale size={13} className="text-orange-600" />
                <input
                  type="number"
                  aria-label={t("ops.shop_sales.weight")}
                  value={editData.totalWeight ?? 0}
                  onChange={(event) => handleInputChange("totalWeight", parseFloat(event.target.value) || 0)}
                  className="h-9 w-20 rounded-lg border border-blue-300 bg-white px-2 text-center text-xs font-bold text-orange-600 shadow-2xs outline-none transition-all [appearance:textfield] focus:border-blue-500 focus:ring-2 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  min={0}
                  step={0.01}
                />
              </div>
              <button type="button" onClick={saveEditing} disabled={saving} aria-label={t("ops.shop_sales.save_sale")} className="group inline-flex items-center justify-center rounded-lg bg-emerald-600 p-2 text-white shadow-xs transition-all hover:bg-emerald-700 disabled:opacity-50">
                <span className={`inline-flex ${uiActionIconMotionClass.approve}`}><Check size={14} /></span>
              </button>
              <button type="button" onClick={cancelEditing} disabled={saving} aria-label={t("ops.shop_sales.cancel_editing")} className="group inline-flex items-center justify-center rounded-lg bg-rose-100 p-2 text-rose-700 transition-all hover:bg-rose-200 disabled:opacity-50">
                <span className={`inline-flex ${uiActionIconMotionClass.reject}`}><X size={14} /></span>
              </button>
            </>
          ) : (
            <>
              {/* Always present, exactly like Recent Trip Activity. It becomes
                  active only after an editable row is selected. */}
              <button
                type="button"
                onClick={startEditing}
                disabled={!canEditSelectedSale}
                aria-label={t("ops.shop_sales.edit_selected")}
                className={`group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${
                  canEditSelectedSale
                    ? "bg-emerald-50/70 hover:bg-emerald-50/80 text-emerald-500 border border-emerald-200/60 active:scale-95"
                    : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                }`}
              >
                <span className={`inline-flex ${canEditSelectedSale ? uiActionIconMotionClass.edit : ""}`}><Pencil size={13} /></span>
                <span className="hidden md:inline">{t("common.edit")}</span>
              </button>
              {selectedSale && selectedLock && !selectedLock.editable ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                    <Lock size={14} /> {selectedBlockedByAssignment ? t("ops.shop_sales.assignment_locked") : selectedLock.label}
                  </span>
                  <span className="hidden max-w-xs text-xs font-medium text-slate-500 md:inline">
                    {selectedBlockedByAssignment
                      ? t("ops.shop_sales.other_trips_locked", {
                          trip: selectedSale.assignmentLockTripNo ?? "",
                          count: selectedSale.assignmentLockUnassignedBirds ?? 0,
                        })
                      : selectedLock.message}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr className="whitespace-nowrap text-slate-700">
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center justify-center gap-1.5"><Hash size={14} className="text-slate-400" /> S.No</div>
              </th>
              <th className="px-3.5 py-3 text-left">{sortable("saleNo", <div className="flex items-center gap-1.5"><FileText size={14} className="shrink-0 text-emerald-500" /><span>Shop Sale No.</span></div>)}</th>
              <th className="px-3.5 py-3 text-left">{sortable("tripDate", <div className="flex items-center gap-1.5"><Calendar size={14} className="shrink-0 text-blue-500" /><span>Day</span></div>)}</th>
              <th className="px-3.5 py-3 text-left">{sortable("shopName", <div className="flex items-center gap-1.5"><Store size={14} className="shrink-0 text-amber-500" /><span>Shop Name</span></div>)}</th>
              <th className="px-3.5 py-3 text-center">{sortable("birds", <div className="flex items-center justify-center gap-1.5"><Bird size={14} className="shrink-0 text-cyan-600" /><span>Birds</span></div>, true)}</th>
              <th className="px-3.5 py-3 text-center">{sortable("weight", <div className="flex items-center justify-center gap-1.5"><Scale size={14} className="shrink-0 text-orange-600" /><span>Weight</span></div>, true)}</th>
              <th className="px-3.5 py-3 text-center">{sortable("rate", <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="shrink-0 text-violet-600" /><span>Rate</span></div>, true)}</th>
              <th className="px-3.5 py-3 text-center">{sortable("amount", <span>Amount</span>, true)}</th>
              <th className="px-3.5 py-3 text-left">{sortable("remark", <div className="flex items-center gap-1.5"><FileText size={14} className="shrink-0 text-slate-400" /><span>Remark</span></div>)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm font-medium text-slate-400"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />{t("ops.shop_sales.loading")}</span></td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm font-medium text-slate-400">{t("ops.shop_sales.no_sales")}</td></tr>
            ) : sales.map((sale, index) => {
              const isSelected = selectedId === sale.id;
              const isEditing = editingId === sale.id;
              const lock = shopSaleLockState(sale);
              const unassignedBirds = Number(sale.unassignedBirds);
              const hasUnassignedBirds = Number.isSafeInteger(unassignedBirds) && unassignedBirds > 0;
              const blockedByAssignment = Boolean(
                sale.assignmentLockTripId != null && sale.numericTripId !== sale.assignmentLockTripId,
              );
              return (
                <tr
                  key={sale.id}
                  ref={(element) => {
                    if (element) rowRefs.current.set(sale.id, element);
                    else rowRefs.current.delete(sale.id);
                  }}
                  tabIndex={0}
                  onFocus={() => handleRowSelect(sale)}
                  onClick={() => handleRowSelect(sale)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  aria-selected={isSelected}
                  className={`cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                    isEditing ? "bg-emerald-50/50 shadow-[inset_3px_0_0_0_#10b981]" : isSelected ? "bg-emerald-50/70 shadow-[inset_3px_0_0_0_#10b981] hover:bg-emerald-50" : "hover:bg-slate-50/80"
                  } ${!lock.editable && !isSelected ? "opacity-80" : ""}`}
                >
                  <td className="px-3.5 py-3 text-center text-xs font-semibold text-slate-500">{startIndex + index + 1}</td>
                  <td className="px-3.5 py-3 text-xs font-semibold text-emerald-600 whitespace-nowrap">
                    <div>{sale.saleNo || sale.tripNo || "—"}</div>
                    {blockedByAssignment && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Lock size={10} aria-hidden="true" />
                        {t("ops.shop_sales.assignment_locked")}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(sale.tripDate)}</td>
                  <td className="px-3.5 py-3 text-xs font-semibold text-slate-700">
                    <div>{cleanDeliveryShopName(sale.shopName) || "—"}</div>
                    {hasUnassignedBirds && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 whitespace-nowrap">
                        <AlertTriangle size={10} aria-hidden="true" />
                        {t("ops.shop_sales.unassigned_for_trip", { count: unassignedBirds, trip: sale.tripNo })}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center text-xs font-bold text-cyan-700">{Number(sale.totalBirds || 0).toLocaleString()}</td>
                  <td className="px-3.5 py-3 text-center text-xs font-bold text-orange-600">{formatSaleWeight(sale.totalWeight)}</td>
                  <td className="px-3.5 py-3 text-center text-xs font-bold text-violet-600">{formatSaleRate(sale.rate)}</td>
                  <td className="px-3.5 py-3 text-center text-xs font-bold text-slate-700">{formatSaleAmount(sale.amount)}</td>
                  <td className="px-3.5 py-3 text-xs text-slate-600"><span className="font-medium text-slate-700">{formatSaleRemark(sale.remark)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default React.memo(ShopSalesTable);
