// src/modules/operations/vehicle-trips/utils/generateShopPDF.ts
// (Referenced helper or included components as part of UnLoadingTable module)

// src/modules/operations/vehicle-trips/components/Step_4/UnLoadingTable.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, Clock, Building2, Users, Scale, AlertCircle, Search, X, 
  AlertTriangle, FileText, Box
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
import { pendingBoxesFromRows, shopIdsFromRows } from "./remainingBoxes";
import { computeDeliveryKpiTotals } from "./deliveryKpis";
import { formatIstStamp } from "../../services/tripHeaderApiService";
import { formatTripViewStamp, localizeTripViewText } from "../../utils/tripViewLocalization";
import type { DeliveriesBalanceError } from "../../../../../shared/trip/validation";
import type { ShopDelivery, BoxDetail, Trip } from "../../types/trip";
import type { DeliveryEmailStatusValue } from "../../services/deliveryEmailService";
import type { DeliveryWhatsAppStatusValue } from "../../services/deliveryWhatsAppService";
import { WizardActionBar, WizardStepNotice } from "../WizardStepUI";
import { useI18n } from "../../../../../i18n";
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
  saveDeliveries?: () => Promise<boolean>;
  submitDeliveries?: () => boolean | Promise<boolean>;
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

// ─── Confirmation Modal Component ───────────────────────────────────
function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "ops.trip.yes_proceed",
  cancelLabel = "common.cancel",
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
  const { t } = useI18n();
  if (!isOpen) return null;

  const iconColor = type === "warning" ? "text-amber-500" : "text-emerald-500";
  const borderColor = type === "warning" ? "border-amber-100" : "border-emerald-100";
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
            className="h-10 px-5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-xs inline-flex items-center justify-center shrink-0"
          >
            {t(cancelLabel)}
          </button>
          <button
            onClick={onConfirm}
            className={`h-10 px-5 rounded-lg text-sm font-bold text-white shadow-xs transition-all active:scale-[0.98] inline-flex items-center justify-center shrink-0 ${
              type === "warning"
                ? "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500"
                : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {t(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Balance Mismatch Panel ─────────────────────────────────────

/** A delivery row is "captured / delivered" once it stops being a pending
 *  `[ORDER]` assignment row and carries actual delivery data (selected boxes,
 *  birds, weight), or the backend already recorded its capture time. */
function isDeliveredRow(row: ShopDelivery): boolean {
  const extra = row as ShopDelivery & { autoCaptureTime?: string };
  if (extra.autoCaptureTime) return true;
  const remarks = String(row.remarks ?? "").trim();
  if (remarks.startsWith("[ORDER]")) return false;
  const boxes = Array.isArray(row.selectedBoxIds) ? row.selectedBoxIds.length : 0;
  return boxes > 0 || Number(row.birds) > 0 || Number(row.weight) > 0;
}

/** Delivered-shop identity keyed by BOTH shop id and shop name, so a row whose
 *  id does not resolve still matches by name (and vice versa). */
function buildDeliveredShopKeys(rows: ShopDelivery[]): {
  ids: Set<number>;
  names: Set<string>;
} {
  const ids = new Set<number>();
  const names = new Set<string>();
  rows.forEach((row) => {
    if (!isDeliveredRow(row)) return;
    const id = Number(row.shopId);
    if (id > 0) ids.add(id);
    const name = String(row.shopName ?? "").trim().toLowerCase();
    if (name) names.add(name);
  });
  return { ids, names };
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
  const { ids: assignedIds, order: assignedOrder } = shopIdsFromRows(rows);

  // Only order-assignment shops belong on the sheet. When a trip has no
  // assignment rows yet (plain manual trip), fall back to the full list.
  const source =
    assignedIds.size > 0
      ? (shops || []).filter((shop: any) =>
          assignedIds.has(Number(shop.id ?? shop.shopId ?? 0))
        )
      : (shops || []);

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
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const hasUnsavedChanges = JSON.stringify(safeRows) !== JSON.stringify(persistedRows ?? []);

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
  // Live route counts for the header buttons: Shops = still-to-deliver shops,
  // Boxes = still-available pickup boxes. Both shrink as deliveries are made.
  const pendingShopsCount = useMemo(() => {
    if (!safeShops || safeShops.length === 0) return 0;
    const { ids, names } = buildDeliveredShopKeys(safeRows);
    const { ids: assignedIds } = shopIdsFromRows(safeRows);
    // Only order-assignment shops are counted. When there are no assignment
    // rows yet, fall back to the full master list.
    const source =
      assignedIds.size > 0
        ? safeShops.filter((shop: any) =>
            assignedIds.has(Number(shop.id ?? shop.shopId ?? 0))
          )
        : safeShops;
    return source.filter((shop: any) => {
      const id = Number(shop.id ?? shop.shopId ?? 0);
      const name = String(shop.shopName ?? shop.name ?? "").trim().toLowerCase();
      const delivered = (id > 0 && ids.has(id)) || (Boolean(name) && names.has(name));
      return !delivered;
    }).length;
  }, [safeShops, safeRows, language]);

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
      const success = await saveDeliveries();
      if (success) {
        setToast({ message: t("ops.trip.progress_saved"), type: "success" });
      } else {
        setToast({ message: t("ops.trip.failed_save_delivery"), type: "error" });
      }
    } catch (error) {
      console.error("Save progress error:", error);
      setToast({ message: t("ops.trip.failed_save_delivery"), type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Submit / Update Deliveries Handler ──────────────────────────
  const handleSubmitOrUpdateDeliveries = () => {
    if (readOnly || isSubmitting) return;

    // Field-level balance rules block submission BEFORE any confirmation —
    // the inline panel below the table explains exactly what is wrong.
    if (balanceError) {
      setShowBalanceError(true);
      return;
    }

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
          void (async () => {
            if (submitLockRef.current || isSubmitting) return;
            submitLockRef.current = true;
            setIsSubmitting(true);
            try {
              let success = true;
              if (submitDeliveries) {
                success = (await submitDeliveries()) !== false;
              } else if (updateDeliveries) {
                updateDeliveries(safeRows);
              }
              if (success) {
                setHasBeenSubmitted(true);
                setToast({ message: t("ops.trip.step4_submitted"), type: "success" });
                if (showForm) closeForm();
                // Do not call onClose — parent advances to Step 5 with the same trip.
              } else {
                setToast({ message: t("ops.trip.failed_submit_delivery"), type: "error" });
              }
            } finally {
              submitLockRef.current = false;
              setIsSubmitting(false);
            }
          })();
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
          void (async () => {
            if (submitLockRef.current || isSubmitting) return;
            submitLockRef.current = true;
            setIsSubmitting(true);
            try {
              const success = submitDeliveries ? (await submitDeliveries()) !== false : false;
              if (success) {
                setHasBeenSubmitted(true);
                setToast({ message: t("ops.trip.step4_submitted"), type: "success" });
                if (showForm) closeForm();
              }
            } finally {
              submitLockRef.current = false;
              setIsSubmitting(false);
            }
          })();
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
    setFormData({ ...EMPTY_DELIVERY_FORM, birdTypeId, birdType });
    setShowForm(true);
  };

  const openEditForm = (row: ShopDelivery) => {
    const rowWithExtra = row as any;
    setEditingId(row.id);
    setMode(rowWithExtra.deliveryMode || "box");
    setAutoCaptureTime(rowWithExtra.autoCaptureTime || "");
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
      clientKey: editingId
        ? (safeRows.find((r) => r.id === editingId) as ShopDelivery | undefined)?.clientKey || `ck-${editingId}`
        : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ck-${Date.now()}`),
      // Each shop captures its OWN time at the moment its delivery is saved.
      // The capture time is IMMUTABLE: an edit preserves the original value
      // and never re-stamps it.
      autoCaptureTime: editingId !== null
        ? (autoCaptureTime || (safeRows.find((r) => r.id === editingId) as any)?.autoCaptureTime || undefined)
        : formatIstStamp(new Date().toISOString()),
    };

    if (editingId !== null) {
      setRows((prev) => prev.map((r) => (r.id === editingId ? newRow : r)));
      if (onSaveRow) onSaveRow(newRow);
    } else {
      if (onSaveRow) onSaveRow(newRow);
      setRows((prev) => [newRow, ...prev]);
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
    // Delivered shops are matched by BOTH shop id and shop name.
    const { ids: deliveredIds, names: deliveredNames } = buildDeliveredShopKeys(safeRows);
    const { ids: assignedIds, order: assignedOrder } = shopIdsFromRows(safeRows);

    // Only the ORDER-ASSIGNMENT shops are offered — not the whole master list.
    // Fall back to all shops when there are no assignment rows yet.
    const source =
      assignedIds.size > 0
        ? safeShops.filter((shop: any) =>
            assignedIds.has(Number(shop.id ?? shop.shopId ?? 0))
          )
        : safeShops;

    const isDeliveredShop = (shop: any) => {
      const id = Number(shop.id ?? shop.shopId ?? 0);
      const name = String(shop.shopName ?? shop.name ?? "").trim().toLowerCase();
      return (id > 0 && deliveredIds.has(id)) || (Boolean(name) && deliveredNames.has(name));
    };

    const opts = source
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

    // Delivery queue ordering: pending assignment shops first in their route
    // (`serialNo`) order; then already-delivered shops (kept selectable so a
    // shop can be captured again in the other mode), sorted ALPHABETICALLY.
    const isPendingPriority = (o: { value: number; label: string }) => {
      const id = Number(o.value);
      const shop = source.find((s: any) => Number(s.id ?? s.shopId ?? 0) === id);
      if (!shop) return false;
      return assignedOrder.has(id) && !isDeliveredShop(shop);
    };
    const orderOf = (o: { value: number; label: string }) =>
      assignedOrder.get(Number(o.value));
    opts.sort(
      (
        a: { value: number; label: string; isDisabled: boolean },
        b: { value: number; label: string; isDisabled: boolean }
      ) => {
        const aPrio = isPendingPriority(a);
        const bPrio = isPendingPriority(b);
        if (aPrio !== bPrio) return aPrio ? -1 : 1;
        // Only PENDING shops follow route order; completed shops fall back to
        // a stable alphabetical order below.
        if (aPrio && bPrio) {
          const aOrder = orderOf(a);
          const bOrder = orderOf(b);
          if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
            return aOrder - bOrder;
          }
        }
        return a.label.localeCompare(b.label);
      }
    );
    return opts;
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
      return (
        formData.shopId > 0 &&
        formData.birdTypeId > 0 &&
        formData.selectedBoxIds.length > 0 &&
        Number(formData.birds) > 0 &&
        Number(formData.weight) > 0 &&
        formData.mortality >= 0 &&
        formData.mortWeight >= 0 &&
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
        undefined
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
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500">
              <Box size={13} className="text-blue-500" /> {boxModeCount}
            </span>
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-500">
              <Scale size={13} className="text-purple-500" /> {weightModeCount}
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
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-rose-50/70 text-rose-500 flex items-center justify-center shrink-0">
              <AlertCircle size={12} />
            </span>
            <span className="truncate">{t("operations.mortality_count")}</span>
          </span>
          <span className="block text-sm font-bold text-slate-800">
            {topKpiTotals.mortality > 0 ? `${topKpiTotals.mortality} ${t("common.birds")}` : "—"}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-rose-50/70 text-rose-500 flex items-center justify-center shrink-0">
              <Scale size={12} />
            </span>
            <span className="truncate">{t("ops.trip.mortality_weight")}</span>
          </span>
          <span className="block text-sm font-bold text-slate-800">
            {topKpiTotals.mortKg > 0 ? `${topKpiTotals.mortKg.toFixed(2)} ${t("common.kg")}` : "—"}
          </span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      )}

      {/* ─── BOTTOM ACTION CONTROL BAR (ONLY VISIBLE IN UNLOCKED/EDIT MODE) ─── */}
      {!showForm && !readOnly && (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          {showBalanceError && balanceError && (
            <div className="mb-3">
              <DeliveryBalanceErrorPanel
                error={balanceError}
                onClose={() => setShowBalanceError(false)}
              />
            </div>
          )}
          <WizardStepNotice
            notice={
              toast
                ? { type: toast.type === "warning" ? "info" : toast.type, message: toast.message }
                : hasUnsavedChanges
                  ? { type: "info", message: t("ops.trip.unsaved_changes") }
                  : null
            }
            dirty={false}
          />
          <WizardActionBar
            onCancel={handleCloseView}
            onSave={saveDeliveries ? handleSaveProgress : undefined}
            onSubmit={handleSubmitOrUpdateDeliveries}
            busy={isSaving || isSubmitting}
            saveDisabled={false}
            submitDisabled={safeRows.length === 0}
            submitLabel={hasBeenSubmitted ? "ops.trip.update_deliveries" : "ops.trip.submit_deliveries"}
          />
        </div>
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