import React, { useState, useMemo } from "react";
import {
  CheckCircle,
  Pencil,
  X,
  Lock,
  LayoutGrid,
  BarChart3,
} from "lucide-react";
import UnLoadingTable from "./Step_4";
import BoxWeightAnalysis from "./Step_4/BoxWeightAnalysis";
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

  // Toggle state: 'shops' | 'analysis'
  const [viewMode, setViewMode] = useState<"shops" | "analysis">("shops");

  // Step-level edit mode
  const [isStepEditing, setIsStepEditing] = useState(false);

  // Shop-level edit mode
  const [editingShopId, setEditingShopId] = useState<string | number | null>(null);

  // Locked IF step is submitted AND user hasn't toggled "Edit Shop" at step level
  const isLocked = trip.deliveryStepSubmitted && !editable && !isStepEditing;

  // Save shop row
  const handleSaveRow = (updatedRow: ShopDelivery) => {
    const rowIndex = rows.findIndex((r) => r.id === updatedRow.id);
    if (rowIndex === -1) return;

    const updatedRows = [...rows];
    updatedRows[rowIndex] = updatedRow;
    setRows(updatedRows);
    updateDeliveries(updatedRows, true);
    setEditingShopId(null);
    showNotification?.(
      `✅ Shop "${updatedRow.shopName}" saved successfully.`,
      "success"
    );
  };

  const handleStartEditShop = (shopId: string | number) => {
    if (isLocked) return;
    setEditingShopId(shopId);
  };

  const handleCancelShopEdit = () => {
    setEditingShopId(null);
  };

  const handleEnableStepEdit = () => {
    setIsStepEditing(true);
  };

  const handleCancelStepEdit = () => {
    setIsStepEditing(false);
    setEditingShopId(null);
    if (onCancel) onCancel();
  };

  // ─── Lock Validation ────────────────────────────────────────────────
  const validationResult = useMemo(() => {
    if (rows.length === 0)
      return { valid: false, reason: "Please add at least one shop delivery." };
    if ((trip.dcWeight || 0) <= 0)
      return { valid: false, reason: "DC Weight must be greater than 0." };

    const totalMortalityCount = rows.reduce(
      (sum, r) => sum + (r.mortality || 0),
      0
    );
    const totalDelBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const totalDelWeight = rows.reduce((sum, r) => sum + (r.weight || 0), 0);
    const avgWeight = trip.totalBirds > 0 ? trip.dcWeight / trip.totalBirds : 0;

    const explicitMortalityWeight = rows.reduce((sum, r) => {
      const extra = r as ShopDelivery & {
        mortalityWeight?: number;
        mortalityKg?: number;
      };
      return sum + (extra.mortalityWeight ?? extra.mortalityKg ?? 0);
    }, 0);

    const mortalityWeight =
      explicitMortalityWeight > 0
        ? explicitMortalityWeight
        : totalMortalityCount * avgWeight;

    const totalOutWeight = totalDelWeight + mortalityWeight;

    if (trip.totalBirds !== totalDelBirds + totalMortalityCount) {
      return {
        valid: false,
        reason: `Bird count mismatch! Farm (${trip.totalBirds}) != Delivered (${totalDelBirds}) + Mor (${totalMortalityCount})`,
      };
    }

    if (totalOutWeight - trip.dcWeight > 0.05) {
      return {
        valid: false,
        reason: `Total weight (${totalOutWeight.toFixed(
          2
        )} Kg) exceeds DC Weight (${trip.dcWeight.toFixed(2)} Kg)`,
      };
    }

    return { valid: true, reason: "" };
  }, [rows, trip]);

  const canLock = validationResult.valid;

  const handleLockDeliveries = () => {
    if (!canLock) {
      showNotification?.(`❌ ${validationResult.reason}`, "error");
      return;
    }
    setIsStepEditing(false);
    setEditingShopId(null);
    updateDeliveries(rows, true);
    submitDeliveriesStep();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
            4
          </span>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            SHOP DELIVERIES
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* VIEW MODE TOGGLE BUTTONS */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode("shops")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "shops"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={13} /> Shop View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("analysis")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "analysis"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 size={13} /> Box Analysis
            </button>
          </div>

          {/* STEP LEVEL EDIT BUTTON: Only visible when step is locked */}
          {isLocked && canEdit && rows.length > 0 && (
            <button
              type="button"
              onClick={handleEnableStepEdit}
              className="bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
            >
              <Pencil size={14} /> Edit Shop
            </button>
          )}

          {isLocked ? (
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
              <Lock size={12} className="text-slate-500" /> Submitted & Locked
            </span>
          ) : (
            <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-3 py-1 rounded-full border border-blue-200 whitespace-nowrap">
              {editingShopId ? "Editing Shop Details" : "Step Editing Enabled"}
            </span>
          )}
        </div>
      </div>

      {/* Main View rendering based on toggle selection */}
      {viewMode === "shops" ? (
        <UnLoadingTable
          rows={rows}
          setRows={setRows}
          shops={shops}
          birdTypes={birdTypes}
          boxDetails={boxDetails}
          readOnly={isLocked}
          editingShopId={editingShopId}
          onEditShop={handleStartEditShop}
          onCancelEdit={handleCancelShopEdit}
          onSaveRow={handleSaveRow}
          tripNo={trip.tripNo}
          vehicleNo={trip.vehicleNo}
          supervisorName={trip.supervisorName}
          supervisorPhone=""
          tripDate={trip.tripDate}
        />
      ) : (
        <BoxWeightAnalysis
          boxDetails={boxDetails}
          deliveries={rows}
          dcWeight={trip.dcWeight}
          totalFarmBirds={trip.totalBirds}
          /* SYNCED TRIP PROPS */
          tripNo={trip.tripNo}
          vehicleNo={trip.vehicleNo}
          supervisorName={trip.supervisorName}
          tripDate={trip.tripDate}
        />
      )}

      {/* Footer Controls */}
      {!isLocked && !editingShopId && viewMode === "shops" && (
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
          {!trip.deliveryStepSubmitted &&
            !editable &&
            clearForm &&
            !isStepEditing && (
              <button
                type="button"
                onClick={clearForm}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
              >
                Clear Form
              </button>
            )}

          {(editable || isStepEditing) && (
            <button
              type="button"
              onClick={handleCancelStepEdit}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Cancel Editing
            </button>
          )}

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
        </div>
      )}
    </div>
  );
}