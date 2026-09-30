// src/modules/operations/vehicle-trips/utils/generateShopPDF.ts
// (Referenced helper or included components as part of UnLoadingTable module)

// src/modules/operations/vehicle-trips/components/Step_4/UnLoadingTable.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Plus, Clock, Building2, Users, Scale, AlertCircle, Search, X, 
  FileText, Box
} from "lucide-react";
import TripPagination from "../TripPagination";
import { shouldShowPagination } from "../../../../../shared/ui/paginationStyles";
import { useShopDeliveryForm, EMPTY_DELIVERY_FORM } from "./useShopDeliveryForm";
import ShopDeliveryForm from "./ShopDeliveryForm";
import ShopDeliveryCard from "./ShopDeliveryCard";
import { generateShopPDF } from "../../utils/generateShopPDF";
import { generatePickupReportPDF } from "../../utils/generatePickupPDF";
import { generateAssignmentSheetPdf } from "../../../../orders/pdf/generateAssignmentSheetPdf";
import type { AssignmentSheetRow } from "../../../../orders/utils/ordersUtils";
import { hasOrderTag } from "../../../../orders/utils/ordersUtils";
import {
  assignedShopOrderFromRows,
  buildDeliveredShopKeys,
  captureRemarksFor,
  isDeliveredRow,
  orderAssignedShops,
  pendingBoxesFromRows,
  sortShopsAssignedFirst,
  step4ShopsCount,
} from "./remainingBoxes";
import { computeDeliveryKpiTotals } from "./deliveryKpis";
import { withMinSaveDuration } from "../../utils/withMinSaveDuration";
import { formatTripViewStamp, localizeTripViewText } from "../../utils/tripViewLocalization";
import type { DeliveriesBalanceError } from "../../../../../shared/trip/validation";
import { validateDeliveriesStep } from "../../../../../shared/trip/validation";
import type { ShopDelivery, BoxDetail, Trip } from "../../types/trip";
import type { DeliveryEmailStatusValue } from "../../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../../services/deliveryWhatsAppService";
import { WizardActionBar } from "../WizardStepUI";
import TripStepConfirmDialog from "../TripStepConfirmDialog";
import { useI18n } from "../../../../../i18n";
import { useSafeNotification } from "../../../../../hooks/useSafeNotification";
import { translateValidationMessage } from "../../utils/translateValidation";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { TripTimestampDisplay } from "../TripTimestampDisplay";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  boxDetails?: BoxDetail[];
  trip?: Trip;
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
  stepNumber?: number | string;
  updateDeliveries?: (rows: ShopDelivery[], persist?: boolean, silent?: boolean) => void;
  saveDeliveries?: (opts?: { silent?: boolean }, rowsOverride?: ShopDelivery[]) => Promise<boolean>;
  submitDeliveries?: () => boolean | string | Promise<boolean | string>;
  onClose?: () => void;
  persistedRows?: ShopDelivery[];
  balanceError?: DeliveriesBalanceError;
  balanceErrorShown?: boolean;
  tripBirdTypeId?: number;
  tripBirdType?: string;
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

/** Pending (not-yet-delivered) shops in DELIVERY order — the same order the
 *  dropdown shows (priority route first, then alphabetical) — mapped to
 *  AssignmentSheetRow so the Step 4 "Shops" PDF is EXACTLY the Order
 *  Assignment sheet. Assigned boxes/birds come from the shop's `[ORDER]`
 *  plan row when present. */
function buildPendingAssignmentRows(
  shops: any[],
  rows: ShopDelivery[]
): AssignmentSheetRow[] {
  const { ids, names } = buildDeliveredShopKeys(rows);
  // Same source as the dropdown's "assigned shops on top" ordering, so the
  // sheet and the dropdown can never disagree about the route order.
  const assignedOrder = assignedShopOrderFromRows(rows);

  // Only order-assignment shops belong on the sheet. When a trip has no
  // assignment rows yet (plain manual trip), fall back to the full list.
  const source = orderAssignedShops(shops ?? [], rows);

  const isDelivered = (shop: any) => {
    const id = Number(shop.id ?? shop.shopId ?? 0);
    const name = String(shop.shopName ?? shop.name ?? "").trim().toLowerCase();
    return (id > 0 && ids.has(id)) || (Boolean(name) && names.has(name));
  };

  const pending = source.filter((shop: any) => !isDelivered(shop));

  const isPriority = (shop: any) => assignedOrder.has(Number(shop.id ?? shop.shopId ?? 0));
  pending.sort((a: any, b: any) => {
    const ap = isPriority(a);
    const bp = isPriority(b);
    if (ap && bp) {
      return (
        (assignedOrder.get(Number(a.id ?? a.shopId ?? 0)) ?? 0) -
        (assignedOrder.get(Number(b.id ?? b.shopId ?? 0)) ?? 0)
      );
    }
    if (ap) return -1;
    if (bp) return 1;
    return String(a.shopName ?? a.name ?? "").localeCompare(String(b.shopName ?? b.name ?? ""));
  });

  return pending.map((shop: any, index: number) => {
    const shopId = Number(shop.id ?? shop.shopId ?? 0);
    const shopName = shop.shopName ?? shop.name ?? `Shop ${shopId}`;
    const plan = rows.find(
      (r) =>
        Number(r.shopId) === shopId &&
        String(r.remarks ?? "").trim().startsWith("[ORDER]")
    );
    return {
      serialNo: index + 1,
      shopId,
      shopName,
      village: shop.village ?? shop.city ?? "",
      mobile: shop.mobile ?? shop.phoneNumber ?? "",
      boxes: plan
        ? Number(plan.boxNo) || (plan.selectedBoxIds?.length ?? 0)
        : 0,
      birds: plan ? Number(plan.birds) || 0 : 0,
    };
  });
}

