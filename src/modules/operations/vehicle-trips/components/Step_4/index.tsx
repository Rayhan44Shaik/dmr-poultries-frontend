// src/modules/operations/vehicle-trips/utils/generateShopPDF.ts
// (Referenced helper or included components as part of UnLoadingTable module)

// src/modules/operations/vehicle-trips/components/Step_4/UnLoadingTable.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Plus, Clock, Building2, Users, Scale, AlertCircle, Search, X, 
  LayoutGrid, BarChart2, Save, Send, Loader2, 
  AlertTriangle, Package, RefreshCw, LogOut, CheckCircle
} from "lucide-react";
import jsPDF from "jspdf";
import TripPagination from "../TripPagination";
import { useShopDeliveryForm } from "./useShopDeliveryForm";
import ShopDeliveryForm from "./ShopDeliveryForm";
import ShopDeliveryCard from "./ShopDeliveryCard";
import { generateShopPDF } from "../../utils/generateShopPDF";
import type { ShopDelivery, BoxDetail } from "../../types/trip";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  boxDetails?: BoxDetail[];
  readOnly?: boolean;
  isSubmitted?: boolean;
  editingShopId?: string | number | null;
  onEditShop?: (shopId: string | number) => void;
  onCancelEdit?: () => void;
  onSaveRow?: (row: ShopDelivery) => void;
  tripNo?: string;
  vehicleNo?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  tripDate?: string;
  viewMode?: "shop" | "box";
  onViewModeChange?: (mode: "shop" | "box") => void;
  stepNumber?: number | string;
  updateDeliveries?: (rows: ShopDelivery[], persist?: boolean, silent?: boolean) => void;
  submitDeliveries?: () => boolean | Promise<boolean>;
  onClose?: () => void;
}

