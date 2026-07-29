import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Lock, Scale, Bird, Box, Gauge, Clock, Pencil, X, CheckCircle,
  Plus, Trash2, Save, FileText, Loader2, AlertTriangle, Check, Camera, Download
} from "lucide-react";
import type { Trip, BoxDetail } from "../types/trip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import localforage from "localforage";

// Configure localforage
localforage.config({
  name: "DMRPoultry",
  storeName: "dc_photos",
  description: "DC Photo storage",
});

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  updateBoxDetails: (rows: BoxDetail[], persistToStorage?: boolean, silent?: boolean) => void;
  submitPickupStep: (data: Partial<Trip>) => boolean;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
}

type Row = BoxDetail & { uid: string };
const generateUid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
const makeRow = (boxNo: number): Row => ({
  uid: generateUid(),
  boxNo,
  birds: 0,
  weight: 0,
});

// ─── Confirmation Modal ──────────────────────────────────────────────
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "warning" | "info";
}

function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Yes, Proceed",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  type = "warning",
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const iconColor = type === "warning" ? "text-amber-600" : "text-blue-600";
  const borderColor = type === "warning" ? "border-amber-200" : "border-slate-200";
  const bgGradient = type === "warning"
    ? "from-amber-50 to-orange-50"
    : "from-blue-50 to-slate-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border ${borderColor}`}>
        <div className={`bg-gradient-to-br ${bgGradient} p-6`}>
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 p-2 rounded-full bg-white/60 border ${borderColor}`}>
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
            className="px-5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all hover:shadow-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${
              type === "warning"
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast notification ──────────────────────────────────────────────
function Toast({ message, type = "success", onClose }: { message: string; type?: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-slate-800" : "bg-red-500";
  const icon = type === "success" ? <Check size={18} className="text-white" /> : <AlertTriangle size={18} className="text-white" />;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`${bgColor} text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 border border-white/20`}>
        {icon}
        <span className="font-medium text-sm">{message}</span>
      </div>
    </div>
  );
}

export default function StepPickup({
  trip,
  setTrip,
  updateTrip,
  updateBoxDetails,
  submitPickupStep,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => {
    const details = trip.boxDetails || [];
    return details.length > 0 ? details.map((d) => ({ ...d, uid: generateUid() })) : [makeRow(1)];
  });

  // ─── Image upload state ────────────────────────────────────────────
  const [imageKey, setImageKey] = useState<string | null>(trip.dcPhotoKey || null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Toast state ────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ─── Confirmation state ─────────────────────────────────────────────
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

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const isSavingRef = useRef(false);

  const hasUnsavedChanges = useMemo(() => {
    const currentBoxes = rows.map(({ uid, ...rest }) => rest);
    const savedBoxes = trip.boxDetails || [];
    return JSON.stringify(currentBoxes) !== JSON.stringify(savedBoxes);
  }, [rows, trip.boxDetails]);

  // ─── Load image from IndexedDB when key changes ────────────────────
  useEffect(() => {
    const loadImage = async () => {
      if (!imageKey) {
        setImagePreview(null);
        return;
      }
      try {
        setIsImageLoading(true);
        const blob = await localforage.getItem<Blob>(imageKey);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setImagePreview(url);
        } else {
          setImagePreview(null);
        }
      } catch (error) {
        console.error("Failed to load image:", error);
        setImagePreview(null);
      } finally {
        setIsImageLoading(false);
      }
    };
    loadImage();
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imageKey]);

  // ─── Sync imageKey with trip.dcPhotoKey ────────────────────────────
  useEffect(() => {
    if (trip.dcPhotoKey !== imageKey) {
      setImageKey(trip.dcPhotoKey || null);
    }
  }, [trip.dcPhotoKey]);

  useEffect(() => {
    const details = trip.boxDetails || [];
    if (details.length > 0) {
      setRows(details.map((d) => ({ ...d, uid: generateUid() })));
    } else {
      setRows([makeRow(1)]);
    }
  }, [trip.id, isLocalEditing]);

  const totals = useMemo(() => {
    const totalBirds = rows.reduce((s, r) => s + (r.birds || 0), 0);
    const dcWeight = Number(rows.reduce((s, r) => s + (r.weight || 0), 0).toFixed(2));
    const boxes = rows.length;
    const avgWeight = dcWeight > 0 && totalBirds > 0 ? Number((dcWeight / totalBirds).toFixed(3)) : 0;
    return { totalBirds, dcWeight, boxes, avgWeight };
  }, [rows]);

  // ─── Auto‑save (silent) ────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    if (isSavingRef.current || trip.pickupStepSubmitted) {
      setIsAutoSaving(false);
      return;
    }
    setIsAutoSaving(true);
    autoSaveTimeout.current = setTimeout(() => {
      if (!isSavingRef.current && !trip.pickupStepSubmitted) {
        const boxDetails = rows.map(({ uid, ...rest }) => rest);
        updateBoxDetails(boxDetails, true, true);
      }
      setIsAutoSaving(false);
      autoSaveTimeout.current = null;
    }, 800);
  }, [rows, updateBoxDetails, trip.pickupStepSubmitted]);

  useEffect(() => {
    if (!isSubmitting && !trip.pickupStepSubmitted) {
      triggerAutoSave();
    }
    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [rows, triggerAutoSave, isSubmitting, trip.pickupStepSubmitted]);

  // ─── Row operations ─────────────────────────────────────────────────
  const addRow = () => {
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (lastRow.birds === 0 || lastRow.weight === 0) {
        setToast({
          message: "Please fill the current box (Birds & Weight) before adding a new one.",
          type: "error",
        });
        return;
      }
    }
    setRows((prev) => [...prev, makeRow(prev.length + 1)]);
  };

  const removeRow = (uid: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.uid !== uid);
      return next.map((r, idx) => ({ ...r, boxNo: idx + 1 }));
    });
  };
  const updateRow = (uid: string, field: "birds" | "weight", value: number) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, [field]: value } : r)));
  };
  const blockScrollAndArrows = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };
  const getBoxDetails = (): BoxDetail[] => rows.map(({ uid, ...rest }) => rest);

  const isLastRowComplete = useMemo(() => {
    if (rows.length === 0) return true;
    const lastRow = rows[rows.length - 1];
    return lastRow.birds > 0 && lastRow.weight > 0;
  }, [rows]);

  // ─── Image upload handlers ──────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({ message: "Please select a valid image file.", type: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: "Image size must be less than 5MB.", type: "error" });
      return;
    }

    try {
      const key = `dc_photo_${trip.id || Date.now()}_${Date.now()}`;
      await localforage.setItem(key, file);
      setImageKey(key);
      updateTrip({ dcPhotoKey: key });
      setToast({ message: "Image uploaded successfully!", type: "success" });
    } catch (error) {
      console.error("Failed to upload image:", error);
      setToast({ message: "Failed to upload image. Please try again.", type: "error" });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = async () => {
    if (imageKey) {
      try {
        await localforage.removeItem(imageKey);
        setImageKey(null);
        updateTrip({ dcPhotoKey: undefined });
        setImagePreview(null);
        setToast({ message: "Image removed.", type: "success" });
      } catch (error) {
        console.error("Failed to remove image:", error);
        setToast({ message: "Failed to remove image.", type: "error" });
      }
    }
  };

  // ─── Download Image ──────────────────────────────────────────────────
  const downloadImage = async () => {
    if (!imageKey) return;
    try {
      const blob = await localforage.getItem<Blob>(imageKey);
      if (!blob) {
        setToast({ message: "Image not found.", type: "error" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DC_Photo_${trip.tripNo || "trip"}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
      setToast({ message: "Failed to download image.", type: "error" });
    }
  };

  // ─── Manual Save ────────────────────────────────────────────────
  const handleSaveProgress = () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = null;
      setIsAutoSaving(false);
    }
    const boxDetails = rows.map(({ uid, ...rest }) => rest);
    updateBoxDetails(boxDetails, true, true);
    setIsSaving(false);
    setTimeout(() => {
      isSavingRef.current = false;
    }, 100);
    setToast({ message: "Progress saved successfully!", type: "success" });
  };

  // ─── Close with unsaved check ──────────────────────────────────────
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setConfirmation({
        isOpen: true,
        title: "Unsaved Changes",
        message: "You have unsaved changes. Would you like to save them before closing?",
        confirmLabel: "Save & Close",
        cancelLabel: "Discard",
        type: "warning",
        onConfirm: () => {
          handleSaveProgress();
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          setTimeout(() => {
            if (editable && onCancel) onCancel();
            else setIsLocalEditing(false);
          }, 200);
        },
        onCancel: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          if (editable && onCancel) onCancel();
          else setIsLocalEditing(false);
        },
      });
    } else {
      if (editable && onCancel) onCancel();
      else setIsLocalEditing(false);
    }
  };

  // ─── Submit / Update with confirmation ─────────────────────────────
  const handleSubmit = () => {
    if (rows.length === 0) return;
    if (isSubmitting) return;
    if (trip.pickupStepSubmitted && !editable && !isLocalEditing) return;

    if (!imageKey) {
      setToast({ message: "Please upload a DC photo before submitting.", type: "error" });
      return;
    }

    const isEditMode = editable || isLocalEditing;
    const title = isEditMode ? "Update Pickup KPI" : "Submit Pickup KPI";
    const message = isEditMode
      ? "Are you sure you want to update this pickup KPI? Changes will be saved and the step will remain unlocked for further edits."
      : "Are you sure you want to submit this pickup KPI? You won't be able to edit it unless you have admin permissions.";

    setConfirmation({
      isOpen: true,
      title,
      message,
      confirmLabel: isEditMode ? "Yes, Update" : "Yes, Submit",
      cancelLabel: "Cancel",
      type: isEditMode ? "info" : "warning",
      onConfirm: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        if (autoSaveTimeout.current) {
          clearTimeout(autoSaveTimeout.current);
          autoSaveTimeout.current = null;
          setIsAutoSaving(false);
        }
        const success = submitPickupStep({
          boxDetails: getBoxDetails(),
          totalBirds: totals.totalBirds,
          dcWeight: totals.dcWeight,
          boxes: totals.boxes,
          avgWeight: totals.avgWeight,
        });
        if (success) {
          setIsLocalEditing(false);
          setToast({ message: "Pickup KPI updated successfully!", type: "success" });
        }
        setIsSubmitting(false);
      },
      onCancel: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const canSubmit = rows.length > 0 && totals.totalBirds > 0 && totals.dcWeight > 0 && imageKey !== null;

  // ─── PDF Generation ─────────────────────────────────────────────────
  const generatePDF = () => {
    if (!trip.pickupStepSubmitted) return;
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const primaryColor: [number, number, number] = [37, 99, 235];
      const secondaryColor: [number, number, number] = [71, 85, 105];

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 6, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text('DMR POULTRY', 14, 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Trip Pickup KPI Report', 14, 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('TRIP #:', pageWidth - 14, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(trip.tripNo || 'N/A', pageWidth - 14, 25, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 34, pageWidth - 14, 34);

      const details = [
        ['Generation Date', trip.tripDate || 'N/A'],
        ['Farm', trip.sourceFarm || 'N/A'],
        ['Vehicle', trip.vehicleNo || 'N/A'],
        ['Driver', trip.driverName || 'N/A'],
        ['Supervisor', trip.supervisorName || 'N/A'],
      ];
      let y = 42;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      details.forEach(([label, value]) => {
        doc.text(label + ':', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 70, y);
        y += 7;
        doc.setFont('helvetica', 'bold');
      });

      const boxData = trip.boxDetails || [];
      const tableRows = boxData.map((r) => [r.boxNo, r.birds, r.weight.toFixed(2)]);

      autoTable(doc, {
        startY: y + 6,
        head: [['Box #', 'Birds', 'Weight (Kg)']],
        body: tableRows.length > 0 ? tableRows : [['—', '—', '—']],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        foot: tableRows.length > 0
          ? [[
              { content: 'Total', colSpan: 1, styles: { fontStyle: 'bold' } },
              { content: totals.totalBirds.toString(), styles: { fontStyle: 'bold' } },
              { content: totals.dcWeight.toFixed(2), styles: { fontStyle: 'bold' } },
            ]]
          : undefined,
      });

      const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('SUMMARY', 14, finalY + 10);

      const summaryData = [
        ['Total DC Weight', totals.dcWeight.toFixed(2) + ' Kg'],
        ['Total Birds', totals.totalBirds],
        ['Loaded Boxes', totals.boxes],
        ['Average Weight', totals.avgWeight > 0 ? totals.avgWeight + ' Kg' : '—'],
      ];
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let sumY = finalY + 18;
      summaryData.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label + ':', 14, sumY);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 70, sumY);
        sumY += 7;
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setDrawColor(241, 245, 249);
      doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
      doc.text('Confidential Business Report • Generated Automatically', 14, pageHeight - 10);
      doc.text(`Page 1 of 1`, pageWidth - 14, pageHeight - 10, { align: 'right' });

      doc.save(`Trip_${trip.tripNo || 'report'}_PickupKPI.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // ─── LOCKED VIEW ───────────────────────────────────────────────────
  if (trip.pickupStepSubmitted && !editable && !isLocalEditing) {
    const grouped = trip.boxDetails?.reduce((acc: BoxDetail[][], _, i, arr) => {
      if (i % 3 === 0) acc.push(arr.slice(i, i + 3));
      return acc;
    }, []) || [];

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        {/* Header Matching StepFarm Exact Styling */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              3
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              PICKUP KPI
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title="Edit Pickup KPI"
              >
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              Submitted & Locked
            </span>
          </div>
        </div>

        {/* 5 Column Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 pt-2">
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Time</p>
            <p className="font-semibold text-slate-900 mt-0.5 truncate">{trip.pickupLoadTime || "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">DC Wt</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.dcWeight.toFixed(2)} Kg</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Birds</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.totalBirds}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Boxes</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.boxes}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Avg Wt</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.avgWeight || 0} Kg</p>
          </div>
        </div>

        {/* DC Photo Status Card */}
        {imageKey && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-medium text-slate-700">
            <Camera size={16} className="text-slate-400" />
            <span>DC Photo uploaded</span>
          </div>
        )}

        {/* Box Table */}
        {trip.boxDetails && trip.boxDetails.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[10px] uppercase sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((i, idx) => (
                    <React.Fragment key={i}>
                      <th className={`text-center px-3 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200 ${idx > 0 ? 'pl-5' : ''}`}>BOX</th>
                      <th className="text-center px-3 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200">BIRDS</th>
                      <th className={`text-center px-3 py-2 font-bold bg-slate-50 text-slate-600 ${idx < 2 ? 'border-r-2 border-slate-300 pr-5' : ''}`}>
                        WT(KG)
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {grouped.map((group, idx) => (
                  <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                    {group.map((r, colIdx) => (
                      <React.Fragment key={r.boxNo}>
                        <td className={`text-center px-3 py-2 font-semibold text-slate-800 border-r border-slate-200 ${colIdx > 0 ? 'pl-5' : ''}`}>{r.boxNo}</td>
                        <td className="text-center px-3 py-2 font-bold text-slate-800 border-r border-slate-200">{r.birds}</td>
                        <td className={`text-center px-3 py-2 font-semibold text-slate-800 ${colIdx < 2 ? 'border-r-2 border-slate-300 pr-5' : ''}`}>
                          {r.weight.toFixed(2)}
                        </td>
                      </React.Fragment>
                    ))}
                    {group.length < 3 &&
                      Array.from({ length: 3 - group.length }).map((_, i) => {
                        const emptyIdx = group.length + i;
                        return (
                          <React.Fragment key={i}>
                            <td className={`text-center px-3 py-2 text-slate-300 border-r border-slate-200 ${emptyIdx > 0 ? 'pl-5' : ''}`}>—</td>
                            <td className="text-center px-3 py-2 text-slate-300 border-r border-slate-200">—</td>
                            <td className={`text-center px-3 py-2 text-slate-300 ${emptyIdx < 2 ? 'border-r-2 border-slate-300 pr-5' : ''}`}>
                              —
                            </td>
                          </React.Fragment>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Banner with Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-slate-600 font-normal">
            Pickup KPI details submitted successfully.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {imageKey && (
              <button
                onClick={downloadImage}
                className="flex items-center justify-center p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-all active:scale-95"
                title="Download Image"
              >
                <Download size={16} />
              </button>
            )}
            <button
              onClick={generatePDF}
              className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-all active:scale-95"
              title="Download PDF"
            >
              <FileText size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDIT / ENTRY VIEW ──────────────────────────────────────────────────
  const groupedRows = rows.reduce((acc: Row[][], _, i, arr) => {
    if (i % 3 === 0) acc.push(arr.slice(i, i + 3));
    return acc;
  }, []);

  const isEditMode = editable || isLocalEditing;

  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-spinner {
          -moz-appearance: textfield;
          appearance: none;
        }
        .mini-input {
          height: 28px;
          padding: 0 4px;
          font-size: 0.8rem;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          text-align: center;
          width: 100%;
          min-width: 0;
          transition: all 0.15s;
          color: #2563eb;
          font-weight: 700;
        }
        .mini-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .mini-input:focus {
          background: white;
          border-color: #2563eb;
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
        }
        .mini-input:hover {
          border-color: #93c5fd;
        }
        .mini-delete {
          padding: 2px;
          border-radius: 4px;
          border: 1px solid transparent;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
        }
        .mini-delete:hover:not(:disabled) {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fecaca;
        }
        .mini-delete:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .auto-save-indicator {
          font-size: 0.65rem;
          color: #2563eb;
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

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              3
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              PICKUP KPI
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {isAutoSaving && (
              <span className="auto-save-indicator">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            )}
            {(isEditMode || isLocalEditing) && trip.pickupStepSubmitted && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                Editable View
              </span>
            )}
          </div>
        </div>

        {/* Auto time */}
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <Clock size={14} className="text-slate-400" />
          <span>{trip.pickupLoadTime || "Auto time on submit"}</span>
        </div>

        {/* Image Upload Section */}
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Camera size={14} className="text-slate-400" />
                DC Photo <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all shadow-xs"
                >
                  Choose Image
                </button>
                {imageKey && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-all"
                  >
                    Remove
                  </button>
                )}
                <span className="text-xs text-slate-500">
                  {imageKey ? "✅ Uploaded" : "No image selected"}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-[10px] text-slate-400 mt-1">Max 5MB, JPG/PNG</p>
            </div>
            {imagePreview && (
              <div className="flex-shrink-0">
                <img src={imagePreview} alt="DC Preview" className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
              </div>
            )}
          </div>
        </div>

        {/* Entry Table Container */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">Box entries (three per row)</span>
            <button
              type="button"
              onClick={addRow}
              disabled={!isLastRowComplete}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg border transition-all active:scale-95 ${
                isLastRowComplete
                  ? "text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200"
                  : "text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed"
              }`}
              title={isLastRowComplete ? "Add a new box" : "Fill the current box first"}
            >
              <Plus size={14} /> Add Box
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-80 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((blockIdx) => (
                    <React.Fragment key={blockIdx}>
                      <th className={`text-center px-1 py-2 font-bold text-slate-600 bg-slate-50 border-r border-slate-200 ${blockIdx > 1 ? 'pl-5' : ''}`}>BOX</th>
                      <th className="text-center px-1 py-2 font-bold text-slate-600 bg-slate-50 border-r border-slate-200">BIRDS</th>
                      <th className={`px-1 py-2 font-bold text-slate-600 bg-slate-50 ${blockIdx < 3 ? 'border-r-2 border-slate-300 pr-5' : ''}`}>
                        <div className="flex items-center justify-center">
                          <span className="text-center">WT(KG)</span>
                          <div className="w-[22px] shrink-0" />
                        </div>
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {groupedRows.map((group, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors bg-white">
                    {group.map((row, groupIdx) => (
                      <React.Fragment key={row.uid}>
                        <td className={`text-center px-1 py-1.5 font-bold text-slate-700 text-xs bg-white border-r border-slate-200 ${groupIdx > 0 ? 'pl-5' : ''}`}>{row.boxNo}</td>
                        <td className="px-1 py-1.5 bg-white border-r border-slate-200">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={row.birds || ""}
                            onChange={(e) => updateRow(row.uid, "birds", parseInt(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            onKeyDown={blockScrollAndArrows}
                            placeholder="0"
                            className="mini-input hide-spinner"
                          />
                        </td>
                        <td className={`px-1 py-1.5 bg-white ${groupIdx < 2 ? 'border-r-2 border-slate-300 pr-5' : ''}`}>
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.weight || ""}
                              onChange={(e) => updateRow(row.uid, "weight", parseFloat(e.target.value) || 0)}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={blockScrollAndArrows}
                              placeholder="0.00"
                              className="mini-input hide-spinner"
                            />
                            <button
                              type="button"
                              onClick={() => removeRow(row.uid)}
                              disabled={rows.length === 1}
                              className="mini-delete shrink-0"
                              title="Delete box"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </React.Fragment>
                    ))}
                    {group.length < 3 &&
                      Array.from({ length: 3 - group.length }).map((_, i) => {
                        const emptyIdx = group.length + i;
                        return (
                          <React.Fragment key={i}>
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-xs bg-white border-r border-slate-200 ${emptyIdx > 0 ? 'pl-5' : ''}`}>—</td>
                            <td className="text-center px-1 py-1.5 text-slate-300 text-xs bg-white border-r border-slate-200">—</td>
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-xs bg-white ${emptyIdx < 2 ? 'border-r-2 border-slate-300 pr-5' : ''}`}>
                              —
                            </td>
                          </React.Fragment>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Use <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[9px] font-semibold">Tab</kbd> to navigate.
            {!isLastRowComplete && rows.length > 0 && (
              <span className="text-amber-600 ml-2">⚠️ Fill the current box before adding another.</span>
            )}
          </p>
        </div>

        {/* Totals Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">Boxes</p>
            <p className="font-semibold text-slate-900 text-sm mt-0.5">{totals.boxes}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">Birds</p>
            <p className="font-semibold text-slate-900 text-sm mt-0.5">{totals.totalBirds}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">DC Wt</p>
            <p className="font-semibold text-slate-900 text-sm mt-0.5">{totals.dcWeight.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">Avg Wt</p>
            <p className="font-semibold text-slate-900 text-sm mt-0.5">
              {totals.avgWeight > 0 ? totals.avgWeight : "—"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
          {/* Close */}
          {isEditMode && (
            <button
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Close
            </button>
          )}

          {/* Save Progress */}
          {(!trip.pickupStepSubmitted || isEditMode) && (
            <button
              onClick={handleSaveProgress}
              disabled={isSaving || isSavingRef.current || rows.length === 0}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                isSaving || isSavingRef.current || rows.length === 0
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              <Save size={14} />
              {isSaving ? "Saving..." : "Save Progress"}
            </button>
          )}

          {/* Clear */}
          {!trip.pickupStepSubmitted && !isEditMode && clearForm && (
            <button
              onClick={clearForm}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
            >
              Clear
            </button>
          )}

          {/* Update / Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit || (trip.pickupStepSubmitted && !isEditMode)}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
              isSubmitting || !canSubmit || (trip.pickupStepSubmitted && !isEditMode)
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-sm"
            }`}
          >
            <CheckCircle size={14} />
            {isSubmitting
              ? "Submitting..."
              : isEditMode
              ? "Update Pickup"
              : trip.pickupStepSubmitted
              ? "Submitted"
              : "Submit Pickup"}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
    </>
  );
}