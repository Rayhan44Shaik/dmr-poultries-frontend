import React, { useState, useMemo } from "react";
import { CheckCircle, Pencil, X, Lock } from "lucide-react";
import UnLoadingTable from "./Step_4";
import type { ShopDelivery, Trip, BoxDetail } from "../types/trip";
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
  boxDetails?: BoxDetail[];
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
  boxDetails = [],
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

  // ─── Lock validation ────────────────────────────────────────────────
  const canLock = useMemo(() => {
    if (rows.length === 0) return false;
    if (trip.dcWeight <= 0) return false;
    if (!trip.destMeter || trip.destMeter <= trip.openingMeter) return false;

    const totalMortalityCount = rows.reduce((sum, r) => sum + (r.mortality || 0), 0);
    const totalDelBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const totalDelWeight = rows.reduce((sum, r) => sum + (r.weight || 0), 0);

    const avgWeight = trip.totalBirds > 0 ? trip.dcWeight / trip.totalBirds : 0;
    const mortalityWeight = totalMortalityCount * avgWeight;
    const totalOutWeight = totalDelWeight + mortalityWeight;

    if (trip.totalBirds !== totalDelBirds + totalMortalityCount) return false;
    if (totalOutWeight > trip.dcWeight) return false;

    return true;
  }, [rows, trip]);

  const handleLockDeliveries = () => {
    if (!canLock) {
      showNotification?.("❌ Validation checks failed. Please fix all mismatches before locking.", "error");
      return;
    }
    updateDeliveries(rows, true);
    submitDeliveriesStep();
  };

  // ─── LOCKED VIEW ────────────────────────────────────────────────────
  if (trip.deliveryStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              4
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              SHOP DELIVERIES
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title="Edit Step"
              >
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
              <Lock size={12} className="text-slate-500" /> Submitted & Locked
            </span>
          </div>
        </div>

        <UnLoadingTable
          rows={rows}
          setRows={setRows}
          shops={shops}
          birdTypes={birdTypes}
          boxDetails={boxDetails}
          readOnly={true}
          onSaveRow={handleSaveRow}
          tripNo={trip.tripNo}
          vehicleNo={trip.vehicleNo}
          supervisorName={trip.supervisorName}
          supervisorPhone=""
          tripDate={trip.tripDate}
        />

        <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 mt-2">
          Shop delivery details locked. Click the edit icon to modify.
        </p>
      </div>
    );
  }

  // ─── EDIT / ACTIVE STATE ────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
            4
          </span>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            SHOP DELIVERIES
          </h2>
        </div>
        {((editable && trip.deliveryStepSubmitted) || isLocalEditing) && (
          <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
            Editable View
          </span>
        )}
      </div>

      {/* Table Section */}
      <UnLoadingTable
        rows={rows}
        setRows={setRows}
        shops={shops}
        birdTypes={birdTypes}
        boxDetails={boxDetails}
        readOnly={isReadOnly}
        onSaveRow={handleSaveRow}
        tripNo={trip.tripNo}
        vehicleNo={trip.vehicleNo}
        supervisorName={trip.supervisorName}
        supervisorPhone=""
        tripDate={trip.tripDate}
      />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
        {!trip.deliveryStepSubmitted && !editable && clearForm && (
          <button
            type="button"
            onClick={clearForm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
          >
            Clear Form
          </button>
        )}

        {(editable || isLocalEditing) && (
          <button
            type="button"
            onClick={() => {
              if (editable && onCancel) onCancel();
              else setIsLocalEditing(false);
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Cancel
          </button>
        )}

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleLockDeliveries}
            disabled={!canLock}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
              canLock
                ? "bg-blue-600 hover:bg-blue-700 shadow-sm"
                : "bg-blue-400 cursor-not-allowed"
            }`}
          >
            <CheckCircle size={14} /> Complete & Lock Deliveries
          </button>
        )}
      </div>
    </div>
  );
}