// ─── Confirmation Modal Component ───────────────────────────────────
function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Yes, Proceed",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  type = "warning",
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "warning" | "info";
}) {
  if (!isOpen) return null;

  const iconColor = type === "warning" ? "text-amber-600" : "text-emerald-600";
  const borderColor = type === "warning" ? "border-amber-200" : "border-emerald-200";
  const bgGradient = type === "warning"
    ? "from-amber-50 to-orange-50"
    : "from-emerald-50 to-teal-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border ${borderColor}`}>
        <div className={`bg-gradient-to-br ${bgGradient} p-6`}>
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 p-2 rounded-full bg-white/80 border ${borderColor}`}>
              <AlertTriangle size={22} className={iconColor} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-xs"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-xs transition-all active:scale-[0.98] ${
              type === "warning"
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast Notification Component ─────────────────────────────────────
function Toast({ 
  message, 
  type = "success", 
  onClose 
}: { 
  message: string; 
  type?: "success" | "error" | "warning" | "info"; 
  onClose: () => void 
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-100/50",
    warning: "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100/50",
    info: "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100/50",
    error: "bg-rose-50 border-rose-300 text-rose-900 shadow-rose-100/50",
  }[type];

  const icon = type === "success" ? (
    <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
  ) : type === "warning" ? (
    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
  ) : type === "info" ? (
    <AlertCircle size={18} className="text-blue-600 flex-shrink-0" />
  ) : (
    <AlertTriangle size={18} className="text-rose-600 flex-shrink-0" />
  );

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 border text-xs sm:text-sm font-semibold ${styles}`}>
        {icon}
        <span>{message}</span>
        <button 
          onClick={onClose} 
          className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export default function UnLoadingTable({
  rows,
  setRows,
  shops,
  birdTypes,
  boxDetails = [],
  readOnly = false,
  isSubmitted = false,
  editingShopId = null,
  onEditShop,
  onCancelEdit,
  onSaveRow,
  tripNo = "",
  vehicleNo = "",
  supervisorName = "",
  supervisorPhone = "",
  tripDate = "",
  viewMode = "shop",
  onViewModeChange,
  stepNumber = 4,
  updateDeliveries,
  submitDeliveries,
  onClose,
}: Props) {
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];
  const safeBoxDetails = boxDetails ?? [];

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage =6;
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [autoCaptureTime, setAutoCaptureTime] = useState<string>("");

  // ─── Submission Status Tracking ─────────────────────────────────
  const [hasBeenSubmitted, setHasBeenSubmitted] = useState<boolean>(isSubmitted);

  useEffect(() => {
    if (isSubmitted !== undefined) {
      setHasBeenSubmitted(isSubmitted);
    }
  }, [isSubmitted]);

  // ─── Saving & Toast State ─────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // ─── Confirmation Modal State ────────────────────────────────────
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: "warning" | "info";
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  });

  // ─── Table Search State ─────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState<string>("");

  const {
    mode,
    setMode,
    formData,
    setFormData,
    validationErrors,
    usedBoxIds,
    farmBirds,
    farmWeight,
    boxCount,
    weightModeTotals,
    mortKg,
    deliveredBirds,
    deliveredWeight,
    validate,
  } = useShopDeliveryForm(safeRows, safeBoxDetails, editingId);

  // Sync editing ID from parent
  useEffect(() => {
    if (editingShopId !== null && editingShopId !== undefined) {
      const targetRow = safeRows.find((r) => r.id === editingShopId || String(r.id) === String(editingShopId));
      if (targetRow) {
        openEditForm(targetRow);
      }
    }
  }, [editingShopId, safeRows]);

  // ─── Filter Pending Boxes ───────────────────────────────────────
  const pendingBoxes = useMemo(() => {
    const assignedBoxIds = new Set<number>();
    safeRows.forEach((row: any) => {
      if (Array.isArray(row.selectedBoxIds)) {
        row.selectedBoxIds.forEach((id: number) => assignedBoxIds.add(Number(id)));
      }
    });

    return safeBoxDetails.filter((b: any) => {
      const bId = Number(b.id ?? b.boxNo);
      return !assignedBoxIds.has(bId);
    });
  }, [safeRows, safeBoxDetails]);

  // ─── PDF Export for Pending Boxes ─────────────────────────────
  const handleDownloadPendingBoxesPDF = () => {
    if (pendingBoxes.length === 0) {
      setToast({ message: "No pending boxes available to generate PDF.", type: "warning" });
      return;
    }

    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const totalWeight = pendingBoxes.reduce((sum, box: any) => sum + Number(box.weight ?? box.netWeight ?? 0), 0);
    const totalBirds = pendingBoxes.reduce((sum, box: any) => sum + Number(box.birds ?? box.birdsCount ?? 0), 0);

    const startX = 10;
    const totalWidth = 190;
    const blockGap = 4;
    const blockWidth = (totalWidth - blockGap * 2) / 3;

    const colBoxW = 16;
    const colBirdsW = 18;

    const headerTopY = 29;
    const headerHeight = 7;
    const headerBottomY = headerTopY + headerHeight;
    const rowHeight = 6.8;
    const maxRowsPerPage = 33;
    const maxItemsPerPage = maxRowsPerPage * 3;

    const totalPages = Math.ceil(pendingBoxes.length / maxItemsPerPage);

    const drawPageHeader = (pageNumber: number) => {
      const titleX = 10;
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("PENDING BOXES FOR DELIVERY", titleX, 14);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Trip: ${tripNo || "N/A"}  |  Vehicle: ${vehicleNo || "N/A"}  |  Date: ${tripDate || new Date().toLocaleDateString()}`, titleX, 20);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total: ${pendingBoxes.length} Boxes | ${totalBirds} Birds | ${totalWeight.toFixed(2)} kg`, 200, 14, { align: "right" });

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${pageNumber} of ${totalPages}`, 200, 20, { align: "right" });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(10, 26, 200, 26);

      for (let b = 0; b < 3; b++) {
        const bX = startX + b * (blockWidth + blockGap);
        doc.setFillColor(241, 245, 249);
        doc.rect(bX, headerTopY, blockWidth, headerHeight, "F");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);

        const labelY = headerTopY + 4.8;
        doc.text("BOX", bX + colBoxW / 2, labelY, { align: "center" });
        doc.text("BIRDS", bX + colBoxW + colBirdsW / 2, labelY, { align: "center" });
        doc.text("WT(KG)", bX + blockWidth - 4, labelY, { align: "right" });
      }

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(10, headerBottomY, 200, headerBottomY);
    };

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      drawPageHeader(page + 1);

      const pageItems = pendingBoxes.slice(page * maxItemsPerPage, (page + 1) * maxItemsPerPage);
      const totalRowsOnPage = Math.ceil(pageItems.length / 3);
      const contentEndY = headerBottomY + totalRowsOnPage * rowHeight;

      pageItems.forEach((box: any, i: number) => {
        const r = Math.floor(i / 3);
        const b = i % 3;

        const bX = startX + b * (blockWidth + blockGap);
        const rowTopY = headerBottomY + r * rowHeight;
        const textY = rowTopY + 4.6;

        if (r % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(bX, rowTopY, blockWidth, rowHeight, "F");
        }

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(bX, rowTopY + rowHeight, bX + blockWidth, rowTopY + rowHeight);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(bX + colBoxW, rowTopY, bX + colBoxW, rowTopY + rowHeight);
        doc.line(bX + colBoxW + colBirdsW, rowTopY, bX + colBoxW + colBirdsW, rowTopY + rowHeight);

        const boxNo = String(box.boxNo ?? box.id ?? i + 1);
        const birdsVal = String(box.birds ?? box.birdsCount ?? "-");
        const weightVal = Number(box.weight ?? box.netWeight ?? 0).toFixed(2);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text(boxNo, bX + colBoxW / 2, textY, { align: "center" });

        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(birdsVal, bX + colBoxW + colBirdsW / 2, textY, { align: "center" });

        doc.setFont("Helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(weightVal, bX + blockWidth - 4, textY, { align: "right" });
      });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.6);
      const sep1X = startX + blockWidth + blockGap / 2;
      const sep2X = startX + 2 * blockWidth + (1.5 * blockGap);
      doc.line(sep1X, headerTopY, sep1X, contentEndY);
      doc.line(sep2X, headerTopY, sep2X, contentEndY);
    }

    doc.save(`Pending_Boxes_${tripNo || "Report"}.pdf`);
    setToast({ message: "Pending Boxes PDF generated successfully!", type: "success" });
  };

  // ─── Auto-Save Trigger ────────────────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    
    if (isSavingRef.current || readOnly || !updateDeliveries) {
      setIsAutoSaving(false);
      return;
    }

    setIsAutoSaving(true);
    autoSaveTimeout.current = setTimeout(() => {
      if (!isSavingRef.current && !readOnly && updateDeliveries) {
        updateDeliveries(safeRows, true, true);
      }
      setIsAutoSaving(false);
      autoSaveTimeout.current = null;
    }, 1000);
  }, [safeRows, updateDeliveries, readOnly]);

  useEffect(() => {
    if (!readOnly && safeRows.length > 0) {
      triggerAutoSave();
    } else {
      setIsAutoSaving(false);
    }
    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [safeRows, triggerAutoSave, readOnly]);

  // ─── Manual Save Progress Handler ──────────────────────────────
  const handleSaveProgress = () => {
    if (isSavingRef.current || readOnly) return;
    isSavingRef.current = true;
    setIsSaving(true);

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = null;
      setIsAutoSaving(false);
    }

    try {
      if (updateDeliveries) {
        updateDeliveries(safeRows, true, false);
      }
      setToast({ message: "Deliveries progress saved successfully!", type: "success" });
    } catch (error) {
      console.error("Save progress error:", error);
      setToast({ message: "Failed to save progress. Please try again.", type: "error" });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
    }
  };

  // ─── Submit / Update Deliveries Handler ──────────────────────────
  const handleSubmitOrUpdateDeliveries = () => {
    if (readOnly) return;

    if (!hasBeenSubmitted) {
      setConfirmation({
        isOpen: true,
        title: "Submit Shop Deliveries",
        message: "Are you sure you want to submit all shop deliveries?",
        confirmLabel: "Yes, Submit",
        cancelLabel: "Cancel",
        type: "info",
        onConfirm: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          void (async () => {
            let success = true;
            if (submitDeliveries) {
              success = (await submitDeliveries()) !== false;
            } else if (updateDeliveries) {
              updateDeliveries(safeRows);
            }
            if (success) {
              setHasBeenSubmitted(true);
              setToast({ message: "Deliveries submitted successfully!", type: "success" });
              if (showForm) closeForm();
              // Do not call onClose — parent advances to Step 5 with the same trip.
            }
          })();
        },
        onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
      });
    } else {
      setConfirmation({
        isOpen: true,
        title: "Update Deliveries",
        message: "Are you sure you want to update submitted shop deliveries with recent edits?",
        confirmLabel: "Yes, Update",
        cancelLabel: "Cancel",
        type: "info",
        onConfirm: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          if (updateDeliveries) {
            updateDeliveries(safeRows, true, false);
          }
          setHasBeenSubmitted(true);
          setToast({ message: "Deliveries updated successfully!", type: "success" });
          if (showForm) {
            closeForm();
          } else if (onClose) {
            onClose();
          } else if (onCancelEdit) {
            onCancelEdit();
          }
        },
        onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // ─── Close / Cancel — discard unsaved step (no draft / no API) ───
  const handleCloseView = () => {
    if (showForm) {
      closeForm();
      if (hasBeenSubmitted) {
        setToast({ message: "Edit cancelled. Details locked to previously submitted state.", type: "info" });
      }
      return;
    }

    if (onClose) {
      onClose();
    } else if (onCancelEdit) {
      onCancelEdit();
    }
  };

  // ─── Form Handlers ──────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    if (onCancelEdit && editingShopId !== null && editingShopId !== undefined) {
      onCancelEdit();
    }
  };

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
      setToast({ message: `Cannot exceed Temple Birds (${farmBirds}).`, type: "warning" });
      return;
    }
    if (validationErrors.weightExceedFarm) {
      setToast({ message: `Cannot exceed Temple Weight (${farmWeight.toFixed(2)} Kg).`, type: "warning" });
      return;
    }
    if (!validate()) {
      setToast({ message: "Please resolve form validation issues before saving.", type: "warning" });
      return;
    }

    if (formData.shopId === 0) {
      setToast({ message: "Please select a Shop.", type: "warning" });
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
      if (formData.selectedBoxIds.length === 0) {
        setToast({ message: "Please select at least one box.", type: "warning" });
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
        setToast({ message: "Please select at least one box.", type: "warning" });
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

    setToast({ message: `Shop "${formData.shopName}" saved successfully!`, type: "success" });
    closeForm();
    setCurrentPage(1);
  };

  // ─── Select Options ───────────────────────────────────────────────
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

  // ─── Filtered Search & Pagination ──────────────────────────────
  const displayRows = useMemo<ShopDelivery[]>(() => {
    const saved = safeRows.filter((r: ShopDelivery) => r.shopId > 0 && r.birds > 0 && r.weight > 0);

    const filtered = saved.filter((r: ShopDelivery) => {
      if (!searchTerm.trim()) return true;
      const query = searchTerm.toLowerCase();
      const shopNameMatch = (r.shopName || "").toLowerCase().includes(query);
      const birdTypeMatch = (r.birdType || "").toLowerCase().includes(query);
      const remarksMatch = (r.remarks || "").toLowerCase().includes(query);
      return shopNameMatch || birdTypeMatch || remarksMatch;
    });

    return [...filtered].sort((a, b) => b.id - a.id);
  }, [safeRows, searchTerm]);

  const totalPages = useMemo<number>(() => Math.ceil(displayRows.length / itemsPerPage), [displayRows.length]);

  const currentRows = useMemo<ShopDelivery[]>(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayRows.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
    else if (totalPages === 0) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

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
        undefined
      );
    } catch (error: any) {
      console.error("PDF download failed:", error);
      setToast({ message: "Failed to generate PDF report.", type: "error" });
    }
  };

  return (
    <div className="w-full space-y-4">
      <style>{`
        .no-spinner::-webkit-inner-spin-button,.no-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.no-spinner{-moz-appearance:textfield}
        .auto-save-indicator {
          font-size: 0.65rem;
          color: #059669;
          display: flex;
          align-items: center;
          gap: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ─── SEARCH & ACTION HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          {onViewModeChange && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80 shrink-0">
              <button
                onClick={() => onViewModeChange("shop")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "shop"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={13} />
                Shop View
              </button>
              <button
                onClick={() => onViewModeChange("box")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "box"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart2 size={13} />
                Box Analysis
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative w-full sm:w-64 max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search shop name, bird type..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right Side Header Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {!readOnly && isAutoSaving && (
            <span className="auto-save-indicator mr-1 text-emerald-600 text-xs flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Saving...
            </span>
          )}

          <button
            onClick={handleDownloadPendingBoxesPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            title="Download PDF of Pending Boxes"
          >
            <Package size={15} className="text-emerald-600" />
            <span>Boxes ({pendingBoxes.length})</span>
          </button>

          {!readOnly && !showForm && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            >
              <Plus size={15} className="text-emerald-100" />
              <span>Add Shop</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── TOP KPI SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
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
            <Users size={13} className="text-emerald-600" /> Birds
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.birds}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Scale size={13} className="text-emerald-600" /> Weight (kg)
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

      {/* ─── MAIN CONTENT VIEW (FORM VS TABLE CARDS) ─── */}
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
          readOnly={false}
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
          showActions={true}
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
                  {searchTerm ? (
                    <>
                      <p className="font-medium text-slate-600">No matching shops found</p>
                      <p className="text-xs text-slate-400">
                        Try searching for another keyword or{" "}
                        <button onClick={clearSearch} className="font-semibold text-emerald-600 hover:underline">
                          clear search
                        </button>.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-600">No shops added yet</p>
                      {!readOnly && (
                        <p className="text-xs text-slate-400">
                          Click <span className="font-semibold text-emerald-600">Add Shop</span> to begin recording entries.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentRows.map((row) => (
                  <ShopDeliveryCard
                    key={row.id}
                    row={row as any}
                    readOnly={readOnly}
                    onEdit={(selectedRow) => {
                      if (onEditShop) {
                        onEditShop(selectedRow.id);
                      } else {
                        openEditForm(selectedRow);
                      }
                    }}
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

      {/* ─── BOTTOM ACTION CONTROL BAR (ONLY VISIBLE IN UNLOCKED/EDIT MODE) ─── */}
      {!showForm && !readOnly && (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseView}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 shadow-xs"
            >
              <LogOut size={15} className="text-slate-500" />
              <span>Close</span>
            </button>

            <button
              type="button"
              onClick={handleSaveProgress}
              disabled={isSaving || safeRows.length === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all border shadow-xs active:scale-95 ${
                isSaving || safeRows.length === 0
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Save size={15} />
              <span>{isSaving ? "Saving..." : "Save Progress"}</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitOrUpdateDeliveries}
              disabled={safeRows.length === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 text-white ${
                safeRows.length === 0
                  ? "bg-emerald-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {hasBeenSubmitted ? <RefreshCw size={15} /> : <Send size={15} />}
              <span>{hasBeenSubmitted ? "Update Deliveries" : "Submit Deliveries"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        type={confirmation.type}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel || (() => setConfirmation((prev) => ({ ...prev, isOpen: false })))}
      />
    </div>
  );
}