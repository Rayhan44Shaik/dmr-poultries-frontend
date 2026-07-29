import React from "react";
import Select from "react-select";
import { X, ShoppingCart, Layers, Box, Scale, MessageSquare, AlertCircle, Clock } from "lucide-react";
import BoxSelector from "./BoxSelector";
import type { ShopDelivery } from "../../types/trip";

interface Props {
  mode: "box" | "weight";
  setMode: (mode: "box" | "weight") => void;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validationErrors: any;
  farmBirds: number;
  farmWeight: number;
  boxCount: number;
  weightModeTotals: { birds: number; weight: number };
  mortKg: number;
  deliveredBirds: number;
  deliveredWeight: number;
  usedBoxIds: number[];
  safeBoxDetails: any[];
  readOnly: boolean;
  autoCaptureTime: string;
  editingId: number | null;
  onClose: () => void;
  onSubmit: () => void;
  handleShopSelect: (selected: any) => void;
  handleBirdSelect: (selected: any) => void;
  handleBoxSelection: (ids: number[]) => void;
  handleFormChange: (field: string, value: any) => void;
  handlePerBoxChange: (index: number, field: "birds" | "weight", value: number) => void;
  shopOptions: any[];
  birdOptions: any[];
  isFormValid: boolean;
}

export default function ShopDeliveryForm({
  mode,
  setMode,
  formData,
  validationErrors,
  farmBirds,
  farmWeight,
  boxCount,
  weightModeTotals,
  mortKg,
  deliveredBirds,
  deliveredWeight,
  usedBoxIds,
  safeBoxDetails,
  readOnly,
  autoCaptureTime,
  editingId,
  onClose,
  onSubmit,
  handleShopSelect,
  handleBirdSelect,
  handleBoxSelection,
  handleFormChange,
  handlePerBoxChange,
  shopOptions,
  birdOptions,
  isFormValid,
}: Props) {
  return (
    <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">
            {editingId !== null ? "Edit Shop Delivery" : "Add New Shop Delivery"}
          </h3>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Clock size={12} /> Auto-Captured: <span className="font-medium text-slate-600">{autoCaptureTime}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
        >
          <X size={20} />
        </button>
      </div>

      {/* Row 1: Delivery Mode + Shop Name */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className="sm:w-[40%]">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Delivery Mode</label>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setMode("box")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                mode === "box"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Box Mode
            </button>
            <button
              type="button"
              onClick={() => setMode("weight")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                mode === "weight"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Weight Mode
            </button>
          </div>
        </div>

        <div className="sm:w-[60%]">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
            <ShoppingCart size={16} className="text-slate-400" /> Shop Name{" "}
            <span className="text-rose-500">*</span>
          </label>
          <Select
            key={`shop-${shopOptions.length}`}
            value={
              formData.shopId
                ? { value: formData.shopId, label: formData.shopName }
                : null
            }
            options={shopOptions}
            placeholder={shopOptions.length > 0 ? "Search Shop..." : "No shops available"}
            isSearchable
            isDisabled={shopOptions.length === 0 || shopOptions[0]?.isDisabled}
            onChange={handleShopSelect}
            maxMenuHeight={140}
            styles={{
              control: (base: any) => ({
                ...base,
                minHeight: 44,
                borderRadius: 12,
                borderColor: "#e2e8f0",
                backgroundColor: "#f8fafc",
              }),
              menu: (base: any) => ({
                ...base,
                zIndex: 9999,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
              }),
              option: (base: any, state: any) => ({
                ...base,
                backgroundColor: state.isFocused ? "#e2e8f0" : "white",
                color: "#1e293b",
                cursor: "pointer",
                padding: 8,
              }),
            }}
          />
          <div className="text-[10px] text-slate-400 mt-1">
            {shopOptions.length} shop(s) available
          </div>
        </div>
      </div>

      {/* Row 2: Bird Type + Box Selector */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className="sm:w-[40%]">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
            <Layers size={16} className="text-slate-400" /> Bird Type{" "}
            <span className="text-rose-500">*</span>
          </label>
          <Select
            key={`bird-${birdOptions.length}`}
            value={
              formData.birdTypeId
                ? { value: formData.birdTypeId, label: formData.birdType }
                : null
            }
            options={birdOptions}
            placeholder={birdOptions.length > 0 ? "Select Bird..." : "No bird types available"}
            isSearchable
            isDisabled={birdOptions.length === 0 || birdOptions[0]?.isDisabled}
            onChange={handleBirdSelect}
            maxMenuHeight={140}
            styles={{
              control: (base: any) => ({
                ...base,
                minHeight: 44,
                borderRadius: 12,
                borderColor: "#e2e8f0",
                backgroundColor: "#f8fafc",
              }),
              menu: (base: any) => ({
                ...base,
                zIndex: 9999,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
              }),
              option: (base: any, state: any) => ({
                ...base,
                backgroundColor: state.isFocused ? "#e2e8f0" : "white",
                color: "#1e293b",
                cursor: "pointer",
                padding: 8,
              }),
            }}
          />
          <div className="text-[10px] text-slate-400 mt-1">
            {birdOptions.length} bird type(s) available
          </div>
        </div>

        <div className="sm:w-[60%]">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Select Boxes</label>
          {safeBoxDetails.length > 0 ? (
            <BoxSelector
              boxes={safeBoxDetails}
              selectedIds={formData.selectedBoxIds}
              onSelectionChange={handleBoxSelection}
              disabled={readOnly}
              usedBoxIds={usedBoxIds}
            />
          ) : (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 text-center">
              <AlertCircle size={20} className="mx-auto mb-1 text-slate-300" />
              <p className="text-sm text-slate-500">No boxes available from pickup.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Conditional Grid ────────────────────────────────────── */}
      {mode === "box" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Box size={16} className="text-slate-400" /> Box No
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {boxCount}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <span>🕌</span> Temple Birds
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {farmBirds}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <span>⚰️</span> Mor (Birds)
              </label>
              <input
                type="number"
                value={formData.mortality || ""}
                onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                placeholder="0"
                min="0"
                className={`w-full rounded-xl border px-4 sm:px-5 py-2 text-sm font-medium outline-none transition-all no-spinner h-[44px] ${
                  validationErrors.birdsExceed
                    ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-200"
                    : "border-slate-200 bg-slate-50/50 text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                }`}
              />
              {validationErrors.birdsExceed && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Cannot be more than {farmBirds}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <span>🐔</span> Birds (Del.)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {deliveredBirds}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div />
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Wt (Temple)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {farmWeight.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Mor (kg)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {mortKg > 0 ? mortKg.toFixed(2) : "—"}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Wt (Del.)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {deliveredWeight > 0 ? deliveredWeight.toFixed(2) : "—"}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Box</th>
                  <th className="px-3 py-2 text-left font-semibold">Birds (Temple)</th>
                  <th className="px-3 py-2 text-left font-semibold">Birds (Del.) <span className="text-rose-500">*</span></th>
                  <th className="px-3 py-2 text-left font-semibold">Wt (Temple)</th>
                  <th className="px-3 py-2 text-left font-semibold">Wt (Del.) <span className="text-rose-500">*</span></th>
                </tr>
              </thead>
              <tbody>
                {formData.perBoxData.map((item: any, index: number) => {
                  const farmBox = safeBoxDetails.find((b) => b.boxNo === item.boxNo);
                  const birdsError = validationErrors.perBoxBirdsErrors[index] || false;
                  const weightError = validationErrors.perBoxWeightErrors[index] || false;
                  return (
                    <tr key={item.boxNo} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-medium">#{item.boxNo}</td>
                      <td className="px-3 py-2">{farmBox?.birds || 0}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.birds || ""}
                          onChange={(e) => handlePerBoxChange(index, "birds", Number(e.target.value))}
                          placeholder="0"
                          min="0"
                          className={`w-20 rounded border px-2 py-1 text-sm focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all no-spinner ${
                            birdsError ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/50"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">{farmBox?.weight.toFixed(2) || "0.00"}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.weight || ""}
                          onChange={(e) => handlePerBoxChange(index, "weight", Number(e.target.value))}
                          placeholder="0.00"
                          min="0"
                          className={`w-24 rounded border px-2 py-1 text-sm focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all no-spinner ${
                            weightError ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/50"
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <span>⚰️</span> Mor (Birds)
              </label>
              <input
                type="number"
                value={formData.mortality || ""}
                onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                placeholder="0"
                min="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner h-[44px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Mor (kg)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.mortWeight || ""}
                onChange={(e) => handleFormChange("mortWeight", Number(e.target.value))}
                placeholder="0.00"
                min="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner h-[44px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Remarks */}
      <div>
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
          <MessageSquare size={16} className="text-slate-400" /> Remarks
        </label>
        <input
          value={formData.remarks || ""}
          onChange={(e) => handleFormChange("remarks", e.target.value)}
          placeholder="Optional notes..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all h-[44px]"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!isFormValid}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors active:scale-95 touch-manipulation ${
            isFormValid
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
          }`}
        >
          {editingId !== null ? "Update" : "Save"} Delivery
        </button>
      </div>
    </div>
  );
}