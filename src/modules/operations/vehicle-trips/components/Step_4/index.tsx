import React, { useState, useEffect, useMemo } from "react";
import { Plus, Clock, Building2, Users, Scale, AlertCircle } from "lucide-react";
import TripPagination from "../TripPagination";
import { useShopDeliveryForm } from "./useShopDeliveryForm";
import ShopDeliveryForm from "./ShopDeliveryForm";
import ShopDeliveryCard from "./ShopDeliveryCard";
import { generateShopPDF } from "../../utils/generateShopPDF";
import type { ShopDelivery, BoxDetail } from "../../types/trip";
import henImage from "./Hen_Image.webp";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  boxDetails?: BoxDetail[];
  readOnly?: boolean;
  onSaveRow?: (row: ShopDelivery) => void;
  tripNo?: string;
  vehicleNo?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  tripDate?: string;
}

export default function UnLoadingTable({
  rows,
  setRows,
  shops,
  birdTypes,
  boxDetails = [],
  readOnly = false,
  onSaveRow,
  tripNo = "",
  vehicleNo = "",
  supervisorName = "",
  supervisorPhone = "",
  tripDate = "",
}: Props) {
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];
  const safeBoxDetails = boxDetails ?? [];

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [autoCaptureTime, setAutoCaptureTime] = useState<string>("");

  const {
    mode,
    setMode,
    formData,
    setFormData,
    validationErrors,
    usedBoxIds,
    availableBoxDetails,
    farmBirds,
    farmWeight,
    boxCount,
    weightModeTotals,
    mortKg,
    deliveredBirds,
    deliveredWeight,
    weightLoss,
    validate,
  } = useShopDeliveryForm(safeRows, safeBoxDetails, editingId);

  // ─── Top KPI Calculations ────────────────────────────────────
  const topKpiTotals = useMemo(() => {
    const totalShops = safeRows.length;
    const totalBirds = safeRows.reduce((acc, r) => acc + (r.birds || 0), 0);
    const totalWeight = safeRows.reduce((acc, r) => acc + (r.weight || 0), 0);
    const totalMortality = safeRows.reduce((acc, r) => acc + (r.mortality || 0), 0);
    const totalMortKg = safeRows.reduce((acc, r) => {
      const extra = r as any;
      return acc + (extra.mortKg || 0);
    }, 0);
    const latestCaptured = safeRows.reduce((latest, r) => {
      const extra = r as any;
      return extra.autoCaptureTime || latest;
    }, "");
    return {
      shops: totalShops,
      birds: totalBirds,
      weight: totalWeight,
      mortality: totalMortality,
      mortKg: totalMortKg,
      lastCaptureTime: latestCaptured || new Date().toLocaleString(),
    };
  }, [safeRows]);

  // ─── Display rows with pagination ──────────────────────────────
  const displayRows = useMemo<ShopDelivery[]>(() => {
    const saved = safeRows.filter((r: ShopDelivery) => r.shopId > 0 && r.birds > 0 && r.weight > 0);
    return [...saved].sort((a, b) => b.id - a.id);
  }, [safeRows]);

  const totalPages = useMemo<number>(() => Math.ceil(displayRows.length / itemsPerPage), [displayRows.length]);
  const currentRows = useMemo<ShopDelivery[]>(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayRows.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
    else if (totalPages === 0) setCurrentPage(1);
  }, [totalPages, currentPage]);

  // ─── Form handlers ────────────────────────────────────────────────
  const openAddForm = () => {
    setEditingId(null);
    setMode("box");
    setAutoCaptureTime(new Date().toLocaleString());
    setFormData({
      shopId: 0,
      shopName: "",
      birdTypeId: 0,
      birdType: "",
      selectedBoxIds: [],
      birds: 0,
      weight: 0,
      mortality: 0,
      mortWeight: 0,
      remarks: "",
      perBoxData: [],
    });
    setShowForm(true);
  };

  const openEditForm = (row: ShopDelivery) => {
    const rowWithExtra = row as any;
    setEditingId(row.id);
    setMode(rowWithExtra.deliveryMode || "box");
    setAutoCaptureTime(rowWithExtra.autoCaptureTime || new Date().toLocaleString());
    setFormData({
      shopId: row.shopId,
      shopName: row.shopName,
      birdTypeId: row.birdTypeId,
      birdType: row.birdType,
      selectedBoxIds: rowWithExtra.selectedBoxIds || [],
      birds: row.birds,
      weight: row.weight,
      mortality: row.mortality || 0,
      mortWeight: rowWithExtra.mortKg || 0,
      remarks: row.remarks || "",
      perBoxData: rowWithExtra.perBoxData || [],
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePerBoxChange = (index: number, field: "birds" | "weight", value: number) => {
    setFormData((prev) => {
      const updated = [...prev.perBoxData];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, perBoxData: updated };
    });
  };

  const handleBoxSelection = (newSelectedIds: number[]) => {
    setFormData((prev) => ({ ...prev, selectedBoxIds: newSelectedIds }));
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
    if (validationErrors.birdsExceedFarm) {
      alert(`⚠️ Cannot exceed more than Temple Birds (${farmBirds}).`);
      return;
    }
    if (validationErrors.weightExceedFarm) {
      alert(`⚠️ Cannot exceed more than Temple Wt (${farmWeight.toFixed(2)}).`);
      return;
    }
    if (validationErrors.perBoxBirdsErrors.some((err: boolean) => err)) {
      alert("⚠️ Some boxes have Birds(Del.) exceeding Birds(Temple). Please fix.");
      return;
    }
    if (validationErrors.perBoxWeightErrors.some((err: boolean) => err)) {
      alert("⚠️ Some boxes have Wt(Del.) exceeding Wt(Temple). Please fix.");
      return;
    }
    if (!validate()) {
      alert("Please fix the validation errors before saving.");
      return;
    }

    if (formData.shopId === 0) {
      alert("Please select a Shop.");
      return;
    }

    let finalBirds = formData.birds;
    let finalWeight = formData.weight;
    let selectedBoxIds: number[] = [];
    let farmBirdsVal = 0;
    let farmWeightVal = 0;
    let mortKgVal = 0;
    let perBoxData: { boxNo: number; birds: number; weight: number }[] = [];

    if (mode === "box") {
      if (formData.mortality < 0) {
        alert("Mortality cannot be negative.");
        return;
      }
      if (formData.selectedBoxIds.length === 0) {
        alert("Please select at least one box.");
        return;
      }
      selectedBoxIds = formData.selectedBoxIds;
      farmBirdsVal = farmBirds;
      farmWeightVal = farmWeight;
      mortKgVal = mortKg;
      finalBirds = farmBirds - formData.mortality;
      finalWeight = farmWeight - mortKg;
    } else {
      if (formData.selectedBoxIds.length === 0) {
        alert("Please select at least one box.");
        return;
      }
      for (const item of formData.perBoxData) {
        if (item.birds < 0 || item.weight < 0) {
          alert("Values cannot be negative.");
          return;
        }
      }
      if (formData.mortality < 0 || formData.mortWeight < 0) {
        alert("Mortality values cannot be negative.");
        return;
      }
      selectedBoxIds = formData.selectedBoxIds;
      farmBirdsVal = farmBirds;
      farmWeightVal = farmWeight;
      const totalBirds = formData.perBoxData.reduce((sum: number, item: { boxNo: number; birds: number; weight: number }) => sum + item.birds, 0);
      const totalWeight = formData.perBoxData.reduce((sum: number, item: { boxNo: number; birds: number; weight: number }) => sum + item.weight, 0);
      finalBirds = totalBirds;
      finalWeight = totalWeight;
      mortKgVal = formData.mortWeight;
      perBoxData = formData.perBoxData.map((item) => ({ ...item }));
    }

    const maxSerial = safeRows.reduce((max: number, r: ShopDelivery) => Math.max(max, r.serialNo || 0), 0);
    const newRow: any = {
      id: editingId ?? Date.now(),
      serialNo: editingId ? (safeRows.find((r) => r.id === editingId)?.serialNo || maxSerial + 1) : maxSerial + 1,
      shopId: formData.shopId,
      shopName: formData.shopName,
      birdTypeId: formData.birdTypeId,
      birdType: formData.birdType,
      boxNo: formData.selectedBoxIds.length,
      birds: finalBirds,
      weight: finalWeight,
      mortality: formData.mortality,
      remarks: formData.remarks || "",
      rate: 0,
      amount: 0,
      deliveryMode: mode,
      selectedBoxIds: selectedBoxIds,
      farmBirds: farmBirdsVal,
      farmWeight: farmWeightVal,
      mortKg: mortKgVal,
      perBoxData: perBoxData,
      autoCaptureTime: autoCaptureTime || new Date().toLocaleString(),
    };

    if (editingId !== null) {
      setRows((prev) => prev.map((r) => (r.id === editingId ? newRow : r)));
      if (onSaveRow) onSaveRow(newRow);
    } else {
      if (onSaveRow) onSaveRow(newRow);
      setRows((prev) => [newRow, ...prev]);
    }
    closeForm();
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
      .filter((opt: { value: number; label: string; isDisabled: boolean }) => opt.value > 0);
    opts.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
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
      .filter((opt: { value: number; label: string; isDisabled: boolean }) => opt.value > 0);
  }, [safeBirdTypes]);

  const isFormValid = useMemo<boolean>(() => {
    if (mode === "box") {
      return (
        formData.shopId > 0 &&
        formData.selectedBoxIds.length > 0 &&
        farmBirds > 0 &&
        formData.mortality >= 0 &&
        formData.mortality <= farmBirds &&
        !validationErrors.birdsExceed
      );
    } else {
      const allBoxesFilled = formData.perBoxData.every(
        (item: { boxNo: number; birds: number; weight: number }) => item.birds > 0 && item.weight > 0
      );
      const noPerBoxErrors =
        !validationErrors.perBoxBirdsErrors.some((err: boolean) => err) &&
        !validationErrors.perBoxWeightErrors.some((err: boolean) => err);
      return (
        formData.shopId > 0 &&
        formData.selectedBoxIds.length > 0 &&
        allBoxesFilled &&
        formData.mortality >= 0 &&
        formData.mortWeight >= 0 &&
        !validationErrors.birdsExceed &&
        !validationErrors.birdsMismatch &&
        !validationErrors.birdsExceedFarm &&
        !validationErrors.weightExceedFarm &&
        noPerBoxErrors
      );
    }
  }, [mode, formData, farmBirds, validationErrors]);

  // ─── Safe Async PDF Handler ────────────────────────────────────────
  const handleDownloadPDF = async (row: ShopDelivery) => {
    try {
      await generateShopPDF(
        row,
        safeBoxDetails,
        tripNo,
        vehicleNo,
        supervisorName,
        supervisorPhone,
        tripDate,
        undefined, // left logo URL
        henImage    // right logo URL
      );
    } catch (error: any) {
      console.error("PDF download failed:", error);
      // You can safely upgrade this to a Toast library later!
      alert("Failed to generate PDF. Please check the browser console (F12) for error details.");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4">
      <style>{`
        .no-spinner::-webkit-inner-spin-button,.no-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.no-spinner{-moz-appearance:textfield}
      `}</style>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
            <Clock size={13} className="text-emerald-600" /> Captured Time
          </span>
          <span className="text-xs font-bold text-slate-800 mt-1 truncate" title={topKpiTotals.lastCaptureTime}>
            {topKpiTotals.lastCaptureTime}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Building2 size={13} className="text-slate-400" /> Shops
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.shops}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Users size={13} className="text-blue-500" /> Birds
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.birds}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Scale size={13} className="text-emerald-500" /> Weight (kg)
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.weight.toFixed(2)}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <AlertCircle size={13} className="text-rose-500" /> Mor
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.mortality}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Scale size={13} className="text-rose-500" /> Mor (kg)
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.mortKg.toFixed(2)}</span>
        </div>
      </div>

      {!readOnly && !showForm && (
        <div className="flex justify-end">
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-xs transition-all active:scale-95 touch-manipulation"
          >
            <Plus size={18} />
            Add Shop
          </button>
        </div>
      )}

      {showForm ? (
        <ShopDeliveryForm
          mode={mode}
          setMode={setMode}
          formData={formData}
          setFormData={setFormData}
          validationErrors={validationErrors}
          farmBirds={farmBirds}
          farmWeight={farmWeight}
          boxCount={boxCount}
          weightModeTotals={weightModeTotals}
          mortKg={mortKg}
          deliveredBirds={deliveredBirds}
          deliveredWeight={deliveredWeight}
          usedBoxIds={usedBoxIds}
          safeBoxDetails={safeBoxDetails}
          readOnly={readOnly}
          autoCaptureTime={autoCaptureTime}
          editingId={editingId}
          onClose={closeForm}
          onSubmit={handleSubmit}
          handleShopSelect={handleShopSelect}
          handleBirdSelect={handleBirdSelect}
          handleBoxSelection={handleBoxSelection}
          handleFormChange={handleFormChange}
          handlePerBoxChange={handlePerBoxChange}
          shopOptions={shopOptions}
          birdOptions={birdOptions}
          isFormValid={isFormValid}
        />
      ) : (
        <>
          <div className="p-3 sm:p-4 bg-slate-50/40 rounded-2xl border border-slate-200/80">
            {currentRows.length === 0 ? (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentRows.map((row) => (
                  <ShopDeliveryCard
                    key={row.id}
                    row={row as any}
                    readOnly={readOnly}
                    onEdit={openEditForm}
                    onPDF={handleDownloadPDF}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white px-4 py-3 rounded-2xl border">
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