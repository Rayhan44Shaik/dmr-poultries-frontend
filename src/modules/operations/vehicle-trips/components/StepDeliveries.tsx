import React, { useState, useMemo } from "react";
import { CheckCircle, Pencil, X, Lock } from "lucide-react";
import UnLoadingTable from "./UnLoadingTable";
import TripTotals from "./TripTotals";
import type { ShopDelivery, Trip } from "../types/trip";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  trip: Trip;
  updateDeliveries: (rows: ShopDelivery[], persistToStorage?: boolean) => void;
  submitDeliveriesStep: () => boolean;
  clearForm: () => void;
  readOnly?: boolean;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
}

export default function StepDeliveries({
  rows,
  setRows,
  shops,
  birdTypes,
  trip,
  updateDeliveries,
  submitDeliveriesStep,
  clearForm,
  readOnly = false,
  editable = false,
  canEdit = false,
  onCancel,
}: Props) {
  const { showNotification } = useSafeNotification(); 
  const [isLocalEditing, setIsLocalEditing] = useState(false);

  const isReadOnly = readOnly || !editable;

  const handleSaveRow = (updatedRow: ShopDelivery) => {
    const rowIndex = rows.findIndex((r) => r.id === updatedRow.id);
    if (rowIndex === -1) return;
    const updatedRows = [...rows];
    updatedRows[rowIndex] = updatedRow;
    setRows(updatedRows);
    updateDeliveries(updatedRows, true);
    showNotification?.(`✅ Shop "${updatedRow.shopName}" saved successfully.`, "success");
  };

  // 🔹 LIVE VALIDATION ENGINE (Disables the Lock button until ALL matches)
  const canLock = useMemo(() => {
    if (rows.length === 0) return false;
    if (trip.dcWeight <= 0) return false;
    if (!trip.destMeter || trip.destMeter <= trip.openingMeter) return false;

    const totalMortalityCount = rows.reduce((sum, r) => sum + (r.mortality || 0), 0);
    const totalDelBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const totalDelWeight = rows.reduce((sum, r) => sum + (r.weight || 0), 0);
    const mortalityWeight = totalMortalityCount * (trip.avgWeight || 0);
    const totalOutWeight = totalDelWeight + mortalityWeight;

    // Validation 1: Pickup Birds must equal Delivered Birds + Mortality Birds
    if (trip.totalBirds !== (totalDelBirds + totalMortalityCount)) return false;

    // Validation 2: DC Weight must be greater than or equal to (Delivered Weight + Mortality Weight)
    if (totalOutWeight > trip.dcWeight) return false;

    return true;
  }, [rows, trip.dcWeight, trip.totalBirds, trip.avgWeight, trip.destMeter, trip.openingMeter]);

  const handleLockDeliveries = () => {
    // Double-check guard
    if (!canLock) {
      showNotification?.("❌ Validation checks failed. Please fix all mismatches before locking.", "error");
      return;
    }
    updateDeliveries(rows, true);
    submitDeliveriesStep();
  };

  // LOCKED VIEW
  if (trip.deliveryStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-blue-50/30 border-2 border-blue-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200 pb-3">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">SHOP DELIVERIES</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setIsLocalEditing(true)} className="bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-blue-200 text-blue-600 shadow-sm transition-all active:scale-95" title="Edit Step">
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300 shadow-sm flex items-center gap-1.5">
              <Lock size={12} /> Locked
            </span>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
           <p className="text-sm text-slate-500 text-center">Deliveries are locked. Click the edit icon to modify.</p>
        </div>
      </div>
    );
  }

  // EDIT STATE
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">SHOP DELIVERIES</h2>
          </div>
          {((editable && trip.deliveryStepSubmitted) || isLocalEditing) && <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-200">✏️ Editable View</span>}
        </div>

        <UnLoadingTable 
          rows={rows} 
          setRows={setRows} 
          shops={shops} 
          birdTypes={birdTypes} 
          readOnly={isReadOnly} 
          onSaveRow={handleSaveRow} 
        />
        
        <TripTotals rows={rows} />

        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 mt-6">
          {!trip.deliveryStepSubmitted && !editable && clearForm && (
            <button onClick={clearForm} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95">
              Clear Form
            </button>
          )}
          
          {(editable || isLocalEditing) && (
            <button onClick={() => {
              if (editable && onCancel) onCancel();
              else setIsLocalEditing(false);
            }} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95 flex items-center gap-2">
              <X size={15} /> Close
            </button>
          )}

          {/* 🔹 LOCK BUTTON: Disabled until canLock is true */}
          {!isReadOnly && (
            <button 
              onClick={handleLockDeliveries} 
              disabled={!canLock}
              className={`px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5 ${
                canLock 
                  ? "bg-blue-700 hover:bg-blue-800 shadow-blue-200" 
                  : "bg-blue-400/60 cursor-not-allowed shadow-none"
              }`}
            >
              <CheckCircle size={15} />
              Complete & Lock Deliveries
            </button>
          )}
        </div>
      </div>
    </div>
  );
}