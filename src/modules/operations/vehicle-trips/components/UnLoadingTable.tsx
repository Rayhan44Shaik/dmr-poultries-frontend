import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, ShoppingCart, Layers, Hash, Scale, MessageSquare, AlertCircle } from "lucide-react";
import Select from "react-select";
import type { ShopDelivery } from "../types/trip";
import TripPagination from "./TripPagination";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  actions?: React.ReactNode;
  readOnly?: boolean;
  onSaveRow?: (row: ShopDelivery) => void; // ✅ Added this missing prop!
}

function UnLoadingTable({ rows, setRows, shops, birdTypes, actions, readOnly = false, onSaveRow }: Props) {
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

  const addRow = useCallback(() => {
    if (readOnly) return;
    const maxSerial = safeRows.reduce((max, r) => Math.max(max, r.serialNo || 0), 0);
    const nextSerial = maxSerial + 1;

    setRows((prev) => [
      {
        id: Date.now(),
        serialNo: nextSerial,
        shopId: 0,
        boxNo: 0,
        shopName: "",
        birdTypeId: 0,
        birdType: "",
        birds: 0,
        weight: 0,
        mortality: 0,
        rate: null,
        amount: 0,
        remarks: "",
      },
      ...prev,
    ]);
    setCurrentPage(1);
  }, [safeRows, setRows, readOnly]);

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
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden mt-8 transition-all duration-300">
      <style>{`
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 gap-4">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">UNLOADING</span>
        {!readOnly && (
          <button
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 transition-all active:scale-95"
          >
            <Plus size={15} />
            Add Row
          </button>
        )}
      </div>

      {/* ── Table (Responsive Horizontal Scroll) ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500">
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider w-16 whitespace-nowrap">S.No</th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider min-w-[100px] whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>No. of Boxes</span> <span className="text-rose-500">*</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold tracking-wider min-w-[200px] whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                  <span>Shop Name</span> <span className="text-rose-500">*</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold tracking-wider min-w-[150px] whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bird Type</span> <span className="text-rose-500">*</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider min-w-[80px] whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <span>Birds</span> <span className="text-rose-500">*</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider min-w-[80px] whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kg's</span> <span className="text-rose-500">*</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider min-w-[80px] whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <span>Mortality</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider min-w-[80px] whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mort. Kg's</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold tracking-wider min-w-[150px] whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Remarks</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold tracking-wider min-w-[100px] whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentRows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-slate-600">No shops added yet</p>
                    <p className="text-xs text-slate-400">Click <span className="font-semibold text-emerald-600">Add Row</span> to begin recording entries.</p>
                  </div>
                </td>
              </tr>
            )}
            {currentRows.map((row) => {
              const availableShopOptions = getAvailableShops(row.id);
              const avgPerBird = row.birds > 0 ? row.weight / row.birds : 0;
              const mortWeight = row.mortality > 0 ? row.mortality * avgPerBird : 0;

              return (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-slate-100 text-slate-600">
                      {row.serialNo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      value={row.boxNo || ""}
                      onChange={(e) => updateRow(row.id, "boxNo", Number(e.target.value))}
                      disabled={readOnly}
                      placeholder="0"
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-20 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-center text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      required
                    />
                  </td>
                  <td className="px-4 py-3 min-w-[280px]">
                    <Select
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      value={row.shopId ? { value: row.shopId, label: row.shopName } : null}
                      options={availableShopOptions}
                      placeholder="Search Shop..."
                      isSearchable
                      isDisabled={readOnly}
                      className="text-xs"
                      onChange={(selected) => handleShopChange(row.id, selected)}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 38,
                          borderRadius: 12,
                          borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
                          backgroundColor: "#f8fafc",
                          boxShadow: state.isFocused ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
                          "&:hover": { borderColor: "#cbd5e1" },
                        }),
                        option: (base, { isFocused, isSelected }) => ({
                          ...base,
                          backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f1f5f9" : "transparent",
                          color: isSelected ? "white" : "#334155",
                          fontSize: "12px",
                          cursor: "pointer",
                        }),
                        menu: (base) => ({
                          ...base,
                          zIndex: 999,
                          borderRadius: 12,
                          overflow: "hidden",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                          border: "1px solid #f1f5f9",
                        }),
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <Select
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      value={row.birdTypeId ? { value: row.birdTypeId, label: row.birdType } : null}
                      options={birdOptions}
                      placeholder="Select Bird..."
                      isSearchable
                      isDisabled={readOnly}
                      className="text-xs"
                      onChange={(selected) => handleBirdChange(row.id, selected)}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 38,
                          borderRadius: 12,
                          borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
                          backgroundColor: "#f8fafc",
                          boxShadow: state.isFocused ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
                          "&:hover": { borderColor: "#cbd5e1" },
                        }),
                        option: (base, { isFocused, isSelected }) => ({
                          ...base,
                          backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f1f5f9" : "transparent",
                          color: isSelected ? "white" : "#334155",
                          fontSize: "12px",
                          cursor: "pointer",
                        }),
                        menu: (base) => ({
                          ...base,
                          zIndex: 999,
                          borderRadius: 12,
                          overflow: "hidden",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                          border: "1px solid #f1f5f9",
                        }),
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      value={row.birds || ""}
                      placeholder="0"
                      disabled={readOnly}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-center text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      onChange={(e) => handleBirdInputChange(row.id, e.target.value)}
                      required
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={row.weight || ""}
                      placeholder="0.00"
                      disabled={readOnly}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-center text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      onChange={(e) => updateRow(row.id, "weight", Number(e.target.value))}
                      required
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="1"
                      value={row.mortality || ""}
                      placeholder="0"
                      disabled={readOnly}
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-20 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-center text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      onChange={(e) => updateRow(row.id, "mortality", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-medium text-slate-600">
                    {mortWeight > 0 ? mortWeight.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={row.remarks || ""}
                      placeholder="Optional notes..."
                      disabled={readOnly}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      onChange={(e) => updateRow(row.id, "remarks", e.target.value)}
                    />
                  </td>
                  <td className="text-center px-4 py-3 flex flex-col items-center justify-center gap-2">
                    {/* 🔹 Save Row Button */}
                    {!readOnly && onSaveRow && (
                      <button
                        onClick={() => onSaveRow(row)}
                        className="h-8 w-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center mx-auto transition-colors group-hover:scale-105 text-emerald-600"
                        title="Save this Shop"
                      >
                        <Save size={14} />
                      </button>
                    )}
                    {/* 🔹 Delete Row Button */}
                    {!readOnly && (
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center mx-auto transition-colors group-hover:scale-105"
                        title="Delete Row"
                      >
                        <Trash2 size={14} className="text-rose-600" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-medium text-slate-500">
            Page <span className="font-bold text-slate-700">{currentPage}</span> of <span className="font-bold text-slate-700">{Math.max(totalPages, 1)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">{actions}</div>
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