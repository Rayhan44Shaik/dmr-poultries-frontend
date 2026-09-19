import React, { useState, useMemo } from "react";
import {
  Pencil,
  Package
} from "lucide-react";
import UnLoadingTable from "./Step_4";
import type { ShopDelivery, Trip, BoxDetail } from "../types/trip";
import { getDeliveriesBalanceError } from "../../../../shared/trip/validation";
import { StepCloseButton } from "./WizardStepUI";
import { TripNoBadge } from "./TripNoBadge";
import { useI18n } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import type { DeliveryEmailStatusValue } from "../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../services/deliveryWhatsAppService";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  trip: Trip;
  updateDeliveries: (rows: ShopDelivery[], persistToStorage?: boolean, silent?: boolean) => void;
  submitDeliveriesStep: () => boolean | string | Promise<boolean | string>;
  saveDeliveriesProgress?: (rows: ShopDelivery[]) => Promise<boolean>;
  clearForm: () => void;
  readOnly?: boolean;
  editable?: boolean;
  canEdit?: boolean;
  /** Bottom Cancel → leave wizard / Create New Trip. */
  onCancel?: () => void;
  /** Close while editing → locked submitted view. */
  onExitEdit?: () => void;
  boxDetails?: BoxDetail[];
  persistedDeliveries?: ShopDelivery[];
  showCommunicationStatus?: boolean;
  emailEffectiveStatus?: (deliveryId: number) => DeliveryEmailStatusValue;
  emailBusyIds?: Set<number>;
  emailIsBulkSending?: boolean;
  emailSendCountFor?: (deliveryId: number) => number;
  emailFailureReasonFor?: (deliveryId: number) => string | null;
  onSendOneEmail?: (delivery: ShopDelivery) => void;
  whatsappEffectiveStatus?: (deliveryId: number) => DeliveryWhatsAppStatusValue;
  whatsappBusyIds?: Set<number>;
  whatsappIsBulkSending?: boolean;
  whatsappSendCountFor?: (deliveryId: number) => number;
  whatsappFailureReasonFor?: (deliveryId: number) => string | null;
  onSendOneWhatsApp?: (delivery: ShopDelivery) => void;
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
  onCancel,
  onExitEdit,
  boxDetails = [],
  persistedDeliveries,
  showCommunicationStatus = false,
  emailEffectiveStatus,
  emailBusyIds,
  emailIsBulkSending,
  emailSendCountFor,
  emailFailureReasonFor,
  onSendOneEmail,
  whatsappEffectiveStatus,
  whatsappBusyIds,
  whatsappIsBulkSending,
  whatsappSendCountFor,
  whatsappFailureReasonFor,
  onSendOneWhatsApp,
}: Props) {
  const { t } = useI18n();

  // Step-level edit mode (parent `editable` opens edit immediately)
  const [isStepEditing, setIsStepEditing] = useState(Boolean(editable));
  React.useEffect(() => {
    if (editable) setIsStepEditing(true);
  }, [editable, trip.id]);

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
    // Lightweight: exit shop-form only (called after per-shop save). Must NOT
    // discard rows or leave the trip wizard.
    setEditingShopId(null);
  };

  /** Close while editing a submitted step → locked submitted view. */
  const handleExitToLocked = () => {
    setIsStepEditing(false);
    setEditingShopId(null);
    if (onExitEdit) {
      onExitEdit();
      return;
    }
  };

  /** Bottom Cancel / leave wizard → Create New Trip landing. */
  const handleCancelWizard = () => {
    setIsStepEditing(false);
    setEditingShopId(null);
    if (onCancel) {
      onCancel();
      return;
    }
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

  const handleLockDeliveries = async (): Promise<boolean | string> => {
    // Balance is also checked in Step_4 before confirm; keep this guard so a
    // direct call cannot submit with a mismatch. Plan stubs never create a
    // balanceError (getDeliveriesBalanceError uses isCountedDeliveryRow).
    if (!canLock) {
      return t("ops.trip.balance_mismatch_fix");
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
            <Package size={18} className="text-emerald-500" />
            {t("ops.trip.title.deliveries")}
          </h3>
          <TripNoBadge tripNo={trip.tripNo} />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Part E: no top-right X — the bottom action bar Cancel is the only
              cancel affordance in first-submit / Edit mode. */}
          {isLocked ? (
            <div className="flex items-center gap-2">
              {/* Locked / view: Close X → Create New Trip (Trip List style) */}
              <StepCloseButton
                onClose={() => {
                  if (onCancel) onCancel();
                  else clearForm();
                }}
                animated
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsStepEditing(true)}
                  className="group relative bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                  aria-label={t("ops.trip.edit_step")}
                >
                  <Pencil size={14} className={uiActionIconMotionClass.edit} />
                </button>
              )}
              <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                {t("ops.trip.submitted_locked")}
              </span>
            </div>
          ) : trip.deliveryStepSubmitted || editingShopId || isStepEditing ? (
            <div className="flex items-center gap-2">
              {/* Edit mode only: animated Close X → locked submitted view */}
              {trip.deliveryStepSubmitted ? (
                <StepCloseButton onClose={handleExitToLocked} animated />
              ) : null}
              <span className="text-xs text-blue-500 font-semibold bg-blue-50/70 px-3 py-1 rounded-full border border-blue-100 whitespace-nowrap">
                {editingShopId ? t("ops.trip.editing_shop_details") : t("ops.trip.step_unlocked")}
              </span>
            </div>
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
        showCommunicationStatus={showCommunicationStatus}
        emailEffectiveStatus={emailEffectiveStatus}
        emailBusyIds={emailBusyIds}
        emailIsBulkSending={emailIsBulkSending}
        emailSendCountFor={emailSendCountFor}
        emailFailureReasonFor={emailFailureReasonFor}
        onSendOneEmail={onSendOneEmail}
        whatsappEffectiveStatus={whatsappEffectiveStatus}
        whatsappBusyIds={whatsappBusyIds}
        whatsappIsBulkSending={whatsappIsBulkSending}
        whatsappSendCountFor={whatsappSendCountFor}
        whatsappFailureReasonFor={whatsappFailureReasonFor}
        onSendOneWhatsApp={onSendOneWhatsApp}
      />
    </div>
  );
}