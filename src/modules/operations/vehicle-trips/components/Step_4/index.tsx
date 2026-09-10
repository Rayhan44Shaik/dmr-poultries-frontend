// src/modules/operations/vehicle-trips/utils/generateShopPDF.ts
// (Referenced helper or included components as part of UnLoadingTable module)

import { useRef } from "react";
// src/modules/operations/vehicle-trips/components/Step_4/UnLoadingTable.tsx
import React, { useState, useEffect, useMemo } from "react";
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
import { generateShopsDeliveryReportPDF, generateBoxesDeliveryReportPDF } from "../../utils/generateDeliveryReportsPDF";
import { assignedShopIdsFromRows } from "./remainingBoxes";
import { computeDeliveryKpiTotals } from "./deliveryKpis";
import type { DeliveriesBalanceError } from "../../../../../shared/trip/validation";
import type { ShopDelivery, BoxDetail } from "../../types/trip";
import { WizardActionBar, WizardStepNotice } from "../WizardStepUI";
import { useI18n } from "../../../../../i18n";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
  boxDetails?: BoxDetail[];
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

  const iconColor = type === "warning" ? "text-amber-600" : "text-emerald-600";
  const borderColor = type === "warning" ? "border-amber-200" : "border-emerald-200";
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
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                : "bg-emerald-600 hover:bg-emerald-700"
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
function DeliveryBalanceErrorPanel({ error }: { error: NonNullable<DeliveriesBalanceError> }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2">
      <p className="text-sm font-bold text-red-800 flex items-center gap-1.5">
        <AlertCircle size={15} className="text-red-600" /> {t("ops.trip.balance_mismatch_fix")}
      </p>
      {error.birds && (
        <div className="text-xs text-red-800 space-y-0.5">
          <p className="font-semibold">{t("common.birds")}</p>
          <p className="pl-3">{t("ops.trip.pickup")}: <span className="font-bold">{error.birds.pickup}</span></p>
          <p className="pl-3">
            {t("ops.trip.delivered")}: <span className="font-bold">{error.birds.delivered}</span> + {t("operations.mortality_count")}:{" "}
            <span className="font-bold">{error.birds.mortality}</span> ={" "}
            <span className="font-bold">{error.birds.delivered + error.birds.mortality}</span>
          </p>
          <p className="pl-3 text-red-700">
            {t("ops.trip.pickup_must_equal", { pickup: error.birds.pickup, total: error.birds.delivered + error.birds.mortality })}
          </p>
        </div>
      )}
      {error.weight && (
        <div className="text-xs text-red-800 space-y-0.5">
          <p className="font-semibold">{t("common.weight")}</p>
          <p className="pl-3">{t("ops.trip.farm")}: <span className="font-bold">{error.weight.farm.toFixed(2)} kg</span></p>
          <p className="pl-3">{t("ops.trip.delivered")}: <span className="font-bold">{error.weight.delivered.toFixed(2)} kg</span></p>
          <p className="pl-3">{t("operations.mortality_count")}: <span className="font-bold">{error.weight.mortalityWeight.toFixed(2)} kg</span></p>
          <p className="pl-3">{t("ops.trip.loss")}: <span className="font-bold">{error.weight.loss.toFixed(2)} kg</span></p>
          <p className="pl-3">
            {t("ops.trip.expected")}: <span className="font-bold">{error.weight.expected.toFixed(2)} kg</span>
          </p>
          <p className="pl-3 text-red-700">
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
}: Props) {
  const { t } = useI18n();
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];

  // Cache the last known good boxDetails to prevent stale/empty boxDetails from API responses
  const boxDetailsRef = useRef<BoxDetail[]>([]);
  if (boxDetails && boxDetails.length > 0) {
    boxDetailsRef.current = boxDetails;
  }
  const safeBoxDetails = boxDetailsRef.current.length > 0 ? boxDetailsRef.current : (boxDetails ?? []);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage =6;
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
  const assignedShopIds = useMemo(() => assignedShopIdsFromRows(safeRows), [safeRows]);

  // ─── Balance Error Panel visibility (shown after a blocked submit) ──
  const [showBalanceError, setShowBalanceError] = useState<boolean>(balanceErrorShown);

  useEffect(() => {
    if (balanceError == null) setShowBalanceError(false);
  }, [balanceError, safeRows, safeBoxDetails]);

  // ─── Step 4 PDF exports (separate Shop + Box reports) ───────────
  const reportContext = {
    tripNo,
    tripDate,
    vehicleNo,
    supervisorName,
  };

  const handleDownloadShopsPDF = async () => {
    try {
      await generateShopsDeliveryReportPDF({
        rows: safeRows,
        shops: safeShops,
        context: reportContext,
      });
      setToast({ message: t("ops.trip.shops_pdf_ok"), type: "success" });
    } catch (error: any) {
      console.error("Shops report failed:", error);
      setToast({ message: t("ops.trip.failed_pdf_report"), type: "error" });
    }
  };

  const handleDownloadBoxesPDF = async () => {
    try {
      await generateBoxesDeliveryReportPDF({
        boxDetails: safeBoxDetails,
        deliveries: safeRows,
        context: reportContext,
      });
      setToast({ message: t("ops.trip.boxes_pdf_ok"), type: "success" });
    } catch (error: any) {
      console.error("Boxes report failed:", error);
      setToast({ message: t("ops.trip.failed_pdf_report"), type: "error" });
    }
  };

  // ─── Manual Save Progress Handler ──────────────────────────────
  const handleSaveProgress = async () => {
    if (readOnly || !saveDeliveries) return;
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
            if (isSubmitting) return;
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
            if (isSubmitting) return;
            setIsSubmitting(true);
            try {
              const success = submitDeliveries ? (await submitDeliveries()) !== false : false;
              if (success) {
                setHasBeenSubmitted(true);
                setToast({ message: t("ops.trip.step4_submitted"), type: "success" });
                if (showForm) closeForm();
              }
            } finally {
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
    setAutoCaptureTime(rowWithExtra.autoCaptureTime || new Date().toLocaleString());
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
      // A NEW delivery captures its time exactly when it is saved; an EDIT
      // preserves the originally captured time.
      autoCaptureTime: editingId !== null
        ? (autoCaptureTime || (safeRows.find((r) => r.id === editingId) as any)?.autoCaptureTime || undefined)
        : new Date().toLocaleString(),
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
    // Shops that have already been captured (delivered) are pushed to the
    // BOTTOM of the dropdown so the NEXT shop to deliver always sits on top.
    // Pending (not-yet-delivered) shops stay first, alphabetically. A shop is
    // "delivered" once it has a captured row (autoCaptureTime), so `[ORDER]`
    // assignment-plan rows — which carry ordered birds/weight but no capture —
    // still count as pending (same rule as pendingShopsFromRows).
    const deliveredShopIds = new Set<number>(
      safeRows
        .filter((r: any) => Number(r.shopId) > 0 && Boolean(r.autoCaptureTime))
        .map((r: any) => Number(r.shopId))
    );
    const opts = safeShops
      .filter((shop: any) => {
        const status = String(shop.status ?? "Active");
        const id = shop.id ?? shop.shopId ?? 0;
        if (status === "Active") return true;
        return safeRows.some((r) => Number(r.shopId) === Number(id));
      })
      .map((shop: any) => {
        const value = shop.id ?? shop.shopId ?? 0;
        const label = shop.shopName ?? shop.name ?? `Shop ${value}`;
        return { value, label, isDisabled: false };
      })
      .filter((opt: { value: number; label: string; isDisabled: boolean }) => opt.value > 0);
    // Delivery route ordering (priority → alphabetical → delivered sinks down):
    //   • The FIRST 10 shops in the master list are the priority route — while
    //     pending they sit at the very top in their listed order, so the next
    //     shop to deliver is always the next priority shop.
    //   • The REMAINING pending shops follow, alphabetically.
    //   • Once a shop is captured (delivered) it moves to the BOTTOM (the
    //     delivered group), so the queue advances shop by shop.
    const priorityRank = new Map<number, number>();
    safeShops.slice(0, 10).forEach((shop: any, idx: number) => {
      const id = Number(shop.id ?? shop.shopId ?? 0);
      if (id > 0) priorityRank.set(id, idx);
    });
    const rankOf = (value: number) => priorityRank.get(value) ?? null;
    opts.sort(
      (
        a: { value: number; label: string; isDisabled: boolean },
        b: { value: number; label: string; isDisabled: boolean }
      ) => {
        const aDone = deliveredShopIds.has(Number(a.value)) ? 1 : 0;
        const bDone = deliveredShopIds.has(Number(b.value)) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        if (!aDone) {
          const ap = rankOf(Number(a.value));
          const bp = rankOf(Number(b.value));
          if (ap != null && bp != null) return ap - bp;
          if (ap != null) return -1;
          if (bp != null) return 1;
        }
        return a.label.localeCompare(b.label);
      }
    );
    return opts;
  }, [safeShops, safeRows]);

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
        const label = bird.birdType ?? bird.name ?? `Bird ${value}`;
        return { value, label, isDisabled: false };
      })
      .filter((opt: { value: number; label: string; isDisabled: boolean }) => opt.value > 0);
  }, [safeBirdTypes, tripBirdTypeId]);

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

  // ─── Filtered Search & Pagination ──────────────────────────────
  const displayRows = useMemo<ShopDelivery[]>(() => {
    // Show fully-entered deliveries, plus Orders assignment plan rows that are
    // still awaiting their Step 4 delivery. Those carry the `[ORDER]` marker
    // and land here with weight 0 / no box selection until the supervisor
    // delivers them — they must be visible so the assigned route can be
    // fulfilled shop by shop (they persist regardless; this filter is only
    // what the card list renders).
    const saved = safeRows.filter(
      (r: ShopDelivery) =>
        r.shopId > 0 &&
        ((r.birds > 0 && r.weight > 0) ||
          String(r.remarks ?? "").trim().startsWith("[ORDER]"))
    );

    const filtered = saved.filter((r: ShopDelivery) => {
      if (!searchTerm.trim()) return true;
      const query = searchTerm.toLowerCase();
      const shopNameMatch = (r.shopName || "").toLowerCase().includes(query);
      const birdTypeMatch = (r.birdType || "").toLowerCase().includes(query);
      const remarksMatch = (r.remarks || "").toLowerCase().includes(query);
      return shopNameMatch || birdTypeMatch || remarksMatch;
    });

    return [...filtered].sort(
      (a, b) => (Number(a.serialNo) || 0) - (Number(b.serialNo) || 0) || Number(a.id) - Number(b.id)
    );
  }, [safeRows, searchTerm]);

  const totalPages = useMemo<number>(() => Math.ceil(displayRows.length / itemsPerPage), [displayRows.length]);

  const currentRows = useMemo<ShopDelivery[]>(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayRows.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRows, currentPage]);

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
          <div className="relative w-full sm:w-64 max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t("ops.trip.search_shop_bird")}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right Side Header Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleDownloadShopsPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 text-blue-800 text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            title={t("ops.trip.shops_pdf_title")}
          >
            <FileText size={15} className="text-blue-600" />
            <span>{t("ops.trip.shops")} ({safeShops.length})</span>
          </button>

          <button
            onClick={handleDownloadBoxesPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            title={t("ops.trip.boxes_pdf_title")}
          >
            <Box size={15} className="text-emerald-600" />
            <span>{t("ops.trip.boxes")} ({safeBoxDetails.length})</span>
          </button>

          {!readOnly && !showForm && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-full shadow-xs transition-all active:scale-95"
            >
              <Plus size={15} className="text-emerald-100" />
              <span>{t("ops.trip.add_shop")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── TOP KPI SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
            <Clock size={13} className="text-emerald-600" /> {t("ops.trip.captured_time")}
          </span>
          <span className="text-xs font-bold text-slate-800 mt-1 truncate" title={topKpiTotals.lastCaptureTime}>
            {topKpiTotals.lastCaptureTime}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Building2 size={13} className="text-slate-400" /> {t("ops.trip.shops")}
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.shops || "—"}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Users size={13} className="text-emerald-600" /> {t("common.birds")}
          </span>
          <span className="text-base font-bold text-slate-800">{topKpiTotals.birds || "—"}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Scale size={13} className="text-emerald-600" /> {t("ops.trip.weight_kg")}
          </span>
          <span className="text-base font-bold text-slate-800">
            {topKpiTotals.weight ? topKpiTotals.weight.toFixed(2) : "—"}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <AlertCircle size={13} className="text-rose-500" /> {t("operations.mortality_count")}
          </span>
          <span className="text-base font-bold text-slate-800">
            {topKpiTotals.mortality > 0 ? `${topKpiTotals.mortality} bird${topKpiTotals.mortality === 1 ? "" : "s"}` : "—"}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Scale size={13} className="text-rose-500" /> {t("ops.trip.mortality_weight")}
          </span>
          <span className="text-base font-bold text-slate-800">
            {topKpiTotals.mortKg > 0 ? `${topKpiTotals.mortKg.toFixed(2)} kg` : "—"}
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
                        <button onClick={clearSearch} className="font-semibold text-emerald-600 hover:underline">
                          {t("ops.trip.clear_search")}
                        </button>.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-600">{t("ops.trip.no_shops_added")}</p>
                      {!readOnly && (
                        <p className="text-xs text-slate-400">
                          {t("ops.trip.click_add_shop")} <span className="font-semibold text-emerald-600">{t("ops.trip.add_shop")}</span> {t("ops.trip.to_begin")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentRows.map((row) => (
                  <ShopDeliveryCard
                    key={row.id}
                    row={row as any}
                    readOnly={readOnly}
                    unassigned={
                      assignedShopIds.size > 0 && !assignedShopIds.has(Number(row.shopId))
                    }
                    onEdit={(selectedRow) => {
                      if (onEditShop) {
                        onEditShop(selectedRow.id);
                      } else {
                        openEditForm(selectedRow);
                      }
                    }}
                    onPDF={handleDownloadPDF}
                  />
                ))}
              </div>
            )}
          </div>

          {shouldShowPagination(displayRows.length) && (
          <TripPagination
            key={totalPages}
            currentPage={currentPage}
            totalPages={Math.max(totalPages, 1)}
            onPageChange={setCurrentPage}
          />
          )}
        </>
      )}

      {/* ─── BOTTOM ACTION CONTROL BAR (ONLY VISIBLE IN UNLOCKED/EDIT MODE) ─── */}
      {!showForm && !readOnly && (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          {showBalanceError && balanceError && (
            <div className="mb-3">
              <DeliveryBalanceErrorPanel error={balanceError} />
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