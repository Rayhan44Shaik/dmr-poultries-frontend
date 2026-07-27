import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Lock, Scale, Bird, Box, Gauge, Clock, Pencil, X, CheckCircle,
  Plus, Trash2, Save, FileText, Loader2, AlertTriangle, Check
} from "lucide-react";
import type { Trip, BoxDetail } from "../types/trip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  updateBoxDetails: (rows: BoxDetail[], persistToStorage?: boolean) => void;
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
  const borderColor = type === "warning" ? "border-amber-200" : "border-blue-200";
  const bgGradient = type === "warning"
    ? "from-amber-50 to-orange-50"
    : "from-blue-50 to-indigo-50";

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
                : "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
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

  const bgColor = type === "success" ? "bg-emerald-500" : "bg-red-500";
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

  // ─── Auto‑save ──────────────────────────────────────────────────────
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
        updateBoxDetails(boxDetails, true);
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

  // ─── Manual Save (Save Progress) ────────────────────────────────────
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
    updateBoxDetails(boxDetails, true);
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

  const canSubmit = rows.length > 0 && totals.totalBirds > 0 && totals.dcWeight > 0;

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
      <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 border-2 border-slate-700 rounded-2xl p-4 shadow-lg shadow-slate-500/30 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200 pb-2">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shadow-md">3</span>
            <h2 className="text-xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">PICKUP KPI</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setIsLocalEditing(true)} className="bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-blue-200 text-blue-600 shadow-sm">
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold border border-slate-300 flex items-center gap-1">
              <Lock size={12} /> Locked
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
            <p className="text-[10px] text-slate-500 font-medium">Time</p>
            <p className="font-bold text-slate-800 text-sm">{trip.pickupLoadTime || "--"}</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
            <p className="text-[10px] text-slate-500 font-medium">DC Wt</p>
            <p className="font-bold text-slate-800 text-sm">{trip.dcWeight.toFixed(2)} Kg</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
            <p className="text-[10px] text-slate-500 font-medium">Birds</p>
            <p className="font-bold text-slate-800 text-sm">{trip.totalBirds}</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
            <p className="text-[10px] text-slate-500 font-medium">Boxes</p>
            <p className="font-bold text-slate-800 text-sm">{trip.boxes}</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100 col-span-2 md:col-span-4">
            <p className="text-[10px] text-slate-500 font-medium">Avg Wt</p>
            <p className="font-bold text-slate-800 text-sm">{trip.avgWeight || 0} Kg</p>
          </div>
        </div>

        {trip.boxDetails && trip.boxDetails.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto max-h-96 overflow-y-auto">
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
                <tr className="bg-white text-slate-800 text-[10px] uppercase sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((i, idx) => (
                    <React.Fragment key={i}>
                      <th className={`text-center px-3 py-2 font-bold bg-white text-slate-800 border-r border-slate-200 ${idx > 0 ? 'pl-5' : ''}`}>BOX</th>
                      <th className="text-center px-3 py-2 font-bold bg-white text-slate-800 border-r border-slate-200">BIRDS</th>
                      <th className={`text-center px-3 py-2 font-bold bg-white text-slate-800 ${idx < 2 ? 'border-r-2 border-green-500 pr-5' : ''}`}>
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
                        <td className={`text-center px-3 py-2 font-semibold bg-white text-slate-800 border-r border-slate-200 ${colIdx > 0 ? 'pl-5' : ''}`}>{r.boxNo}</td>
                        <td className="text-center px-3 py-2 font-bold text-slate-800 bg-white border-r border-slate-200">{r.birds}</td>
                        <td className={`text-center px-3 py-2 font-semibold text-slate-800 bg-white ${colIdx < 2 ? 'border-r-2 border-green-500 pr-5' : ''}`}>
                          {r.weight.toFixed(2)}
                        </td>
                      </React.Fragment>
                    ))}
                    {group.length < 3 &&
                      Array.from({ length: 3 - group.length }).map((_, i) => {
                        const emptyIdx = group.length + i;
                        return (
                          <React.Fragment key={i}>
                            <td className={`text-center px-3 py-2 text-slate-300 bg-white border-r border-slate-200 ${emptyIdx > 0 ? 'pl-5' : ''}`}>—</td>
                            <td className="text-center px-3 py-2 text-slate-300 bg-white border-r border-slate-200">—</td>
                            <td className={`text-center px-3 py-2 text-slate-300 bg-white ${emptyIdx < 2 ? 'border-r-2 border-green-500 pr-5' : ''}`}>
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">✅ Submitted</p>
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white text-sm font-bold rounded-lg shadow-md transition-all active:scale-95"
          >
            <FileText size={16} />
            Download PDF
          </button>
        </div>
      </div>
    );
  }

  // ─── EDIT / ENTRY ──────────────────────────────────────────────────────
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
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
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
          color: #3b82f6;
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

      <div className="bg-white border border-slate-200/80 shadow-md rounded-xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shadow-md">3</span>
            <h2 className="text-xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">PICKUP KPI</h2>
          </div>
          <div className="flex items-center gap-3">
            {isAutoSaving && (
              <span className="auto-save-indicator">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            )}
            {(isEditMode || isLocalEditing) && trip.pickupStepSubmitted && (
              <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">✏️ Edit</span>
            )}
          </div>
        </div>

        {/* Auto time */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock size={14} className="text-slate-400" />
          <span className="font-medium">{trip.pickupLoadTime || "Auto time on submit"}</span>
        </div>

        {/* Entry Table Container */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
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

          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm max-h-80 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                {/* Block 1 */}
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                {/* Block 2 */}
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                {/* Block 3 */}
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
              </colgroup>
              <thead>
                <tr className="bg-white text-slate-700 text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((blockIdx) => (
                    <React.Fragment key={blockIdx}>
                      <th className={`text-center px-1 py-2 font-bold text-slate-700 bg-white border-r border-slate-200 ${blockIdx > 1 ? 'pl-5' : ''}`}>BOX</th>
                      <th className="text-center px-1 py-2 font-bold text-slate-700 bg-white border-r border-slate-200">BIRDS</th>
                      <th className={`px-1 py-2 font-bold text-slate-700 bg-white ${blockIdx < 3 ? 'border-r-2 border-green-500 pr-5' : ''}`}>
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
                        <td className={`px-1 py-1.5 bg-white ${groupIdx < 2 ? 'border-r-2 border-green-500 pr-5' : ''}`}>
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
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-xs bg-white ${emptyIdx < 2 ? 'border-r-2 border-green-500 pr-5' : ''}`}>
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

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">Boxes</p>
            <p className="font-bold text-slate-800 text-sm">{totals.boxes}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">Birds</p>
            <p className="font-bold text-slate-800 text-sm">{totals.totalBirds}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">DC Wt</p>
            <p className="font-bold text-slate-800 text-sm">{totals.dcWeight.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
            <p className="text-[10px] text-slate-500 font-medium">Avg Wt</p>
            <p className="font-bold text-slate-800 text-sm">
              {totals.avgWeight > 0 ? totals.avgWeight : "—"}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-200">
          {/* Close */}
          {isEditMode && (
            <button
              onClick={handleClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
            >
              <X size={14} /> Close
            </button>
          )}

          {/* Save Progress */}
          {(!trip.pickupStepSubmitted || isEditMode) && (
            <button
              onClick={handleSaveProgress}
              disabled={isSaving || isSavingRef.current || rows.length === 0}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                isSaving || isSavingRef.current || rows.length === 0
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50 shadow-sm"
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
              className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 shadow-sm"
            >
              Clear
            </button>
          )}

          {/* Update / Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit || (trip.pickupStepSubmitted && !isEditMode)}
            className={`px-5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5 ${
              isSubmitting || !canSubmit || (trip.pickupStepSubmitted && !isEditMode)
                ? "bg-blue-400/60 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-200"
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