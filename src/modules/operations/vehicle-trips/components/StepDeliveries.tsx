import React, { useState, useMemo } from "react";
import {
  Lock,
  Pencil,
  Package
} from "lucide-react";
import UnLoadingTable from "./Step_4";
import type { ShopDelivery, Trip, BoxDetail } from "../types/trip";
import { getDeliveriesBalanceError } from "../../../../shared/trip/validation";
import { StepCloseButton } from "./WizardStepUI";
import { TripNoBadge } from "./TripNoBadge";
import { useI18n } from "../../../../i18n";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  trip: Trip;
  updateDeliveries: (rows: ShopDelivery[], persistToStorage?: boolean, silent?: boolean) => void;
  submitDeliveriesStep: () => boolean | Promise<boolean>;
  saveDeliveriesProgress?: (rows: ShopDelivery[]) => Promise<boolean>;
  clearForm: () => void;
  readOnly?: boolean;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  boxDetails?: BoxDetail[];
  persistedDeliveries?: ShopDelivery[];
}

export default function StepDeliveries({
  rows,
  setRows,
  shops,
  birdTypes,
  trip,
  updateDeliveries,
  submitDeliveriesStep,
  saveDeliveriesProgress,
  clearForm,
  readOnly: _readOnly = false,
  editable = false,
  canEdit = true,
  onCancel: _onCancel,
  boxDetails = [],
  persistedDeliveries,
}: Props) {
  const { t } = useI18n();

  // Step-level edit mode
  const [isStepEditing, setIsStepEditing] = useState(false);

  // Shop-level edit mode
  const [editingShopId, setEditingShopId] = useState<string | number | null>(null);

  // Locked state: step submitted AND user hasn't enabled step-level edit mode
  const isLocked = trip.deliveryStepSubmitted && !editable && !isStepEditing;

  // Save individual shop row & trigger persist sync
  const handleSaveRow = (updatedRow: ShopDelivery) => {
    const rowIndex = rows.findIndex((r) => r.id === updatedRow.id);
    let updatedRows: ShopDelivery[] = [];
    if (rowIndex === -1) {
      updatedRows = [updatedRow, ...rows];
    } else {
      updatedRows = [...rows];
      updatedRows[rowIndex] = updatedRow;
    }
    setRows(updatedRows);
    updateDeliveries(updatedRows, true, false);
    setEditingShopId(null);
  };

  const handleStartEditShop = (shopId: string | number) => {
    if (isLocked) return;
    setEditingShopId(shopId);
  };

  const handleCancelStepEdit = () => {
    // Lightweight: exit step-edit / shop-edit mode only. This runs as part of
    // the normal per-shop save flow (Step_4 index.closeForm() calls
    // onCancelEdit after every successful shop save), so it MUST NOT discard
    // `rows` — a per-shop save writes straight to the parent working copy and
    // is persisted by "Save Progress" / Submit. Unsaved shop-form input is
    // discarded by the shop form's own Cancel (form-local state).
    setIsStepEditing(false);
    setEditingShopId(null);
  };

  const handleCancelWizard = () => {
    clearForm();
  };

  // Shared Desktop + Mobile delivery balance rules.
  const validationResult = useMemo(() => {
    const balanceError = getDeliveriesBalanceError(trip, rows);
    return {
      valid: balanceError == null,
      reason: balanceError ? t("ops.trip.balance_mismatch") : "",
      balanceError,
    };
  }, [rows, trip, t]);

  const canLock = validationResult.valid;

  const handleLockDeliveries = async (): Promise<boolean> => {
    if (!canLock) {
      return false;
    }
    setIsStepEditing(false);
    setEditingShopId(null);
    updateDeliveries(rows);
    return await submitDeliveriesStep();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
            <Package size={18} className="text-emerald-600" />
            {t("ops.trip.title.deliveries")}
          </h3>
          <TripNoBadge tripNo={trip.tripNo} />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Part E: no top-right X — the bottom action bar Cancel is the only
              cancel affordance in first-submit / Edit mode. */}
          {isLocked ? (
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsStepEditing(true)}
                  className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                  title={t("ops.trip.edit_step")}
                >
                  <Pencil size={14} />
                </button>
              )}
              <StepCloseButton onClose={handleCancelWizard} />
              <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
                <Lock size={12} className="text-slate-500" /> {t("ops.trip.submitted_locked")}
              </span>
            </div>
          ) : trip.deliveryStepSubmitted || editingShopId ? (
            <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-3 py-1 rounded-full border border-blue-200 whitespace-nowrap">
              {editingShopId ? t("ops.trip.editing_shop_details") : t("ops.trip.step_unlocked")}
            </span>
          ) : null}
        </div>
      </div>

      {/* Main Content View */}
      <UnLoadingTable
        rows={rows}
        setRows={setRows}
        shops={shops}
        birdTypes={birdTypes}
        boxDetails={boxDetails}
        trip={trip}
        readOnly={isLocked}
        isSubmitted={trip.deliveryStepSubmitted}
        editingShopId={editingShopId}
        onEditShop={handleStartEditShop}
        onCancelEdit={handleCancelStepEdit}
        onSaveRow={handleSaveRow}
        tripNo={trip.tripNo}
        vehicleNo={trip.vehicleNo}
        supervisorName={trip.supervisorName}
        supervisorPhone=""
        tripDate={trip.tripDate}
        updateDeliveries={updateDeliveries}
        saveDeliveries={saveDeliveriesProgress ? async () => saveDeliveriesProgress(rows) : undefined}
        submitDeliveries={handleLockDeliveries}
        onClose={handleCancelWizard}
        persistedRows={persistedDeliveries ?? []}
        balanceError={validationResult.balanceError}
        tripBirdTypeId={trip.birdTypeId}
        tripBirdType={trip.birdType}
      />
    </div>
  );
}