function DeliveryBalanceErrorPanel({
  error,
  onClose,
}: {
  error: NonNullable<DeliveriesBalanceError>;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-red-100 bg-red-50/70 p-4 space-y-2">
      <div className="flex items-start gap-2">
        <p className="text-sm font-bold text-red-500 flex items-center gap-1.5 flex-1">
          <AlertCircle size={15} className="text-red-500" /> {t("ops.trip.balance_mismatch_fix")}
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="group relative -m-1 rounded-md p-1 text-red-400 transition-colors hover:bg-red-50/80 hover:text-red-500"
            aria-label={t("common.close")}
          >
            <X size={15} className={uiActionIconMotionClass.close} />
          </button>
        )}
      </div>
      {error.birds && (
        <div className="text-xs text-red-500 space-y-0.5">
          <p className="font-semibold">{t("common.birds")}</p>
          <p className="pl-3">{t("ops.trip.pickup")}: <span className="font-bold">{error.birds.pickup}</span></p>
          <p className="pl-3">
            {t("ops.trip.delivered")}: <span className="font-bold">{error.birds.delivered}</span> + {t("operations.mortality_count")}:{" "}
            <span className="font-bold">{error.birds.mortality}</span> ={" "}
            <span className="font-bold">{error.birds.delivered + error.birds.mortality}</span>
          </p>
          <p className="pl-3 text-red-500">
            {t("ops.trip.pickup_must_equal", { pickup: error.birds.pickup, total: error.birds.delivered + error.birds.mortality })}
          </p>
        </div>
      )}
      {error.weight && (
        <div className="text-xs text-red-500 space-y-0.5">
          <p className="font-semibold">{t("common.weight")}</p>
          <p className="pl-3">{t("ops.trip.farm")}: <span className="font-bold">{error.weight.farm.toFixed(2)} {t("common.kg")}</span></p>
          <p className="pl-3">{t("ops.trip.delivered")}: <span className="font-bold">{error.weight.delivered.toFixed(2)} {t("common.kg")}</span></p>
          <p className="pl-3">{t("operations.mortality_count")}: <span className="font-bold">{error.weight.mortalityWeight.toFixed(2)} {t("common.kg")}</span></p>
          <p className="pl-3">{t("ops.trip.loss")}: <span className="font-bold">{error.weight.loss.toFixed(2)} {t("common.kg")}</span></p>
          <p className="pl-3">
            {t("ops.trip.expected")}: <span className="font-bold">{error.weight.expected.toFixed(2)} {t("common.kg")}</span>
          </p>
          <p className="pl-3 text-red-500">
            {t("ops.trip.farm_must_equal", { farm: error.weight.farm.toFixed(2), expected: error.weight.expected.toFixed(2) })}
          </p>
        </div>
      )}
    </div>
  );
}

