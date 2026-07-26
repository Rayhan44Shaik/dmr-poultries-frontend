import React, { useState } from "react";
import { CheckCircle, Pencil, X, Lock } from "lucide-react"; // ✅ Added Lock
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
  updateDeliveries: (rows: ShopDelivery[]) => void;
  submitDeliveriesStep: () => boolean;
  clearForm: () => void; // ✅ Required
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

  const handleLockDeliveries = () => {
    if (rows.length === 0) {
      showNotification?.("❌ Please add at least one Shop Delivery before locking.", "error");
      return;
    }
    updateDeliveries(rows);

    const totalMortalityCount = rows.reduce((sum, r) => sum + (r.mortality || 0), 0);
    const totalDelBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const totalDelWeight = rows.reduce((sum, r) => sum + (r.weight || 0), 0);
    const mortalityWeight = totalMortalityCount * (trip.avgWeight || 0);

    if (trip.dcWeight <= 0) {
      showNotification?.("❌ Invalid DC Weight. Please go back to Step 3.", "error");
      return;
    }
    const totalOutWeight = totalDelWeight + mortalityWeight;
    if (totalOutWeight > trip.dcWeight) {
      showNotification?.(`❌ Weight Mismatch: Delivered (${totalDelWeight.toFixed(2)}) + Mortality (${mortalityWeight.toFixed(2)}) = ${totalOutWeight.toFixed(2)} exceeds DC Weight (${trip.dcWeight}).`, "error");
      return;
    }
    if (trip.totalBirds <= 0) {
      showNotification?.("❌ Invalid Total Birds. Please go back to Step 3.", "error");
      return;
    }
    const expectedBirds = totalDelBirds + totalMortalityCount;
    if (trip.totalBirds !== expectedBirds) {
      showNotification?.(`❌ Bird Count Mismatch: Pickup (${trip.totalBirds}) must equal Delivered (${totalDelBirds}) + Mortality (${totalMortalityCount}) = ${expectedBirds}.`, "error");
      return;
    }
    if (!trip.destMeter || trip.destMeter <= trip.openingMeter) {
      showNotification?.("❌ Meter Mismatch: Destination Meter reading is invalid. Please verify Step 2.", "error");
      return;
    }
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
  const deliveryActions = isReadOnly ? null : (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200/60 mt-4 w-full">
      {!trip.deliveryStepSubmitted && !editable && clearForm && (
        <button onClick={clearForm} className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-rose-50 px-5 py-2.5 text-xs font-bold text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-all shadow-sm active:scale-95">
          Clear Form
        </button>
      )}
      <button onClick={handleLockDeliveries} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 transition-all active:scale-95">
        <CheckCircle size={15} />
        Complete & Lock Deliveries
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">SHOP DELIVERIES</h2>
          </div>
          {(editable || isLocalEditing) && <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-200">✏️ Editable View</span>}
        </div>

        <UnLoadingTable rows={rows} setRows={setRows} shops={shops} birdTypes={birdTypes} actions={deliveryActions} readOnly={isReadOnly} />
        <TripTotals rows={rows} />

        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 mt-6">
          {(editable || isLocalEditing) && (
            <button onClick={() => {
              if (editable && onCancel) onCancel();
              else setIsLocalEditing(false);
            }} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95 flex items-center gap-2">
              <X size={15} /> Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}