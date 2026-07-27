import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, ShoppingCart, Layers, Hash, Scale, MessageSquare, AlertCircle, Check } from "lucide-react";
import Select from "react-select";
import type { ShopDelivery } from "../types/trip";
import TripPagination from "./TripPagination";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  readOnly?: boolean;
  onSaveRow?: (row: ShopDelivery) => void;
}

function UnLoadingTable({ rows, setRows, shops, birdTypes, readOnly = false, onSaveRow }: Props) {
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = useMemo(
    () => Math.ceil(safeRows.length / itemsPerPage),
    [safeRows.length]
  );

  const currentRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return safeRows.slice(startIndex, startIndex + itemsPerPage);
  }, [safeRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    } else if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const updateRow = useCallback(
    (id: number, field: keyof ShopDelivery, value: any) => {
      if (readOnly) return;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    },
    [setRows, readOnly]
  );

  const deleteRow = useCallback(
    (id: number) => {
      if (readOnly) return;
      setRows((prev) => prev.filter((x) => x.id !== id));
    },
    [setRows, readOnly]
  );

  const handleShopChange = useCallback(
    (rowId: number, selected: any) => {
      if (readOnly || !selected) return;
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, shopId: selected.value, shopName: selected.label } : r))
      );
    },
    [setRows, readOnly]
  );

  const handleBirdChange = useCallback(
    (rowId: number, selected: any) => {
      if (readOnly) return;
      if (!selected) {
        setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, birdTypeId: 0, birdType: "" } : r)));
        return;
      }
      const bird = safeBirdTypes.find((b: any) => b.id === selected.value);
      if (!bird) return;
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, birdTypeId: bird.id, birdType: bird.birdType } : r))
      );
    },
    [safeBirdTypes, setRows, readOnly]
  );

  const getSelectedShopIds = (currentRowId: number) => {
    return safeRows
      .filter((r) => r.id !== currentRowId && r.shopId && r.shopId > 0)
      .map((r) => r.shopId);
  };

  const handleBirdInputChange = (rowId: number, value: string) => {
    if (readOnly) return;
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const intVal = Math.floor(num);
      updateRow(rowId, "birds", intVal);
    } else {
      updateRow(rowId, "birds", 0);
    }
  };

  const getAvailableShops = useCallback(
    (currentRowId: number) => {
      const selectedIds = getSelectedShopIds(currentRowId);
      return safeShops
        .filter((shop: any) => !selectedIds.includes(shop.id))
        .map((shop: any) => ({ value: shop.id, label: shop.shopName }));
    },
    [safeShops, getSelectedShopIds]
  );

  const birdOptions = useMemo(
    () => safeBirdTypes.map((bird: any) => ({ value: bird.id, label: bird.birdType })),
    [safeBirdTypes]
  );

  return (
    <div className="w-full">
      <style>{`
        .no-spinner::-webkit-inner-spin-button,.no-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.no-spinner{-moz-appearance:textfield}
      `}</style>

      <div className="p-6 bg-slate-50/40 space-y-4">
        {currentRows.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200 border-dashed">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="font-medium text-slate-600">No shops added yet</p>
              <p className="text-xs text-slate-400">Click <span className="font-semibold text-emerald-600">Add Row</span> to begin recording entries.</p>
            </div>
          </div>
        )}

        {currentRows.map((row) => {
          const availableShopOptions = getAvailableShops(row.id);
          const avgPerBird = row.birds > 0 ? row.weight / row.birds : 0;
          const mortWeight = row.mortality > 0 ? row.mortality * avgPerBird : 0;
          const isSaved = row.shopId > 0 && row.birds > 0 && row.weight > 0;

          // SAVED STATE: 2‑Column Grid Layout below Shop Name
          if (isSaved) {
            return (
              <div 
                key={row.id} 
                className="bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-300"
              >
                {/* Row 1: Shop Name & Checkmark */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 border-none shadow-sm flex items-center justify-center text-white shrink-0">
                    <Check size={16} />
                  </div>
                  <span className="font-bold text-slate-800 text-sm tracking-wide">{row.shopName}</span>
                </div>

                {/* Row 2: 2‑Column Stats Grid */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-white/40 rounded-xl px-3 py-2 border border-emerald-100/60 shadow-sm flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Birds</span>
                    <span className="font-bold text-slate-900 text-sm">{row.birds}</span>
                  </div>
                  <div className="bg-white/40 rounded-xl px-3 py-2 border border-emerald-100/60 shadow-sm flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Kg</span>
                    <span className="font-bold text-slate-900 text-sm">{row.weight.toFixed(2)}</span>
                  </div>
                  <div className="bg-white/40 rounded-xl px-3 py-2 border border-emerald-100/60 shadow-sm flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Mortality</span>
                    <span className="font-bold text-rose-600 text-sm">{row.mortality}</span>
                  </div>
                  <div className="bg-white/40 rounded-xl px-3 py-2 border border-emerald-100/60 shadow-sm flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Mort. Kg</span>
                    <span className="font-bold text-rose-600 text-sm">{mortWeight.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          }

          // EDIT STATE (Un‑saved Manual Form)
          return (
            <div key={row.id} className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {row.serialNo}
                  </span>
                  <span className="text-sm font-medium text-slate-500">Delivery Entry</span>
                </div>
                {!readOnly && onSaveRow && (
                  <button
                    onClick={() => onSaveRow(row)}
                    className="h-8 w-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 flex items-center justify-center transition-colors active:scale-95"
                    title="Save this Shop"
                  >
                    <Save size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <Hash size={12} className="text-slate-400" /> No. of Boxes <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={row.boxNo || ""}
                    onChange={(e) => updateRow(row.id, "boxNo", Number(e.target.value))}
                    disabled={readOnly}
                    placeholder="0"
                    min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <ShoppingCart size={12} className="text-slate-400" /> Shop Name <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    value={row.shopId ? { value: row.shopId, label: row.shopName } : null}
                    options={availableShopOptions}
                    placeholder="Search Shop..."
                    isSearchable
                    isDisabled={readOnly}
                    className="text-sm"
                    onChange={(selected) => handleShopChange(row.id, selected)}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: 40,
                        borderRadius: 12,
                        borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
                        backgroundColor: "#f8fafc",
                        boxShadow: state.isFocused ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 999,
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                      }),
                    }}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <Layers size={12} className="text-slate-400" /> Bird Type <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    value={row.birdTypeId ? { value: row.birdTypeId, label: row.birdType } : null}
                    options={birdOptions}
                    placeholder="Select Bird..."
                    isSearchable
                    isDisabled={readOnly}
                    className="text-sm"
                    onChange={(selected) => handleBirdChange(row.id, selected)}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: 40,
                        borderRadius: 12,
                        borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
                        backgroundColor: "#f8fafc",
                        boxShadow: state.isFocused ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 999,
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                      }),
                    }}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <span className="text-slate-400">🐔</span> Birds <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={row.birds || ""}
                    disabled={readOnly}
                    placeholder="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner disabled:opacity-60 disabled:cursor-not-allowed"
                    onChange={(e) => handleBirdInputChange(row.id, e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <Scale size={12} className="text-slate-400" /> Kg's <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.weight || ""}
                    disabled={readOnly}
                    placeholder="0.00"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner disabled:opacity-60 disabled:cursor-not-allowed"
                    onChange={(e) => updateRow(row.id, "weight", Number(e.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <span className="text-slate-400">⚰️</span> Mortality
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={row.mortality || ""}
                    disabled={readOnly}
                    placeholder="0"
                    min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner disabled:opacity-60 disabled:cursor-not-allowed"
                    onChange={(e) => updateRow(row.id, "mortality", Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <Scale size={12} className="text-slate-400" /> Mort. Kg's (Calc.)
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 py-2 text-sm font-medium text-slate-600 flex items-center h-[40px]">
                    {mortWeight > 0 ? mortWeight.toFixed(2) : <span className="text-slate-400">—</span>}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                    <MessageSquare size={12} className="text-slate-400" /> Remarks
                  </label>
                  <input
                    value={row.remarks || ""}
                    disabled={readOnly}
                    placeholder="Optional notes..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    onChange={(e) => updateRow(row.id, "remarks", e.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-medium text-slate-500">
            Page <span className="font-bold text-slate-700">{currentPage}</span> of <span className="font-bold text-slate-700">{Math.max(totalPages, 1)}</span>
          </div>
          <TripPagination
            key={totalPages}
            currentPage={currentPage}
            totalPages={Math.max(totalPages, 1)}
            onPageChange={setCurrentPage}
            hidePageInfo={true}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(UnLoadingTable);