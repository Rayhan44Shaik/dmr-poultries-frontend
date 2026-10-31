// Shop Sales table. Rows are backend-authoritative: the edit/lock state comes
// exclusively from the API response, and the table only presents that state.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bird,
  Calendar,
  FileText,
  Hash,
  Lock,
  IndianRupee,
  Scale,
  Store,
} from "lucide-react";
import type { ShopSale } from "../types/shopSale";
import {
  formatSaleAmount,
  formatSaleRate,
  formatSaleRemark,
  formatSaleWeight,
  shopSaleLockState,
} from "../utils/shopSaleFormat";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatShopWithSubShop } from "../../vehicle-trips/utils/shopDisplayName";
import { useI18n } from "../../../../i18n";
import type { Shop } from "../../../masters/shops/types/shop";
import ShopSaleEditModal from "./ShopSaleEditModal";
import type { LoadSaleDraft } from "./ShopSaleEditModal";

interface Props {
  sales: ShopSale[];
  /** Full filtered backend result, independent of the currently visible page. */
  allSales?: ShopSale[];
  isLoading?: boolean;
  /** Number of rows before this page, so serial numbers do not restart at 1. */
  startIndex?: number;
  sortBy?: string;
  onSortChange?: (sortBy: string) => void;
  onSaveLoad?: (tripId: number, rows: LoadSaleDraft[]) => Promise<void>;
  shops: Shop[];
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
  allSales = sales,
  isLoading = false,
  startIndex = 0,
  sortBy = "latest",
  onSortChange,
  onSaveLoad,
  shops,
}: Props) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<ShopSale | null>(null);
  const [saving, setSaving] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const tableRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clearOutside = (event: PointerEvent) => {
      if (!tableRootRef.current?.contains(event.target as Node) && !editingSale && !saving) setSelectedId(null);
    };
    document.addEventListener("pointerdown", clearOutside);
    return () => document.removeEventListener("pointerdown", clearOutside);
  }, [editingSale, saving]);

  const selectedSale = sales.find((sale) => sale.id === selectedId) ?? null;
  const editingTripDeliveries = useMemo(() => editingSale ? allSales.filter((row) => row.numericTripId === editingSale.numericTripId) : [], [allSales, editingSale]);
  const selectedLock = selectedSale ? shopSaleLockState(selectedSale) : null;
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

  const startEditingSale = useCallback((sale: ShopSale) => {
    if (!sale.editable || saving) return;
    setSelectedId(sale.id);
    setEditingSale(sale);
  }, [saving]);

  const saveEditing = useCallback(async (tripId: number, rows: LoadSaleDraft[]) => {
    if (!onSaveLoad || saving) return;
    setSaving(true);
    try { await onSaveLoad(tripId, rows); setEditingSale(null); }
    finally { setSaving(false); }
  }, [onSaveLoad, saving]);

  const handleRowSelect = useCallback((sale: ShopSale) => {
    if (saving) return;
    // Selecting/focusing a table row must never open the Add Shop dialog.
    setSelectedId(sale.id);
    if (editingSale && editingSale.id !== sale.id) setEditingSale(null);
  }, [editingSale, saving]);

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

  const selectedBlockedByAssignment = Boolean(
    selectedSale &&
      selectedSale.assignmentLockTripId != null &&
      selectedSale.numericTripId !== selectedSale.assignmentLockTripId,
  );

  return (
    <div ref={tableRootRef}>
      {/* Same static title treatment as the Trip List table. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-5 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner">
            <Store className="h-5 w-5" />
          </div>
          <h3 className="truncate text-base font-bold tracking-tight text-slate-800">Shop Sales</h3>
          {selectedSale && (
            <span
              className="inline-flex whitespace-nowrap rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
              title={selectedSale.saleNo || ""}
            >
              {selectedSale.saleNo || "—"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px] text-left border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr className="whitespace-nowrap text-slate-700">
              <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center justify-center gap-1.5"><Hash size={14} className="text-slate-400" /> S.No</div>
              </th>
              <th className="px-4 py-4 text-left">{sortable("saleNo", <div className="flex items-center gap-1.5"><FileText size={14} className="shrink-0 text-emerald-500" /><span>Shop Sale No.</span></div>)}</th>
              <th className="px-4 py-4 text-left">{sortable("tripDate", <div className="flex items-center gap-1.5"><Calendar size={14} className="shrink-0 text-blue-500" /><span>Day</span></div>)}</th>
              <th className="px-4 py-4 text-left">{sortable("shopName", <div className="flex items-center gap-1.5"><Store size={14} className="shrink-0 text-amber-500" /><span>Shop Name</span></div>)}</th>
              <th className="px-4 py-4 text-center">{sortable("birds", <div className="flex items-center justify-center gap-1.5"><Bird size={14} className="shrink-0 text-cyan-600" /><span>Birds</span></div>, true)}</th>
              <th className="px-4 py-4 text-center">{sortable("weight", <div className="flex items-center justify-center gap-1.5"><Scale size={14} className="shrink-0 text-orange-600" /><span>Weight</span></div>, true)}</th>
              <th className="px-4 py-4 text-center">{sortable("rate", <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="shrink-0 text-violet-600" /><span>Rate</span></div>, true)}</th>
              <th className="px-4 py-4 text-center">{sortable("amount", <span>Amount</span>, true)}</th>
              <th className="px-4 py-4 text-left">{sortable("remark", <div className="flex items-center gap-1.5"><FileText size={14} className="shrink-0 text-slate-400" /><span>Remark</span></div>)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm font-medium text-slate-400"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />{t("ops.shop_sales.loading")}</span></td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-[13px] font-medium text-slate-400">{t("ops.shop_sales.no_sales")}</td></tr>
            ) : sales.map((sale, index) => {
              const isSelected = selectedId === sale.id;
              const isEditing = editingSale?.id === sale.id;
              const lock = shopSaleLockState(sale);
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
                  <td className="px-4 py-5 text-center text-[13px] font-semibold text-slate-500">{startIndex + index + 1}</td>
                  <td className="px-4 py-5 text-[13px] font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      disabled={!lock.editable || saving}
                      onClick={(event) => { event.stopPropagation(); startEditingSale(sale); }}
                      aria-label={`${t("common.edit")} ${sale.saleNo || sale.tripNo || "shop sale"}`}
                      title={lock.editable ? "Edit trip shop deliveries" : lock.message}
                      className={`rounded-md text-emerald-700 underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${lock.editable && !saving ? "cursor-pointer hover:text-emerald-900 hover:underline" : "cursor-not-allowed text-slate-400"}`}
                    >{sale.saleNo || sale.tripNo || "—"}</button>
                  </td>
                  <td className="px-4 py-5 text-[13px] font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(sale.tripDate)}</td>
                  <td className="px-4 py-5 text-[13px] font-semibold text-slate-700">
                    <div className="whitespace-nowrap" title={formatShopWithSubShop(sale.shopName, sale.subShopName) || undefined}>
                      {formatShopWithSubShop(sale.shopName, sale.subShopName) || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-5 text-center text-[13px] font-bold text-cyan-700">{Number(sale.totalBirds || 0).toLocaleString()}</td>
                  <td className="px-4 py-5 text-center text-[13px] font-bold text-orange-600">{formatSaleWeight(sale.totalWeight)}</td>
                  <td className="px-4 py-5 text-center text-[13px] font-bold text-violet-600">{formatSaleRate(sale.rate)}</td>
                  <td className="px-4 py-5 text-center text-[13px] font-bold text-slate-700">{formatSaleAmount(sale.amount)}</td>
                  <td className="max-w-[260px] px-4 py-5 text-[13px] text-slate-600"><span className="block whitespace-normal break-words font-medium leading-5 text-slate-700" title={sale.remark || undefined}>{formatSaleRemark(sale.remark)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editingSale ? <ShopSaleEditModal key={editingSale.id} sale={editingSale} shops={shops} deliveries={editingTripDeliveries} saving={saving} onClose={() => setEditingSale(null)} onSaveLoad={saveEditing} /> : null}
    </div>
  );
}

export default React.memo(ShopSalesTable);