export default function UnLoadingTable({
  rows,
  setRows,
  shops,
  birdTypes,
  boxDetails = [],
  trip,
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
  stepNumber: _stepNumber = 4,
  updateDeliveries,
  saveDeliveries,
  submitDeliveries,
  onClose,
  persistedRows,
  balanceError,
  balanceErrorShown = false,
  tripBirdTypeId,
  tripBirdType,
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
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = useMemo(
    () => (birdTypes ?? []).filter((bird: any) => !bird.category || bird.category === "Bird"),
    [birdTypes],
  );
  const safeTrip = trip ?? null;

  // Cache the last known good boxDetails to prevent stale/empty boxDetails from API responses
  const boxDetailsRef = useRef<BoxDetail[]>([]);
  if (boxDetails && boxDetails.length > 0) {
    boxDetailsRef.current = boxDetails;
  }
  const safeBoxDetails = boxDetailsRef.current.length > 0 ? boxDetailsRef.current : (boxDetails ?? []);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(9);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [autoCaptureTime, setAutoCaptureTime] = useState<string>("");
  const [modalLeftInset, setModalLeftInset] = useState(0);

  // The Add/Edit Shop card is a modal surface. Keep the underlying trip page
  // fixed while it is open, matching the master Shop form behaviour.
  useEffect(() => {
    if (!showForm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm]);

  // Centre the shop dialog inside the application CONTENT column, not across
  // the sidebar. Recompute when the persistent sidebar changes shape.
  useEffect(() => {
    if (!showForm) return;
    const insetForMode = (mode: unknown) => mode === "expanded" ? 260 : mode === "rail" ? 72 : 0;
    const syncInset = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setModalLeftInset(0);
        return;
      }
      const mode = document.querySelector<HTMLElement>("[data-sidebar-mode]")?.dataset.sidebarMode;
      setModalLeftInset(insetForMode(mode));
    };
    const onSidebarModeChange = (event: Event) => {
      const mode = (event as CustomEvent<unknown>).detail;
      setModalLeftInset(window.matchMedia("(min-width: 1024px)").matches ? insetForMode(mode) : 0);
    };
    syncInset();
    window.addEventListener("resize", syncInset);
    window.addEventListener("dmr-sidebar-mode-change", onSidebarModeChange);
    return () => {
      window.removeEventListener("resize", syncInset);
      window.removeEventListener("dmr-sidebar-mode-change", onSidebarModeChange);
    };
  }, [showForm]);

  // ─── Submission Status Tracking ─────────────────────────────────
  const [hasBeenSubmitted, setHasBeenSubmitted] = useState<boolean>(isSubmitted);

  useEffect(() => {
    if (isSubmitted !== undefined) {
      setHasBeenSubmitted(isSubmitted);
    }
  }, [isSubmitted]);

  // ─── Saving & Toast State ─────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const autosaveTimerRef = useRef<number | undefined>(undefined);
  const autosaveInFlightRef = useRef(false);
  const formAutosaveTimerRef = useRef<number | undefined>(undefined);
  const formAutosaveInFlightRef = useRef(false);
  const draftIdentityRef = useRef<{ id: number; clientKey: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  // Background autosave for Step 4 — same silent pattern as Step 3 Pickup:
  // debounce after edits settle, persist without header flash / remount.
  const deliveriesDraftFingerprint = useMemo(
    () => JSON.stringify({ legIndex: Number(safeTrip?.activeLegIndex ?? 1), rows: safeRows }),
    [safeTrip?.activeLegIndex, safeRows]
  );
  const [lastSavedDeliveriesFingerprint, setLastSavedDeliveriesFingerprint] = useState(() =>
    JSON.stringify({ legIndex: Number(safeTrip?.activeLegIndex ?? 1), rows: persistedRows ?? [] })
  );
  useEffect(() => {
    setLastSavedDeliveriesFingerprint(
      JSON.stringify({ legIndex: Number(safeTrip?.activeLegIndex ?? 1), rows: persistedRows ?? [] })
    );
  }, [safeTrip?.activeLegIndex, persistedRows]);
  const hasUnsavedChanges = deliveriesDraftFingerprint !== lastSavedDeliveriesFingerprint;

  // Auto-clear notices (Progress saved / shop saved) after 5 seconds.
  useEffect(() => {
    window.clearTimeout(toastTimerRef.current);
    if (!toast) return;
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(toastTimerRef.current);
  }, [toast]);

  useEffect(() => {
    if (readOnly || !saveDeliveries || isSubmitting || showForm || isSaving) return;
    if (deliveriesDraftFingerprint === lastSavedDeliveriesFingerprint) return;

    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      if (autosaveInFlightRef.current) return;
      const fingerprint = JSON.stringify({ legIndex: Number(safeTrip?.activeLegIndex ?? 1), rows: safeRows });
      if (fingerprint === lastSavedDeliveriesFingerprint) return;
      autosaveInFlightRef.current = true;
      void (async () => {
        try {
          const ok = await saveDeliveries({ silent: true });
          if (ok) setLastSavedDeliveriesFingerprint(fingerprint);
        } finally {
          autosaveInFlightRef.current = false;
        }
      })();
    }, 2500);

    return () => window.clearTimeout(autosaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deliveriesDraftFingerprint,
    lastSavedDeliveriesFingerprint,
    readOnly,
    saveDeliveries,
    isSubmitting,
    showForm,
    isSaving,
  ]);

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

  // Persist the open Add/Edit Shop form itself after 2.5 seconds of inactivity.
  // Previously the row-level autosave was disabled while this form was open,
  // which meant the values users were actively entering never reached the API.
  const formDraftFingerprint = useMemo(
    () => JSON.stringify({ mode, editingId, formData }),
    [mode, editingId, formData],
  );
  useEffect(() => {
    if (readOnly || !showForm || !saveDeliveries || isSubmitting || isSaving) return;
    if (Number(formData.shopId) <= 0) return; // backend requires a real shop

    window.clearTimeout(formAutosaveTimerRef.current);
    formAutosaveTimerRef.current = window.setTimeout(() => {
      if (formAutosaveInFlightRef.current) return;
      const identity = draftIdentityRef.current;
      if (!identity) return;

      const selectedBoxIds = [...formData.selectedBoxIds];
      const isBoxMode = mode === "box";
      const birds = isBoxMode ? Math.max(0, farmBirds - Number(formData.mortality || 0)) : Number(formData.birds || 0);
      const weight = Number((isBoxMode ? Math.max(0, farmWeight - mortKg) : Number(formData.weight || 0)).toFixed(2));
      const existing = editingId == null ? undefined : safeRows.find((row) => Number(row.id) === Number(editingId));
      const capturedAt = String((existing as any)?.autoCaptureTime ?? autoCaptureTime ?? "").trim();
      const draftRow = {
        ...(existing ?? {}),
        id: identity.id,
        clientKey: identity.clientKey,
        serialNo: existing?.serialNo ?? safeRows.reduce((max, row) => Math.max(max, Number(row.serialNo || 0)), 0) + 1,
        shopId: Number(formData.shopId),
        shopName: formData.shopName,
        subShopName: formData.subShopName.trim(),
        birdTypeId: Number(formData.birdTypeId || 0),
        birdType: formData.birdType,
        boxNo: selectedBoxIds.length,
        birds,
        weight,
        mortality: Number(formData.mortality || 0),
        mortKg: Number((isBoxMode ? mortKg : Number(formData.mortWeight || 0)).toFixed(2)),
        rate: Number(existing?.rate || 0),
        amount: Number(existing?.amount || 0),
        remarks: captureRemarksFor(safeRows, Number(formData.shopId), formData.remarks),
        deliveryMode: mode,
        selectedBoxIds,
        farmBirds,
        farmWeight,
        perBoxData: isBoxMode ? formData.perBoxData : [],
        // Autosave is draft persistence only. The official per-shop capture
        // timestamp is still created by the explicit Save Shop action.
        autoCaptureTime: capturedAt || undefined,
      } as ShopDelivery;
      const rowsToSave = existing
        ? safeRows.map((row) => Number(row.id) === Number(existing.id) ? draftRow : row)
        : [draftRow, ...safeRows];

      formAutosaveInFlightRef.current = true;
      void saveDeliveries({ silent: true }, rowsToSave).finally(() => {
        formAutosaveInFlightRef.current = false;
      });
    }, 2500);

    return () => window.clearTimeout(formAutosaveTimerRef.current);
  }, [
    autoCaptureTime, editingId, farmBirds, farmWeight, formData,
    formDraftFingerprint, isSaving, isSubmitting, mode, mortKg, readOnly,
    safeRows, saveDeliveries, showForm,
  ]);

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
  // Live route counts for the header buttons: Shops = still-to-deliver shops,
  // Boxes = still-available pickup boxes. Both shrink as deliveries are made.
  //
  // The assigned-shop count exists ONLY once the Order Assignment for this
  // vehicle has actually been SUBMITTED — Finish Assignment tags the trip
  // remarks with `order:<tripNo>`, Save Progress does not. Before that, Step 4
  // has nothing assigned to count, so counting the `[ORDER]` plan rows a Save
  // Progress left behind would advertise shops the driver never received
  // (the "Shops (11) before I submitted anything" bug).
  const assignmentSubmitted = useMemo(
    () => hasOrderTag((safeTrip ?? {}) as Trip),
    [safeTrip]
  );

  const pendingShopsCount = useMemo(
    () => step4ShopsCount(safeShops, safeRows, assignmentSubmitted),
    [safeShops, safeRows, assignmentSubmitted]
  );

  const remainingBoxesCount = useMemo(
    () => pendingBoxesFromRows(safeBoxDetails, safeRows).length,
    [safeBoxDetails, safeRows]
  );

  // ─── Balance Error Panel visibility (shown after a blocked submit) ──
  const [showBalanceError, setShowBalanceError] = useState<boolean>(balanceErrorShown);

  useEffect(() => {
    if (balanceError == null) setShowBalanceError(false);
  }, [balanceError, safeRows, safeBoxDetails]);

  // ─── Step 4 PDF exports (separate Shop + Box reports) ───────────
  //   • Shops PDF  = the ORDER ASSIGNMENT sheet (identical format), listing
  //     the pending shops in delivery order.
  //   • Boxes PDF  = the PICKUP report (identical format) for the boxes still
  //     on the truck — delivered boxes are removed, nothing else changes.

  const handleDownloadShopsPDF = async () => {
    try {
      const sheetRows = buildPendingAssignmentRows(safeShops, safeRows);
      const capacity =
        Number((safeTrip as any)?.vehicleBoxCapacity) ||
        Number((safeTrip as any)?.boxes) ||
        safeBoxDetails.length;
      const deliveredBoxes = Math.max(0, safeBoxDetails.length - remainingBoxesCount);
      const tripForSheet: Trip = safeTrip
        ? safeTrip
        : ({
            tripNo,
            tripDate,
            vehicleNo,
            supervisorName,
            driverName: "",
            sourceFarm: "",
            farmAddress: "",
          } as unknown as Trip);
      await generateAssignmentSheetPdf({
        trip: tripForSheet,
        supervisorMobile: supervisorPhone,
        orderTripNo: tripNo,
        orderDate: tripDate,
        rows: sheetRows,
        capacity,
        alreadyAssignedOther: deliveredBoxes,
      });
      setToast({ message: t("ops.trip.shops_pdf_ok"), type: "success" });
    } catch (error: any) {
      console.error("Shops report failed:", error);
      setToast({ message: t("ops.trip.failed_pdf_report"), type: "error" });
    }
  };

  const handleDownloadBoxesPDF = async () => {
    try {
      // Remaining (undelivered) boxes only — same Pickup Report format.
      const remaining = pendingBoxesFromRows(safeBoxDetails, safeRows);
      const totalBirds = remaining.reduce((s, b) => s + Number(b.birds || 0), 0);
      const dcWeight = Number(
        remaining.reduce((s, b) => s + Number(b.weight || 0), 0).toFixed(2)
      );
      const pickupTrip: Trip = {
        ...(safeTrip ?? ({} as Trip)),
        tripNo: tripNo || (safeTrip as any)?.tripNo || "Trip",
        tripDate: tripDate || (safeTrip as any)?.tripDate || "",
        vehicleNo: vehicleNo || (safeTrip as any)?.vehicleNo || "",
        supervisorName: supervisorName || (safeTrip as any)?.supervisorName || "",
        boxDetails: remaining as BoxDetail[],
        boxes: remaining.length,
        totalBirds,
        dcWeight,
        avgWeight:
          totalBirds > 0 ? Number((dcWeight / totalBirds).toFixed(2)) : undefined,
      } as Trip;
      await generatePickupReportPDF(pickupTrip, {
        maxBoxes:
          Number((safeTrip as any)?.vehicleBoxCapacity) || safeBoxDetails.length,
      });
      setToast({ message: t("ops.trip.boxes_pdf_ok"), type: "success" });
    } catch (error: any) {
      console.error("Boxes report failed:", error);
      setToast({ message: t("ops.trip.failed_pdf_report"), type: "error" });
    }
  };

  // ─── Manual Save Progress Handler ──────────────────────────────
  const handleSaveProgress = async () => {
    if (readOnly || !saveDeliveries || isSaving) return;
    setIsSaving(true);
    try {
      const success = await withMinSaveDuration(() => saveDeliveries());
      if (success) {
        setLastSavedDeliveriesFingerprint(
          JSON.stringify({ legIndex: Number(safeTrip?.activeLegIndex ?? 1), rows: safeRows })
        );
        showNotification(t("ops.trip.progress_saved"), "success");
      } else {
        showNotification(t("ops.trip.failed_save_delivery"), "error");
      }
    } catch (error) {
      console.error("Save progress error:", error);
      showNotification(t("ops.trip.failed_save_delivery"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Submit / Update Deliveries Handler ──────────────────────────
  const handleSubmitOrUpdateDeliveries = () => {
    if (readOnly || isSubmitting) return;

    // Field-level balance rules block submission BEFORE any confirmation —
    // the inline panel + WizardStepNotice explain exactly what is wrong.
    // Shops (N) plan stubs are reference-only and never create a balanceError.
    if (balanceError) {
      setShowBalanceError(true);
      setToast({ message: t("ops.trip.balance_mismatch_fix"), type: "error" });
      return;
    }

    // Local validate so missing shop/bird-type (and similar) show in the same
    // notice slot — still ignoring uncaptured [ORDER] plan rows.
    const localValidation = validateDeliveriesStep(
      { dcWeight: Number(safeTrip?.dcWeight || 0), totalBirds: Number(safeTrip?.totalBirds || 0) },
      safeRows
    );
    if (!localValidation.valid) {
      setToast({
        message:
          translateValidationMessage(t, localValidation.errors[0] || "") ||
          t("ops.trip.failed_submit_delivery"),
        type: "error",
      });
      return;
    }

    const runSubmit = async () => {
      if (submitLockRef.current || isSubmitting) return;
      submitLockRef.current = true;
      setIsSubmitting(true);
      try {
        let result: boolean | string = true;
        if (submitDeliveries) {
          result = await submitDeliveries();
        } else if (updateDeliveries) {
          updateDeliveries(safeRows);
          result = true;
        } else {
          result = t("ops.trip.failed_submit_delivery");
        }

        if (result === true) {
          setHasBeenSubmitted(true);
          setToast({ message: t("ops.trip.step4_submitted"), type: "success" });
          if (showForm) closeForm();
          return;
        }

        const errorMessage =
          typeof result === "string" && result.trim()
            ? result
            : t("ops.trip.failed_submit_delivery");
        setToast({ message: errorMessage, type: "error" });
        if (balanceError) setShowBalanceError(true);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("ops.trip.failed_submit_delivery");
        setToast({ message, type: "error" });
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    };

    if (!hasBeenSubmitted) {
      setConfirmation({
        isOpen: true,
        title: t("ops.trip.submit_shop_deliveries"),
        message: t("ops.trip.confirm_submit_deliveries"),
        confirmLabel: t("ops.trip.yes_submit"),
        cancelLabel: t("common.cancel"),
        type: "info",
        onConfirm: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          void runSubmit();
        },
        onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
      });
    } else {
      setConfirmation({
        isOpen: true,
        title: t("ops.trip.update_deliveries"),
        message: t("ops.trip.confirm_update_deliveries"),
        confirmLabel: t("ops.trip.yes_update"),
        cancelLabel: t("common.cancel"),
        type: "info",
        onConfirm: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          void runSubmit();
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
        setToast({ message: t("ops.trip.edit_cancelled_locked"), type: "info" });
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
    // Auto-captured time is NOT shown while adding — it is captured at the
    // moment the delivery is actually saved (see handleSubmit).
    setAutoCaptureTime("");
    const birdTypeId = tripBirdTypeId || 0;
    const birdType = tripBirdType || "";
    const draftId = Date.now();
    draftIdentityRef.current = {
      id: draftId,
      clientKey: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ck-${draftId}`,
    };
    setFormData({ ...EMPTY_DELIVERY_FORM, birdTypeId, birdType });
    setShowForm(true);
  };

  const openEditForm = (row: ShopDelivery) => {
    const rowWithExtra = row as any;
    const isUncapturedOrderPlan =
      String(row.remarks ?? "").trim().startsWith("[ORDER]") &&
      !rowWithExtra.autoCaptureTime &&
      !rowWithExtra.deliveredAt &&
      !rowWithExtra.deliveryTime;
    setEditingId(row.id);
    draftIdentityRef.current = {
      id: Number(row.id),
      clientKey: row.clientKey || `ck-${row.id}`,
    };
    setMode(rowWithExtra.deliveryMode || "box");
    setAutoCaptureTime(rowWithExtra.autoCaptureTime || "");
    setFormData({
      shopId: row.shopId,
      shopName: row.shopName,
      subShopName: row.subShopName || "",
      birdTypeId: row.birdTypeId || tripBirdTypeId || 0,
      birdType: row.birdType || tripBirdType || "",
      // Keep assigned boxes from Order Assignment as a starting selection.
      selectedBoxIds: rowWithExtra.selectedBoxIds || [],
      // Planned order quantities are reference only — never treat them as
      // delivered weight/birds until the driver actually captures.
      birds: isUncapturedOrderPlan ? 0 : row.birds,
      weight: isUncapturedOrderPlan ? 0 : row.weight,
      mortality: isUncapturedOrderPlan ? 0 : row.mortality || 0,
      mortWeight: isUncapturedOrderPlan ? 0 : rowWithExtra.mortKg || 0,
      remarks: row.remarks || "",
      perBoxData: isUncapturedOrderPlan ? [] : rowWithExtra.perBoxData || [],
    });
    setShowForm(true);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      setToast({ message: t("ops.trip.cannot_exceed_farm_birds", { count: farmBirds }), type: "warning" });
      return;
    }
    if (validationErrors.weightExceedFarm) {
      setToast({ message: t("ops.trip.cannot_exceed_farm_weight", { weight: farmWeight.toFixed(2) }), type: "warning" });
      return;
    }
    if (!validate()) {
      setToast({ message: t("ops.trip.resolve_validation"), type: "warning" });
      return;
    }

    if (formData.shopId === 0) {
      setToast({ message: t("ops.trip.select_shop_required"), type: "warning" });
      return;
    }
    if (!formData.birdTypeId) {
      setToast({ message: t("ops.trip.bird_type_required"), type: "warning" });
      return;
    }

    // The same shop MAY be captured more than once — e.g. one Box Mode and one
    // Weight Mode delivery for the same shop. Duplicates are accepted.

    let finalBirds = formData.birds;
    let finalWeight = formData.weight;
    let selectedBoxIds: number[] = [];
    let farmBirdsVal = 0;
    let farmWeightVal = 0;
    let mortKgVal = 0;
    let perBoxData: { boxNo: number; birds: number; weight: number }[] = [];

    if (mode === "box") {
      if (formData.selectedBoxIds.length === 0) {
        setToast({ message: t("ops.trip.select_one_box"), type: "warning" });
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
        setToast({ message: t("ops.trip.select_one_box"), type: "warning" });
        return;
      }
      selectedBoxIds = formData.selectedBoxIds;
      farmBirdsVal = farmBirds;
      farmWeightVal = farmWeight;
      finalBirds = Number(formData.birds) || 0;
      finalWeight = Number(formData.weight) || 0;
      mortKgVal = formData.mortWeight;
      perBoxData = [];
    }

    // Weights are always stored rounded to two decimals.
    finalWeight = Number((Number(finalWeight) || 0).toFixed(2));
    mortKgVal = Number((Number(mortKgVal) || 0).toFixed(2));

    const maxSerial = safeRows.reduce((max: number, r: ShopDelivery) => Math.max(max, r.serialNo || 0), 0);
    const newRow: any = {
      id: editingId ?? draftIdentityRef.current?.id ?? Date.now(),
      serialNo: editingId ? (safeRows.find((r) => r.id === editingId)?.serialNo || maxSerial + 1) : maxSerial + 1,
      shopId: formData.shopId,
      shopName: formData.shopName,
      subShopName: formData.subShopName.trim(),
      birdTypeId: formData.birdTypeId,
      birdType: formData.birdType,
      boxNo: formData.selectedBoxIds.length,
      birds: finalBirds,
      weight: finalWeight,
      mortality: formData.mortality,
      // A capture for a shop Order Assignment put on this trip keeps that
      // shop's `[ORDER]` marker, so Delivery Tracking counts it as delivered.
      remarks: captureRemarksFor(safeRows, formData.shopId, formData.remarks),
      rate: 0,
      amount: 0,
      deliveryMode: mode,
      selectedBoxIds: selectedBoxIds,
      farmBirds: farmBirdsVal,
      farmWeight: farmWeightVal,
      mortKg: mortKgVal,
      perBoxData: perBoxData,
      clientKey: editingId
        ? (safeRows.find((r) => r.id === editingId) as ShopDelivery | undefined)?.clientKey || `ck-${editingId}`
        : draftIdentityRef.current?.clientKey || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ck-${Date.now()}`),
      // Persist ISO so the backend stores auto_capture_time. Display stays IST
      // via formatIstStamp. First capture of a plan row (editingId set, no prior
      // time) also stamps now — otherwise cards show "—".
      autoCaptureTime: (() => {
        const existing = String(
          editingId !== null
            ? autoCaptureTime ||
                (safeRows.find((r) => r.id === editingId) as ShopDelivery & { autoCaptureTime?: string } | undefined)
                  ?.autoCaptureTime ||
                ""
            : ""
        ).trim();
        if (existing) {
          if (/^\d{4}-\d{2}-\d{2}T/.test(existing)) return existing;
          // Legacy IST display stamp — keep it; backend now parses IST.
          if (/^\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}/.test(existing)) return existing;
          const parsed = new Date(existing);
          if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
        }
        return new Date().toISOString();
      })(),
    };

    if (editingId !== null) {
      setRows((prev) => prev.map((r) => (r.id === editingId ? newRow : r)));
      if (onSaveRow) onSaveRow(newRow);
    } else {
      // Let onSaveRow own persistence when provided; still update local rows
      // once so KPIs / remaining boxes refresh immediately.
      setRows((prev) => [newRow, ...prev]);
      if (onSaveRow) onSaveRow(newRow);
    }

    setToast({ message: t("ops.trip.shop_saved", { name: formData.shopName }), type: "success" });
    closeForm();
    setCurrentPage(1);
  };

  // ─── Select Options ───────────────────────────────────────────────
  const shopOptions = useMemo(() => {
    if (!safeShops || safeShops.length === 0) {
      return [{ value: 0, label: t("ops.trip.no_shops_available"), isDisabled: true }];
    }
    // The route order of the shops Order Assignment put on this vehicle.
    const assignedOrder = assignedShopOrderFromRows(safeRows);

    // EVERY shop is offered. The Order Assignment decides what floats to the
    // TOP of the list — it never hides the rest of the shop master.
    const opts = safeShops
      .filter((shop: any) => {
        const status = String(shop.status ?? "Active");
        const id = shop.id ?? shop.shopId ?? 0;
        if (status === "Active") return true;
        return safeRows.some((r) => Number(r.shopId) === Number(id));
      })
      .map((shop: any) => {
        const value = shop.id ?? shop.shopId ?? 0;
        const searchText = shop.shopName ?? shop.name ?? `Shop ${value}`;
        const label = localizeTripViewText(searchText, language);
        return { value, label, searchText, isDisabled: false };
      })
      .filter((opt: { value: number; label: string; isDisabled: boolean }) => opt.value > 0);

    // ORDER: the assigned shops FIRST, in their route (`serialNo`) order —
    // exactly the "Shops (N)" list — then every remaining shop ALPHABETICALLY.
    return sortShopsAssignedFirst(opts, assignedOrder);
  }, [safeShops, safeRows, language]);

  const birdOptions = useMemo(() => {
    // If tripBirdTypeId is provided (from Step 2), restrict to only that bird type
    const allowedBirdTypeId = tripBirdTypeId;
    let filteredBirdTypes = safeBirdTypes;
    if (allowedBirdTypeId) {
      filteredBirdTypes = safeBirdTypes.filter((bird: any) => (bird.id ?? bird.birdTypeId) === allowedBirdTypeId);
    }
    if (!filteredBirdTypes || filteredBirdTypes.length === 0) {
      return [{ value: 0, label: t("ops.trip.no_bird_types_available"), isDisabled: true }];
    }
    return filteredBirdTypes
      .filter((bird: any) => {
        const active = String(bird.status ?? "Active") === "Active";
        return active || (bird.id ?? bird.birdTypeId) === allowedBirdTypeId;
      })
      .map((bird: any) => {
        const value = bird.id ?? bird.birdTypeId ?? 0;
        const searchText = bird.birdType ?? bird.name ?? `Bird ${value}`;
        const label = localizeTripViewText(searchText, language);
        return { value, label, searchText, isDisabled: false };
      })
      .filter((opt: { value: number; label: string; isDisabled: boolean }) => opt.value > 0);
  }, [safeBirdTypes, tripBirdTypeId, language]);

  const isFormValid = useMemo<boolean>(() => {
    if (mode === "box") {
      return (
        formData.shopId > 0 &&
        formData.birdTypeId > 0 &&
        formData.selectedBoxIds.length > 0 &&
        farmBirds > 0 &&
        formData.mortality >= 0 &&
        formData.mortality <= farmBirds &&
        !validationErrors.birdsExceed
      );
    } else {
      // mortWeight is optional in weight mode — 0 / empty is allowed.
      return (
        formData.shopId > 0 &&
        formData.birdTypeId > 0 &&
        formData.selectedBoxIds.length > 0 &&
        Number(formData.birds) > 0 &&
        Number(formData.weight) > 0 &&
        formData.mortality >= 0 &&
        Number(formData.mortWeight || 0) >= 0 &&
        !validationErrors.birdsExceed &&
        !validationErrors.birdsMismatch &&
        !validationErrors.birdsExceedFarm &&
        !validationErrors.weightExceedFarm
      );
    }
  }, [mode, formData, farmBirds, validationErrors]);

  // ─── Top KPI Calculations (LIVE from current rows, not persisted) ───
  const topKpiTotals = useMemo(() => computeDeliveryKpiTotals(safeRows), [safeRows]);

  // Delivery-mode split for the KPI cards (delivered rows only).
  const boxModeCount = useMemo(
    () =>
      safeRows.filter(
        (r) => isDeliveredRow(r) && (r.deliveryMode ?? "box") !== "weight"
      ).length,
    [safeRows]
  );
  const weightModeCount = useMemo(
    () =>
      safeRows.filter(
        (r) => isDeliveredRow(r) && (r.deliveryMode ?? "box") === "weight"
      ).length,
    [safeRows]
  );

  // ─── Filtered Search & Pagination ──────────────────────────────
  const displayRows = useMemo<ShopDelivery[]>(() => {
    // Only CAPTURED deliveries render as cards. Pending `[ORDER]` assignment
    // rows (the shops that still need a delivery) are NOT user-entered data,
    // so they stay hidden here — the Add-Shop dropdown is where those shops
    // are offered (route order first, completed shops afterwards).
    const saved = safeRows.filter(
      (r: ShopDelivery) => r.shopId > 0 && r.birds > 0 && r.weight > 0
    );

    const filtered = saved.filter((r: ShopDelivery) => {
      if (!searchTerm.trim()) return true;
      const query = searchTerm.toLowerCase();
      const shopNameMatch = (r.shopName || "").toLowerCase().includes(query);
      const birdTypeMatch = (r.birdType || "").toLowerCase().includes(query);
      const remarksMatch = (r.remarks || "").toLowerCase().includes(query);
      // Searching a box number must match the shop that carries it.
      const boxIds = Array.isArray(r.selectedBoxIds) ? r.selectedBoxIds : [];
      const boxNumberMatch =
        boxIds.some((id) => String(id).includes(query)) ||
        String(r.boxNo ?? "").includes(query);
      return shopNameMatch || birdTypeMatch || remarksMatch || boxNumberMatch;
    });

    // Route order for the card list: DELIVERED shops first with the most
    // recent capture on TOP (older deliveries sink down), then the pending
    // `[ORDER]` assignment rows in their listed sequence at the bottom.
    return [...filtered].sort((a, b) => {
      const aDone = isDeliveredRow(a);
      const bDone = isDeliveredRow(b);
      if (aDone !== bDone) return aDone ? -1 : 1;
      if (aDone) {
        return (
          (Number(b.serialNo) || 0) - (Number(a.serialNo) || 0) ||
          Number(b.id) - Number(a.id)
        );
      }
      return (
        (Number(a.serialNo) || 0) - (Number(b.serialNo) || 0) ||
        Number(a.id) - Number(b.id)
      );
    });
  }, [safeRows, searchTerm]);

  const totalPages = useMemo<number>(() => Math.ceil(displayRows.length / itemsPerPage), [displayRows.length, itemsPerPage]);

  const currentRows = useMemo<ShopDelivery[]>(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayRows.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRows, currentPage, itemsPerPage]);

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
        undefined,
        undefined,
        undefined,
        safeTrip?.driverName || undefined,
        undefined,
        {
          supervisorId: safeTrip?.supervisorId,
          driverId: safeTrip?.driverId,
        }
      );
    } catch (error: any) {
      console.error("PDF download failed:", error);
      setToast({ message: t("ops.trip.failed_pdf_report"), type: "error" });
    }
  };

  return (
    <div className="w-full space-y-4">
      <style>{`
        .no-spinner::-webkit-inner-spin-button,.no-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.no-spinner{-moz-appearance:textfield}
      `}</style>

      {/* ─── SEARCH & ACTION HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          {/* Search Bar */}
          <div className="relative w-full sm:w-80 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t("ops.trip.search_shop_bird")}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-500 transition-all shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={t("ops.trip.clear_search")}
                className="group absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={13} className={uiActionIconMotionClass.close} />
              </button>
            )}
          </div>
        </div>

        {/* Right Side Header Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleDownloadShopsPDF}
            className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50/70 hover:bg-blue-50/70 border border-blue-100 text-blue-500 text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            aria-label={t("ops.trip.shops_pdf_title")}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}><FileText size={15} className="text-blue-500" /></span>
            <span>{t("ops.trip.shops")} ({pendingShopsCount})</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBoxesPDF}
            className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50/70 hover:bg-emerald-50/70 border border-emerald-100 text-emerald-500 text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            aria-label={t("ops.trip.boxes_pdf_title")}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}><Box size={15} className="text-emerald-500" /></span>
            <span>{t("ops.trip.boxes")} ({remainingBoxesCount})</span>
          </button>

          {!readOnly && !showForm && (
            <button
              type="button"
              onClick={openAddForm}
              className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
              aria-label={t("ops.trip.add_shop")}
            >
              <Plus size={15} className="text-emerald-100" />
              <span>{t("ops.trip.add_shop")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── TOP KPI SUMMARY — same font as StepKpiCard (all steps) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[minmax(210px,1.25fr)_repeat(5,minmax(0,1fr))] gap-3">
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-indigo-50/70 text-indigo-500 flex items-center justify-center shrink-0">
              <Clock size={12} />
            </span>
            <span className="truncate">{t("ops.trip.captured_time")}</span>
          </span>
          <TripTimestampDisplay
            value={topKpiTotals.lastCaptureTime === "—" ? "" : formatTripViewStamp(topKpiTotals.lastCaptureTime, language)}
            empty="—"
          />
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-blue-50/70 text-blue-500 flex items-center justify-center shrink-0">
              <Building2 size={12} />
            </span>
            <span className="truncate">{t("ops.trip.shops")}</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-500" title={t("ops.trip.weight_mode")}>
              <Scale size={13} className="text-purple-500" /> {weightModeCount}
            </span>
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500" title={t("ops.trip.box_mode")}>
              <Box size={13} className="text-blue-500" /> {boxModeCount}
            </span>
            <span className="text-sm font-bold text-slate-800 ml-auto">{boxModeCount + weightModeCount}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-emerald-50/70 text-emerald-500 flex items-center justify-center shrink-0">
              <Users size={12} />
            </span>
            <span className="truncate">{t("common.birds")}</span>
          </span>
          <span className="block text-sm font-bold text-slate-800">{topKpiTotals.birds || "—"}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-emerald-50/70 text-emerald-500 flex items-center justify-center shrink-0">
              <Scale size={12} />
            </span>
            <span className="truncate">{t("ops.trip.weight_kg")}</span>
          </span>
          <span className="block text-sm font-bold text-slate-800">
            {topKpiTotals.weight ? topKpiTotals.weight.toFixed(2) : "—"}
          </span>
        </div>
        {/* Mortality — same layout as Shops: Weight · Box · cumulative birds */}
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-rose-50/70 text-rose-500 flex items-center justify-center shrink-0">
              <AlertCircle size={12} />
            </span>
            <span className="truncate">{t("ops.trip.mortality")}</span>
          </span>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-500 tabular-nums"
              title={t("ops.trip.weight_mode")}
            >
              <Scale size={13} className="text-purple-500 shrink-0" />
              {topKpiTotals.weightMortality}
            </span>
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 tabular-nums min-w-0"
              title={
                topKpiTotals.mortKg > 0
                  ? `${t("ops.trip.box_mode")} · ${topKpiTotals.mortKg.toFixed(2)} ${t("common.kg")}`
                  : t("ops.trip.box_mode")
              }
            >
              <Box size={13} className="text-blue-500 shrink-0" />
              {topKpiTotals.boxMortality}
              {topKpiTotals.mortKg > 0 ? (
                <span className="text-[10px] font-bold text-blue-400/90 truncate">
                  · {topKpiTotals.mortKg.toFixed(2)} {t("common.kg")}
                </span>
              ) : null}
            </span>
            <span className="text-sm font-bold text-slate-800 ml-auto tabular-nums">
              {topKpiTotals.mortality > 0 ? topKpiTotals.mortality : "—"}
            </span>
          </div>
        </div>
        {/* Weight loss — weight mode deliveries only */}
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-amber-50/70 text-amber-500 flex items-center justify-center shrink-0">
              <Scale size={12} />
            </span>
            <span className="truncate">{t("ops.trip.kpi_weight_loss")}</span>
          </span>
          <span className="block text-sm font-bold text-slate-800 tabular-nums">
            {topKpiTotals.weightLoss > 0 ? `${topKpiTotals.weightLoss.toFixed(2)} ${t("common.kg")}` : "—"}
          </span>
        </div>
      </div>

      {/* Keep the delivery table mounted and visible beneath the modal. */}
      {showForm && createPortal(
        <div
          className="fixed bottom-0 right-0 z-[70] flex items-center justify-center overflow-y-auto p-3 sm:p-5"
          style={{
            top: 64,
            left: modalLeftInset,
            backgroundColor: "rgba(15, 23, 42, 0.01)",
          }}
          role="presentation"
        >
          <div role="dialog" aria-modal="true" aria-label={editingId !== null ? t("ops.trip.edit_shop_delivery") : t("ops.trip.add_new_shop_delivery")} className="my-auto w-full max-w-6xl max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl shadow-2xl shadow-slate-900/15">
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
          weightLoss={weightLoss}
          usedBoxIds={usedBoxIds}
          safeBoxDetails={availableBoxDetails}
          readOnly={false}
          autoCaptureTime={autoCaptureTime}
          editingId={editingId}
          onClose={closeForm}
          onSubmit={handleSubmit}
          handleShopSelect={handleShopSelect}
          handleBirdSelect={handleBirdSelect}
          handleBoxSelection={handleBoxSelection}
          handleFormChange={handleFormChange}
          shopOptions={shopOptions}
          birdOptions={birdOptions}
          isFormValid={isFormValid}
          showActions={true}
          />
          </div>
        </div>,
        document.body,
      )}
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
                      <p className="font-medium text-slate-600">{t("ops.trip.no_matching_shops")}</p>
                      <p className="text-xs text-slate-400">
                        {t("ops.trip.try_another_keyword")}{" "}
                        <button onClick={clearSearch} className="font-semibold text-emerald-500 hover:underline">
                          {t("ops.trip.clear_search")}
                        </button>.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-600">{t("ops.trip.no_shops_added")}</p>
                      {!readOnly && (
                        <p className="text-xs text-slate-400">
                          {t("ops.trip.click_add_shop")} <span className="font-semibold text-emerald-500">{t("ops.trip.add_shop")}</span> {t("ops.trip.to_begin")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                {/* Time column removed from the UI; former width is shared equally across the data columns. autoCaptureTime stays on each row for PDF/API. */}
                <div className="grid min-w-[1000px] grid-cols-[3.5rem_4rem_minmax(11rem,1.35fr)_repeat(5,minmax(0,1fr))_8.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <span className="text-center">S.No</span><span className="text-center">Mode</span><span>Shop / Sub Shop / Remarks</span><span className="text-center">Boxes</span><span className="text-center">Birds</span><span className="text-center">Weight (kg)</span><span className="text-center">W.L (kg)</span><span className="text-center">Mortality</span><span className="text-right">Actions</span>
                </div>
                {currentRows.map((row) => {
                  const emailStatus = emailEffectiveStatus?.(row.id) ?? "pending";
                  const whatsappStatus = whatsappEffectiveStatus?.(row.id) ?? "pending";
                  return (
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
                      communicationEnabled={showCommunicationStatus}
                      emailStatus={emailStatus}
                      emailSending={(emailBusyIds?.has(row.id) ?? false) || emailStatus === "sending"}
                      emailSendCount={emailSendCountFor?.(row.id) ?? 0}
                      emailDisabled={emailIsBulkSending}
                      emailFailureReason={emailFailureReasonFor?.(row.id) ?? null}
                      onSendEmail={onSendOneEmail}
                      whatsappStatus={whatsappStatus}
                      whatsappSending={(whatsappBusyIds?.has(row.id) ?? false) || whatsappStatus === "sending"}
                      whatsappSendCount={whatsappSendCountFor?.(row.id) ?? 0}
                      whatsappDisabled={whatsappIsBulkSending}
                      whatsappFailureReason={whatsappFailureReasonFor?.(row.id) ?? null}
                      onSendWhatsApp={onSendOneWhatsApp}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {shouldShowPagination(displayRows.length) && (
          <TripPagination
            key={totalPages}
            currentPage={currentPage}
            totalPages={Math.max(totalPages, 1)}
            onPageChange={setCurrentPage}
            pageSize={itemsPerPage}
            onPageSizeChange={(size) => {
              setItemsPerPage(size);
              setCurrentPage(1);
            }}
          />
          )}
        </>

      {/* ─── BOTTOM ACTION BAR (same as Steps 3 / 5 — no extra card) ─── */}
      {!showForm && !readOnly && (
        <>
          {showBalanceError && balanceError && (
            <DeliveryBalanceErrorPanel
              error={balanceError}
              onClose={() => setShowBalanceError(false)}
            />
          )}
          <WizardActionBar
            notice={
              toast
                ? { type: toast.type === "warning" ? "info" : toast.type, message: toast.message }
                : null
            }
            dirty={hasUnsavedChanges}
            onCancel={handleCloseView}
            onSave={saveDeliveries ? handleSaveProgress : undefined}
            onSubmit={handleSubmitOrUpdateDeliveries}
            busy={isSaving || isSubmitting}
            saveDisabled={false}
            submitDisabled={safeRows.length === 0}
            submitLabel={hasBeenSubmitted ? "ops.trip.update_deliveries" : "ops.trip.submit_deliveries"}
          />
        </>
      )}

      <TripStepConfirmDialog
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
