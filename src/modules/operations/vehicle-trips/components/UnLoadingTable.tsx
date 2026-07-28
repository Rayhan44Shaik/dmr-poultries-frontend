import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  ShoppingCart,
  Layers,
  Hash,
  Scale,
  MessageSquare,
  AlertCircle,
  Check,
  X,
  Box,
  ChevronDown,
  Search,
} from "lucide-react";
import Select from "react-select";
import type { ShopDelivery, BoxDetail } from "../types/trip";
import TripPagination from "./TripPagination";

// ─── Custom Box Selector ──────────────────────────────────────────────
interface BoxSelectorProps {
  boxes: BoxDetail[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  disabled?: boolean;
}

function BoxSelector({ boxes, selectedIds, onSelectionChange, disabled = false }: BoxSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBoxes = useMemo(() => {
    if (!searchQuery.trim()) return boxes;
    return boxes.filter((b) => String(b.boxNo).includes(searchQuery.trim()));
  }, [boxes, searchQuery]);

  const allSelected = boxes.length > 0 && boxes.every((b) => selectedIds.includes(b.boxNo));
  const selectedCount = selectedIds.length;

  const toggleBox = (boxNo: number) => {
    const isSelected = selectedIds.includes(boxNo);
    const newSelected = isSelected
      ? selectedIds.filter((id) => id !== boxNo)
      : [...selectedIds, boxNo];
    onSelectionChange(newSelected);
  };

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(boxes.map((b) => b.boxNo));
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || boxes.length === 0}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-slate-50/50 text-sm font-medium transition-all touch-manipulation ${
          disabled || boxes.length === 0
            ? "border-slate-200 text-slate-400 cursor-not-allowed"
            : "border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-700"
        }`}
      >
        <span className="flex items-center gap-2">
          <Box size={18} className="text-slate-400" />
          {selectedCount > 0 ? (
            <span>{selectedCount} box{selectedCount > 1 ? "es" : ""} selected</span>
          ) : (
            <span className="text-slate-400">Select boxes from pickup</span>
          )}
        </span>
        <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && boxes.length > 0 && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-80 flex flex-col">
          <div className="p-2 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search box number..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder-slate-400 py-1"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white text-xs">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Select All ({boxes.length})
            </label>
            <span className="text-[10px] text-slate-400">{selectedCount} selected</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-44 p-1">
            {filteredBoxes.length === 0 ? (
              <div className="text-center py-3 text-sm text-slate-400">No boxes match.</div>
            ) : (
              filteredBoxes.map((box) => (
                <label
                  key={box.boxNo}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.includes(box.boxNo)
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(box.boxNo)}
                    onChange={() => toggleBox(box.boxNo)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-xs font-medium text-slate-700 flex-1 flex items-center gap-2 flex-wrap">
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                      #{box.boxNo}
                    </span>
                    <span className="text-slate-600">{box.birds} birds</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{box.weight.toFixed(2)} kg</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  boxDetails?: BoxDetail[];
  readOnly?: boolean;
  onSaveRow?: (row: ShopDelivery) => void;
}

function UnLoadingTable({
  rows,
  setRows,
  shops,
  birdTypes,
  boxDetails = [],
  readOnly = false,
  onSaveRow,
}: Props) {
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];
  const safeBoxDetails = boxDetails ?? [];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"box" | "weight">("box");
  const [formData, setFormData] = useState({
    shopId: 0,
    shopName: "",
    birdTypeId: 0,
    birdType: "",
    selectedBoxIds: [] as number[],
    birds: 0,
    weight: 0,
    mortality: 0,
    remarks: "",
  });

  const [validationErrors, setValidationErrors] = useState({
    birdsExceed: false,
    weightExceed: false,
  });

  // ─── Computed farm values ──────────────────────────────────────────
  const farmBirds = useMemo(() => {
    const selected = safeBoxDetails.filter((b) => formData.selectedBoxIds.includes(b.boxNo));
    return selected.reduce((sum, b) => sum + b.birds, 0);
  }, [formData.selectedBoxIds, safeBoxDetails]);

  const farmWeight = useMemo(() => {
    const selected = safeBoxDetails.filter((b) => formData.selectedBoxIds.includes(b.boxNo));
    return selected.reduce((sum, b) => sum + b.weight, 0);
  }, [formData.selectedBoxIds, safeBoxDetails]);

  const boxCount = formData.selectedBoxIds.length;

  const mortKg = useMemo(() => {
    if (formData.birds > 0 && formData.mortality > 0) {
      return (formData.weight / formData.birds) * formData.mortality;
    }
    return 0;
  }, [formData.birds, formData.weight, formData.mortality]);

  // ─── Maximum allowed values (accounting for mortality) ────────────
  const maxAllowedBirds = Math.max(0, farmBirds - formData.mortality);
  const maxAllowedWeight = Math.max(0, farmWeight - mortKg);

  // ─── Validation ──────────────────────────────────────────────────
  const validate = useCallback(() => {
    const birdsExceed = formData.birds > maxAllowedBirds && farmBirds > 0;
    const weightExceed = formData.weight > maxAllowedWeight && farmWeight > 0;
    setValidationErrors({ birdsExceed, weightExceed });
    return !birdsExceed && !weightExceed;
  }, [formData.birds, formData.weight, maxAllowedBirds, maxAllowedWeight, farmBirds, farmWeight]);

  useEffect(() => {
    validate();
  }, [formData.birds, formData.weight, formData.mortality, farmBirds, farmWeight, mortKg, validate]);

  // ─── Display rows ──────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    const saved = safeRows.filter((r) => r.shopId > 0 && r.birds > 0 && r.weight > 0);
    return [...saved].sort((a, b) => b.id - a.id);
  }, [safeRows]);

  const totalPages = useMemo(
    () => Math.ceil(displayRows.length / itemsPerPage),
    [displayRows.length]
  );

  const currentRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayRows.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    } else if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // ─── Form handlers ────────────────────────────────────────────────
  const openForm = () => {
    setMode("box");
    setFormData({
      shopId: 0,
      shopName: "",
      birdTypeId: 0,
      birdType: "",
      selectedBoxIds: [],
      birds: 0,
      weight: 0,
      mortality: 0,
      remarks: "",
    });
    setValidationErrors({ birdsExceed: false, weightExceed: false });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBoxSelection = (newSelectedIds: number[]) => {
    setFormData((prev) => ({
      ...prev,
      selectedBoxIds: newSelectedIds,
    }));
  };

  const handleShopSelect = (selected: any) => {
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        shopId: selected.value,
        shopName: selected.label,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        shopId: 0,
        shopName: "",
      }));
    }
  };

  const handleBirdSelect = (selected: any) => {
    if (selected) {
      const bird = safeBirdTypes.find((b: any) => (b.id ?? b.birdTypeId) === selected.value);
      setFormData((prev) => ({
        ...prev,
        birdTypeId: selected.value,
        birdType: bird ? (bird.birdType ?? bird.name ?? "") : "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        birdTypeId: 0,
        birdType: "",
      }));
    }
  };

  const handleSubmit = () => {
    if (!validate()) {
      alert("Please fix the validation errors before saving.");
      return;
    }

    if (formData.shopId === 0 || formData.birds === 0 || formData.weight === 0) {
      alert("Please select a Shop, and enter Delivery Birds and Wt (Del.).");
      return;
    }

    if (formData.selectedBoxIds.length === 0) {
      alert("Please select at least one box.");
      return;
    }

    const maxSerial = safeRows.reduce((max, r) => Math.max(max, r.serialNo || 0), 0);
    const newRow: ShopDelivery = {
      id: Date.now(),
      serialNo: maxSerial + 1,
      shopId: formData.shopId,
      shopName: formData.shopName,
      birdTypeId: formData.birdTypeId,
      birdType: formData.birdType,
      boxNo: formData.selectedBoxIds.length,
      birds: formData.birds,
      weight: formData.weight,
      mortality: formData.mortality || 0,
      remarks: formData.remarks || "",
      rate: 0,
      amount: 0,
    };

    if (onSaveRow) {
      onSaveRow(newRow);
    }

    setRows((prev) => [newRow, ...prev]);
    setShowForm(false);
    setCurrentPage(1);
  };

  // ─── Options ───────────────────────────────────────────────────────
  const shopOptions = useMemo(() => {
    if (!safeShops || safeShops.length === 0) {
      return [{ value: 0, label: "No shops available", isDisabled: true }];
    }
    const opts = safeShops
      .map((shop: any) => {
        const value = shop.id ?? shop.shopId ?? 0;
        const label = shop.shopName ?? shop.name ?? `Shop ${value}`;
        return { value, label, isDisabled: false };
      })
      .filter((opt) => opt.value > 0);
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [safeShops]);

  const birdOptions = useMemo(() => {
    if (!safeBirdTypes || safeBirdTypes.length === 0) {
      return [{ value: 0, label: "No bird types available", isDisabled: true }];
    }
    return safeBirdTypes
      .map((bird: any) => {
        const value = bird.id ?? bird.birdTypeId ?? 0;
        const label = bird.birdType ?? bird.name ?? `Bird ${value}`;
        return { value, label, isDisabled: false };
      })
      .filter((opt) => opt.value > 0);
  }, [safeBirdTypes]);

  const isFormValid = useMemo(() => {
    return (
      formData.shopId > 0 &&
      formData.birds > 0 &&
      formData.weight > 0 &&
      formData.selectedBoxIds.length > 0 &&
      !validationErrors.birdsExceed &&
      !validationErrors.weightExceed
    );
  }, [formData, validationErrors]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <style>{`
        .no-spinner::-webkit-inner-spin-button,.no-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.no-spinner{-moz-appearance:textfield}
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ShoppingCart size={18} className="text-emerald-600" />
          Shop Deliveries
        </h2>
        {!readOnly && !showForm && (
          <button
            onClick={openForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors active:scale-95 touch-manipulation"
          >
            <Plus size={18} />
            Add Shop
          </button>
        )}
      </div>

      {/* ─── INLINE FORM ────────────────────────────────────────────── */}
      {showForm ? (
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Add New Shop Delivery</h3>
            <button
              onClick={closeForm}
              className="h-10 w-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
            >
              <X size={20} />
            </button>
          </div>

          {/* Row 1: Delivery Type + Shop Name */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
            <div className="sm:w-[40%]">
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Delivery Type</label>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setMode("box")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                    mode === "box"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Box
                </button>
                <button
                  type="button"
                  onClick={() => setMode("weight")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                    mode === "weight"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Weight
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
                  control: (base) => ({
                    ...base,
                    minHeight: 44,
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                    backgroundColor: "#f8fafc",
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999,
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                  }),
                  option: (base, state) => ({
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
                  control: (base) => ({
                    ...base,
                    minHeight: 44,
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                    backgroundColor: "#f8fafc",
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999,
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                  }),
                  option: (base, state) => ({
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
                />
              ) : (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 text-center">
                  <AlertCircle size={20} className="mx-auto mb-1 text-slate-300" />
                  <p className="text-sm text-slate-500">No boxes available from pickup.</p>
                  <p className="text-xs text-slate-400">
                    Please complete the Pickup KPI step first.
                  </p>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Select the boxes being delivered. Enter Delivery Birds and Wt (Del.) manually below.
              </p>
            </div>
          </div>

          {/* Row 3: Box No | Birds (Farm) | Birds (Del.) | Mor (Birds) */}
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
                <span className="text-slate-400">🌾</span> Birds (Farm)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {farmBirds}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <span className="text-slate-400">🐔</span> Birds (Del.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={formData.birds || ""}
                onChange={(e) => handleFormChange("birds", Number(e.target.value))}
                placeholder="0"
                min="0"
                className={`w-full rounded-xl border px-4 sm:px-5 py-2 text-sm font-medium outline-none transition-all no-spinner h-[44px] ${
                  validationErrors.birdsExceed
                    ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-200"
                    : "border-slate-200 bg-slate-50/50 text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                }`}
                required
              />
              {validationErrors.birdsExceed && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Cannot be more than {maxAllowedBirds}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <span className="text-slate-400">⚰️</span> Mor (Birds)
              </label>
              <input
                type="number"
                value={formData.mortality || ""}
                onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                placeholder="0"
                min="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all no-spinner h-[44px]"
              />
            </div>
          </div>

          {/* Row 4: (empty) | Wt (Farm) | Wt (Del.) | Mor (kg) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div>{/* Empty placeholder */}</div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Wt (Farm)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {farmWeight.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Wt (Del.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.weight || ""}
                onChange={(e) => handleFormChange("weight", Number(e.target.value))}
                placeholder="0.00"
                min="0"
                className={`w-full rounded-xl border px-4 sm:px-5 py-2 text-sm font-medium outline-none transition-all no-spinner h-[44px] ${
                  validationErrors.weightExceed
                    ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-200"
                    : "border-slate-200 bg-slate-50/50 text-slate-700 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                }`}
                required
              />
              {validationErrors.weightExceed && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Cannot be more than {maxAllowedWeight.toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Scale size={16} className="text-slate-400" /> Mor (kg)
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 sm:px-5 py-2 text-sm font-medium text-slate-600 flex items-center h-[44px]">
                {mortKg > 0 ? mortKg.toFixed(2) : "—"}
              </div>
            </div>
          </div>

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
              onClick={closeForm}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors active:scale-95 touch-manipulation ${
                isFormValid
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
              }`}
            >
              Save Delivery
            </button>
          </div>
        </div>
      ) : (
        /* ─── TABLE VIEW ────────────────────────────────────────────── */
        <>
          <div className="p-3 sm:p-4 bg-slate-50/40 space-y-3">
            {currentRows.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200 border-dashed">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-slate-600">No shops added yet</p>
                  <p className="text-xs text-slate-400">
                    Click <span className="font-semibold text-emerald-600">Add Shop</span> to begin recording entries.
                  </p>
                </div>
              </div>
            )}

            {currentRows.map((row) => {
              const avgPerBird = row.birds > 0 ? row.weight / row.birds : 0;
              const mortWeight = row.mortality > 0 ? row.mortality * avgPerBird : 0;

              return (
                <div
                  key={row.id}
                  className="bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-500 border-none shadow-sm flex items-center justify-center text-white shrink-0">
                      <Check size={16} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm tracking-wide truncate">{row.shopName}</span>
                  </div>

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
            })}
          </div>

          {/* Pagination */}
          <div className="border-t border-slate-100 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-500">
                Page <span className="font-bold text-slate-700">{currentPage}</span> of{" "}
                <span className="font-bold text-slate-700">{Math.max(totalPages, 1)}</span>
                <span className="ml-2 text-[10px] text-slate-400">({itemsPerPage} per page)</span>
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
        </>
      )}
    </div>
  );
}

export default React.memo(UnLoadingTable);