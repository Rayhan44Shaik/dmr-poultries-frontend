// src/modules/operations/vehicle-trips/components/Step_5/StepEnd.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Pencil,
  AlertTriangle,
  Receipt
} from "lucide-react";
import type { Trip } from "../../types/trip";
import { StepCloseButton, WizardActionBar, WizardStepNotice } from "../WizardStepUI";
import { TripNoBadge } from "../TripNoBadge";
import GeneralExpensesTable from "./GeneralExpensesTable";
import DieselExpensesTable from "./DieselExpensesTable";
import { useI18n } from "../../../../../i18n";
import { useStep5DurableDraft } from "../../hooks/useStep5DurableDraft";
import { performStep5Save } from "../../services/tripHeaderApiService";
import type { Step5DraftFields } from "../../../../../shared/trip/step5DraftStore";

// ─── ConfirmationModal ────────────────────────────────────────────
function ConfirmationModal({ isOpen, title, message, confirmLabel = "ops.trip.yes_proceed", cancelLabel = "common.cancel", onConfirm, onCancel, type = "warning" }: {
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
  const bgGradient = type === "warning" ? "from-amber-50 to-orange-50" : "from-emerald-50 to-teal-50";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border ${borderColor}`}>
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
          <button onClick={onCancel} className="h-10 px-5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-xs inline-flex items-center justify-center shrink-0">{t(cancelLabel)}</button>
          <button onClick={onConfirm} className={`h-10 px-5 rounded-lg text-sm font-bold text-white shadow-xs transition-all active:scale-[0.98] inline-flex items-center justify-center shrink-0 ${type === "warning" ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {t(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface SheetData extends Record<string, any> {
  vehicleNo: string;
  submittedAtTimestamp: string;
  advance: number | string;
  meals: number | string;
  loading: number | string;
  mealsTiffin: number | string;
  vehicleMaintenance: number | string;
  othersRC: number | string;
  others1Amt: number | string;
  others2Amt: number | string;
  others3Amt: number | string;
  others4Amt: number | string;
  others5Amt: number | string;
  startMeter: number | string;
  endMeter: number | string;
  destinationTolls: number | string;
  remarks: string;
}

interface Props {
  trip: Trip;
  setTrip?: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>, persist?: boolean, silent?: boolean) => void;
  submitExpensesStep?: (data: Partial<Trip>) => boolean | Promise<boolean>;
  saveEndProgress?: (data: Partial<Trip>) => Promise<boolean>;
  submitStartStep?: (data: Partial<Trip>) => boolean | Promise<boolean>;
  editable?: boolean;
  canEdit?: boolean;
  /** Bottom Cancel → leave wizard / Create New Trip. */
  onCancel?: () => void;
  /** Close while editing → locked submitted view. */
  onExitEdit?: () => void;
  clearForm?: () => void;
}

export default function StepEnd({
  trip,
  updateTrip: _updateTrip,
  submitExpensesStep,
  saveEndProgress,
  submitStartStep,
  editable = false,
  canEdit = true,
  onCancel,
  onExitEdit,
  clearForm,
}: Props) {
  const { t } = useI18n();
  // ─── State ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Parent `editable` (Recent Edit / step edit) opens the form immediately.
  const [isLocalEditing, setIsLocalEditing] = useState(Boolean(editable));
  useEffect(() => {
    if (editable) setIsLocalEditing(true);
  }, [editable, trip.id]);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
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

  // ─── Local isSubmitted state ─────────────────────────────────────
  const [isSubmittedLocal, setIsSubmittedLocal] = useState(false);
  const isSubmitted = Boolean((trip as any).expensesStepSubmitted || (trip as any).endStepSubmitted || isSubmittedLocal);

  // ─── Helper to build sheet data from trip ──────────────────────
  const buildSheetDataFromTrip = (tripData: Trip): SheetData => {
    const data: SheetData = {
      vehicleNo: tripData.vehicleNo || "",
      submittedAtTimestamp: (tripData as any).expensesStepSubmittedAt || (tripData as any).submittedAtTimestamp || (tripData as any).submittedAt || "",
      advance: tripData.advanceAmount ?? "",
      meals: (tripData as any).meals ?? "",
      loading: (tripData as any).loading ?? "",
      mealsTiffin: (tripData as any).mealsTiffin ?? "",
      vehicleMaintenance: (tripData as any).vehicleMaintenance ?? "",
      othersRC: (tripData as any).othersRC ?? "",
      others1Amt: (tripData as any).others1Amt ?? "",
      others2Amt: (tripData as any).others2Amt ?? "",
      others3Amt: (tripData as any).others3Amt ?? "",
      others4Amt: (tripData as any).others4Amt ?? "",
      others5Amt: (tripData as any).others5Amt ?? "",
      startMeter: tripData.openingMeter || 0,
      endMeter: (tripData as any).endMeter ?? (tripData as any).closingMeter ?? "",
      destinationTolls: (tripData as any).destinationTolls ?? (tripData as any).deliveryTolls ?? "",
      remarks: (tripData as any).remarks ?? "",
    };
    // Copy any already-flattened diesel* fields from the trip record.
    Object.keys(tripData).forEach(key => {
      if (key.startsWith("diesel")) {
        (data as any)[key] = (tripData as any)[key];
      }
    });
    // Hydrate dieselEntries[] → dieselLtr1 / dieselRate1 / … so the diesel
    // table shows sample fuel bills (incl. bill image) without a prior submit.
    const entries = Array.isArray(tripData.dieselEntries) ? tripData.dieselEntries : [];
    entries.forEach((entry, idx) => {
      // Unlimited diesel bills — use entry.rowIndex as-is (1-based).
      const raw = Number(entry.rowIndex);
      const n = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : idx + 1;
      const d = data as Record<string, unknown>;
      const empty = (v: unknown) => v == null || v === "";
      if (empty(d[`dieselLtr${n}`])) d[`dieselLtr${n}`] = entry.litres ?? "";
      if (empty(d[`dieselRate${n}`])) d[`dieselRate${n}`] = entry.rate ?? "";
      if (empty(d[`dieselMeter${n}`])) d[`dieselMeter${n}`] = entry.meter ?? "";
      if (empty(d[`dieselBunk${n}`])) d[`dieselBunk${n}`] = entry.bunkName ?? "";
      if (empty(d[`dieselGpsLat${n}`])) d[`dieselGpsLat${n}`] = entry.gpsLat ?? "";
      if (empty(d[`dieselGpsLon${n}`])) d[`dieselGpsLon${n}`] = entry.gpsLon ?? "";
      if (empty(d[`dieselGpsAccuracy${n}`])) d[`dieselGpsAccuracy${n}`] = entry.gpsAccuracy ?? "";
      if (empty(d[`dieselGpsCapturedAt${n}`])) d[`dieselGpsCapturedAt${n}`] = entry.gpsCapturedAt ?? "";
      // Always prefer real bill image from the entry when sheet slot is empty.
      if (empty(d[`dieselImage${n}`]) && entry.imageData) {
        d[`dieselImage${n}`] = entry.imageData;
        d[`dieselImageName${n}`] = entry.imageName ?? d[`dieselImageName${n}`] ?? "";
      } else if (empty(d[`dieselImageName${n}`]) && entry.imageName) {
        d[`dieselImageName${n}`] = entry.imageName;
      }
      if (empty(d[`dieselId${n}`])) d[`dieselId${n}`] = entry.id ?? "";
      if (empty(d[`dieselClientKey${n}`])) d[`dieselClientKey${n}`] = entry.clientKey ?? `diesel-${n}`;
      if (d[`dieselSubmitted${n}`] == null) d[`dieselSubmitted${n}`] = entry.submitted !== false;
      if (empty(d[`dieselSubmittedAt${n}`])) d[`dieselSubmittedAt${n}`] = entry.submittedAt ?? "";
    });
    return data;
  };

  // ─── Sheet Data state ───────────────────────────────────────────
  const [sheetData, setSheetData] = useState<SheetData>(() => buildSheetDataFromTrip(trip));

  // ─── Reset sheetData when trip changes ──────────────────────────
  const prevTripId = useRef<number>(trip.id);
  const dieselHydrateKey = Array.isArray(trip.dieselEntries)
    ? trip.dieselEntries
        .map((e) => `${e?.id ?? ""}:${String(e?.imageData || "").length}:${e?.litres ?? ""}`)
        .join("|")
    : "";
  useEffect(() => {
    if (trip.id !== prevTripId.current) {
      prevTripId.current = trip.id;
      setSheetData(buildSheetDataFromTrip(trip));
      setIsSubmittedLocal(false);
      setErrorMsg("");
      setIsLocalEditing(false);
      return;
    }
    // Same trip: if dieselEntries arrive/update (API load), merge bill images
    // without wiping user edits on other fields.
    if (!dieselHydrateKey) return;
    setSheetData((prev) => {
      const next = { ...prev } as SheetData;
      const entries = Array.isArray(trip.dieselEntries) ? trip.dieselEntries : [];
      let changed = false;
      entries.forEach((entry, idx) => {
        const raw = Number(entry.rowIndex);
        const n = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : idx + 1;
        const empty = (v: unknown) => v == null || v === "";
        if (empty(next[`dieselLtr${n}`]) && entry.litres != null) {
          next[`dieselLtr${n}`] = entry.litres as any;
          changed = true;
        }
        if (empty(next[`dieselRate${n}`]) && entry.rate != null) {
          next[`dieselRate${n}`] = entry.rate as any;
          changed = true;
        }
        if (empty(next[`dieselMeter${n}`]) && entry.meter != null) {
          next[`dieselMeter${n}`] = entry.meter as any;
          changed = true;
        }
        if (empty(next[`dieselBunk${n}`]) && entry.bunkName) {
          next[`dieselBunk${n}`] = entry.bunkName as any;
          changed = true;
        }
        if (empty(next[`dieselImage${n}`]) && entry.imageData) {
          next[`dieselImage${n}`] = entry.imageData as any;
          next[`dieselImageName${n}`] = (entry.imageName || next[`dieselImageName${n}`] || "") as any;
          changed = true;
        }
        if (empty(next[`dieselGpsLat${n}`]) && entry.gpsLat != null) {
          next[`dieselGpsLat${n}`] = entry.gpsLat as any;
          next[`dieselGpsLon${n}`] = entry.gpsLon as any;
          changed = true;
        }
        if (next[`dieselSubmitted${n}`] == null && entry.submitted !== false) {
          next[`dieselSubmitted${n}`] = true as any;
          changed = true;
        }
        if (empty(next[`dieselId${n}`]) && entry.id != null) {
          next[`dieselId${n}`] = entry.id as any;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [trip.id, trip, dieselHydrateKey]);

  // ─── Part K: durable local Step 5 draft + offline Save Progress queue ──
  const userTouchedRef = useRef(false);
  const restoredNotifiedRef = useRef(false);
  const step5Draft = useStep5DurableDraft({
    tripId: trip.id,
    tripNo: trip.tripNo,
    serverUpdatedAt: (trip as unknown as { updatedAt?: string | null }).updatedAt ?? null,
    enabled: trip.id > 0 && Boolean(trip.startStepSubmitted),
    performSave: useCallback(
      async (fields: Step5DraftFields) => {
        const r = await performStep5Save(trip.id, fields as Record<string, unknown>);
        return { ok: r.ok, serverUpdatedAt: r.serverUpdatedAt, retryable: r.retryable, error: r.error };
      },
      [trip.id]
    ),
  });
  const { restoredFields, recordEdit, saveProgress, discardDraft, isOffline } = step5Draft;

  // Restore unsaved local Step 5 edits (refresh / remount / tab return).
  useEffect(() => {
    if (!restoredFields) return;
    setSheetData((prev) => ({ ...prev, ...(restoredFields as Partial<SheetData>) }));
    userTouchedRef.current = true;
    if (!restoredNotifiedRef.current) {
      restoredNotifiedRef.current = true;
      setToast({ message: t("ops.trip.draft_restored"), type: "info" });
    }
  }, [restoredFields, t]);

  // Persist every edit to the durable draft (debounced inside the hook).
  useEffect(() => {
    if (userTouchedRef.current) recordEdit(sheetData as Step5DraftFields);
  }, [sheetData, recordEdit]);

  // ─── Compute Distance & Average ──────────────────────────────────
  const openingMeter = trip.openingMeter || 0;
  const destMeter = trip.destMeter || 0;
  const endMeterNum = Number(sheetData.endMeter);

  let totalDistanceCovered = 0;
  if (openingMeter > 0 && endMeterNum > 0 && endMeterNum > openingMeter) {
    totalDistanceCovered = endMeterNum - openingMeter;
  }

  // ─── Dynamically compute diesel totals from all rows ────────────
  const getDieselIndices = (data: SheetData): number[] => {
    const indices: number[] = [];
    Object.keys(data).forEach(key => {
      const match = key.match(/^dieselLtr(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (!indices.includes(idx)) indices.push(idx);
      }
    });
    return indices.sort((a,b) => a - b);
  };

  const dieselIndices = getDieselIndices(sheetData).filter((idx) => sheetData[`dieselSubmitted${idx}`]);
  const dieselAmounts = getDieselIndices(sheetData).map(idx => {
    const ltr = Number(sheetData[`dieselLtr${idx}`] || 0);
    const rate = Number(sheetData[`dieselRate${idx}`] || 0);
    return ltr * rate;
  });
  const totalDieselAmount = dieselIndices.reduce((acc, idx) => {
    const ltr = Number(sheetData[`dieselLtr${idx}`] || 0);
    const rate = Number(sheetData[`dieselRate${idx}`] || 0);
    return acc + ltr * rate;
  }, 0);
  const totalDieselLiters = dieselIndices.reduce((acc, idx) => acc + Number(sheetData[`dieselLtr${idx}`] || 0), 0);

  let averageKmLtr = "";
  if (totalDistanceCovered > 0 && totalDieselLiters > 0) {
    averageKmLtr = (totalDistanceCovered / totalDieselLiters).toFixed(2);
  }

  const savedSheetRef = useRef(JSON.stringify(buildSheetDataFromTrip(trip)));
  const hasUnsavedChanges = JSON.stringify(sheetData) !== savedSheetRef.current;

  // ─── Handle field changes in React state (mirrored to the durable draft) ──
  const handleChange = (field: string, value: any) => {
    setErrorMsg("");
    userTouchedRef.current = true;
    setSheetData((prev) => ({ ...prev, [field]: value }));
  };

  const applyBatchUpdates = (updates: Record<string, any>) => {
    setErrorMsg("");
    userTouchedRef.current = true;
    setSheetData((prev) => ({ ...prev, ...updates }));
  };

  // ─── Compute derived values ──────────────────────────────────────
  const totalExpenses1 =
    Number(sheetData.meals || 0) +
    Number(sheetData.loading || 0) +
    Number(sheetData.mealsTiffin || 0) +
    Number(sheetData.vehicleMaintenance || 0) +
    Number(sheetData.othersRC || 0);

  const totalExpenses2 =
    Number(sheetData.others1Amt || 0) +
    Number(sheetData.others2Amt || 0) +
    Number(sheetData.others3Amt || 0) +
    Number(sheetData.others4Amt || 0) +
    Number(sheetData.others5Amt || 0);

  const totalAllExpenses = totalExpenses1 + totalExpenses2;

  const remainingBalance =
    Number(trip.advanceAmount || 0) - totalAllExpenses - totalDieselAmount;

  /** Indian grouping: ₹1,000.00 / ₹1,00,000.00 */
  const formatInr = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const submittedTimeDisplay =
    sheetData.submittedAtTimestamp ||
    (trip as any).expensesStepSubmittedAt ||
    (trip as any).submittedAtTimestamp ||
    "";

  const highestDieselMeter = dieselIndices.reduce((max, idx) => {
    const val = Number(sheetData[`dieselMeter${idx}`] || 0);
    return val > max ? val : max;
  }, 0);
  const requiredMinEndMeter = Math.max(openingMeter, destMeter, highestDieselMeter, 0);
  const endMeterInvalid =
    sheetData.endMeter !== "" &&
    sheetData.endMeter != null &&
    requiredMinEndMeter > 0 &&
    Number(sheetData.endMeter) <= requiredMinEndMeter;

  const EXPENSE_KEYS = [
    "meals",
    "loading",
    "mealsTiffin",
    "vehicleMaintenance",
    "othersRC",
    "others1Amt",
    "others2Amt",
    "others3Amt",
    "others4Amt",
    "others5Amt",
  ] as const;

  // Part I: an expense that is cleared or set to 0 must persist as 0 — never
  // be dropped from the payload (which would leave the previous value in place).
  const expenseValue = (value: unknown): number => {
    if (value === "" || value == null) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const prepareFinalPayload = (stepSubmitted = false) => {
    const expenses: Record<string, number> = {};
    for (const key of EXPENSE_KEYS) {
      expenses[key] = expenseValue(sheetData[key]);
    }

    return {
      ...expenses,
      endMeter: sheetData.endMeter,
      closingMeter: Number(sheetData.endMeter) || 0,
      destinationTolls: sheetData.destinationTolls === "" ? 0 : Number(sheetData.destinationTolls),
      deliveryTolls: sheetData.destinationTolls === "" ? 0 : Number(sheetData.destinationTolls),
      remarks: sheetData.remarks,
      totalExpenses: totalAllExpenses,
      totalDieselAmount,
      remainingBalance,
      pickupTolls: trip.pickupTolls || 0,
      expensesStepSubmitted: stepSubmitted,
      endStepSubmitted: stepSubmitted,
    };
  };

  // ─── Save progress (manual) ──────────────────────────────────────
  // Part K: routed through the durable draft. Online -> real Save Progress,
  // reconcile, clear dirty on confirmed success. Offline / retryable failure
  // -> durable queued op + "Saved locally" (never claims the server save
  // succeeded). Never submits, never sets a completion timestamp, never moves
  // the trip to Pending. Works before Step 4 (Part H unchanged).
  const canDurable = trip.id > 0 && Boolean(trip.startStepSubmitted);
  const handleSaveProgress = async () => {
    setIsSubmitting(true);
    try {
      const canonical = prepareFinalPayload(false);
      if (canDurable) {
        // Persist EVERY editable Step 5 field (incl. diesel rows, zeros, cleared)
        // to the durable draft, then save the canonical payload.
        const fullFields = { ...sheetData, ...canonical } as Step5DraftFields;
        const res = await saveProgress(fullFields);
        if (res.mode === "queued") {
          savedSheetRef.current = JSON.stringify(sheetData);
          setToast({ message: t("ops.trip.saved_locally"), type: "info" });
        } else if (res.ok) {
          savedSheetRef.current = JSON.stringify(sheetData);
          setToast({ message: t("ops.trip.end_saved_ok"), type: "success" });
        } else {
          setToast({ message: res.error || t("ops.trip.failed_save_end"), type: "error" });
        }
      } else if (saveEndProgress) {
        const success = await saveEndProgress(canonical as Partial<Trip>);
        setToast(
          success
            ? { message: t("ops.trip.end_saved_ok"), type: "success" }
            : { message: t("ops.trip.failed_save_end"), type: "error" }
        );
        if (success) savedSheetRef.current = JSON.stringify(sheetData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Initiate submit ──────────────────────────────────────────────
  const handleInitiateSubmit = () => {
    // Part K: final Submit needs the server. Offline, keep every entered value
    // locally, keep the trip's existing authoritative status, and do NOT set
    // Pending / endStepSubmitted / expensesStepSubmitted / submittedAt.
    if (canDurable && isOffline) {
      void step5Draft.saveProgress({ ...sheetData, ...prepareFinalPayload(false) } as Step5DraftFields);
      setErrorMsg(t("ops.trip.submit_offline"));
      return;
    }
    const endMeterNum = Number(sheetData.endMeter);
    if (sheetData.endMeter === "" || sheetData.endMeter === null || isNaN(endMeterNum)) {
      setErrorMsg(t("ops.trip.end_meter_required"));
      return;
    }

    const actualDestMeter = destMeter || 0;
    let highestDieselMeter = 0;
    Object.keys(sheetData).forEach((key) => {
      if (key.startsWith("dieselMeter")) {
        const idx = key.replace("dieselMeter", "");
        if (!sheetData[`dieselSubmitted${idx}`]) return;
        const val = Number(sheetData[key]);
        if (!isNaN(val) && val > highestDieselMeter) highestDieselMeter = val;
      }
    });
    let requiredMinMeter = openingMeter;
    let requiredMinLabel = t("ops.trip.start_meter_label", { meter: openingMeter });
    if (actualDestMeter > requiredMinMeter) {
      requiredMinMeter = actualDestMeter;
      requiredMinLabel = t("ops.trip.dest_meter_label", { meter: actualDestMeter });
    }
    if (highestDieselMeter > requiredMinMeter) {
      requiredMinMeter = highestDieselMeter;
      requiredMinLabel = t("ops.trip.diesel_entry_label", { meter: highestDieselMeter });
    }
    if (requiredMinMeter > 0 && endMeterNum <= requiredMinMeter) {
      setErrorMsg(t("ops.trip.meter_must_greater_than", { meter: requiredMinMeter }));
      return;
    }

    const destTollsNum = Number(sheetData.destinationTolls);
    if (sheetData.destinationTolls === "" || sheetData.destinationTolls === null || isNaN(destTollsNum) || destTollsNum < 0) {
      setErrorMsg(t("ops.trip.tolls_zero_or_greater"));
      return;
    }

    const draftCount = getDieselIndices(sheetData).filter((idx) => {
      if (sheetData[`dieselSubmitted${idx}`]) return false;
      return Boolean(
        sheetData[`dieselLtr${idx}`] ||
        sheetData[`dieselRate${idx}`] ||
        sheetData[`dieselMeter${idx}`] ||
        sheetData[`dieselBunk${idx}`] ||
        sheetData[`dieselImage${idx}`]
      );
    }).length;

    const proceedToFinalConfirm = () => {
      setConfirmation({
        isOpen: true,
        title: isSubmitted ? t("ops.trip.update_expenses_sheet") : t("ops.trip.submit_expenses_sheet"),
        message: isSubmitted
          ? t("ops.trip.confirm_update_expenses")
          : t("ops.trip.confirm_submit_expenses"),
        confirmLabel: isSubmitted ? t("ops.trip.yes_update") : t("ops.trip.yes_submit"),
        cancelLabel: t("common.cancel"),
        type: "info",
        onConfirm: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          executeSubmit();
        },
        onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
      });
    };

    if (draftCount > 0) {
      setConfirmation({
        isOpen: true,
        title: t("ops.trip.diesel_draft_title"),
        message:
          draftCount === 1
            ? t("ops.trip.diesel_draft_message_one")
            : t("ops.trip.diesel_draft_message_many", { count: draftCount }),
        confirmLabel: t("ops.trip.submit_without_draft"),
        cancelLabel: draftCount === 1 ? t("ops.trip.go_back") : t("ops.trip.review_drafts"),
        type: "warning",
        onConfirm: () => {
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          proceedToFinalConfirm();
        },
        onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    proceedToFinalConfirm();
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const finalData = prepareFinalPayload(true);
      let success = true;
      const submitFn = submitExpensesStep || submitStartStep;
      if (typeof submitFn === "function") {
        const result = await submitFn(finalData as any);
        if (result === false) success = false;
      }
      if (success) {
        setIsLocalEditing(false);
        setIsSubmittedLocal(true);
        // Part K: the authoritative submission succeeded — the durable draft
        // and any queued Save op for this trip are now obsolete.
        void discardDraft();
        setToast({ message: t("ops.trip.step5_submitted"), type: "success" });
        // Close wizard → Create New Trip landing (same as steps 1–4).
        // Prefer clearForm so Recent Trips can pick up the finished trip.
        if (clearForm) {
          clearForm();
        }
      } else {
        // Single inline presentation — the inline error box below shows the
        // same message; do NOT duplicate it through the notice toast.
        setErrorMsg(t("ops.trip.failed_save_step"));
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      // Server-authoritative failure: keep every entered value in the durable
      // draft, keep the trip's existing status, show a retryable message.
      setErrorMsg(err?.message || t("ops.trip.failed_save_step"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Close (while editing submitted) → locked submitted view. */
  const handleExitToLocked = () => {
    setIsLocalEditing(false);
    setToast({ message: t("ops.trip.edit_cancelled"), type: "info" });
    if (onExitEdit) {
      onExitEdit();
      return;
    }
    // Fallback discard without leaving the trip.
    onCancel?.();
  };

  /** Bottom Cancel → leave wizard / Create New Trip. */
  const handleCloseView = () => {
    setIsLocalEditing(false);
    if (onCancel) {
      onCancel();
      return;
    }
    clearForm?.();
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .sheet-joined-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; }
        .sheet-joined-table th, .sheet-joined-table td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 0.8125rem; line-height: 1.2; text-align: left !important; }
        .sheet-joined-table input[type="number"]::-webkit-inner-spin-button,
        .sheet-joined-table input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
        .sheet-joined-table input[type="number"] { -moz-appearance: textfield !important; appearance: textfield !important; }
        .sheet-joined-table input { width: 100%; outline: none; background: transparent; font-size: 0.8125rem; color: #0f172a; font-weight: 500; padding: 2px; text-align: left !important; }
      `}</style>

      {isSubmitted && !isLocalEditing ? (
        // ─── Locked View ──────────────────────────────────────────────
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <Receipt size={18} className="text-orange-600" />
                {t("ops.trip.title.expenses")}
              </h3>
              <TripNoBadge tripNo={trip.tripNo} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Locked / view: pencil only — no top Close X */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsLocalEditing(true)}
                  className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                  title={t("ops.trip.edit_step")}
                >
                  <Pencil size={14} />
                </button>
              )}
              <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                {t("ops.trip.submitted_locked")}
              </span>
            </div>
          </div>
          {/* Equal-size field boxes with clean margins (not KPI tiles) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              {
                label: t("ops.trip.date_time"),
                value: submittedTimeDisplay || "—",
                tone: "border-sky-200/80 bg-sky-50/50 text-slate-900",
              },
              {
                label: t("operations.vehicle_no"),
                value: trip.vehicleNo || "—",
                tone: "border-indigo-200/80 bg-indigo-50/50 text-indigo-800",
              },
              {
                label: t("ops.trip.field_advance_given"),
                value: formatInr(Number(trip.advanceAmount || 0)),
                tone: "border-emerald-200/80 bg-emerald-50/50 text-emerald-800",
              },
              {
                label: t("operations.total_expenses"),
                value: formatInr(totalAllExpenses),
                tone: "border-red-200/80 bg-red-50/50 text-red-700",
              },
              {
                label: t("ops.trip.total_diesel"),
                value: formatInr(totalDieselAmount),
                tone: "border-blue-200/80 bg-blue-50/50 text-blue-700",
              },
              {
                label: t("ops.trip.field_total_all"),
                value: formatInr(totalAllExpenses + totalDieselAmount),
                tone: "border-slate-300 bg-slate-50 text-slate-900",
              },
            ].map((f) => (
              <div
                key={f.label}
                className={`rounded-xl border px-3 py-2.5 min-w-0 shadow-sm ${f.tone}`}
              >
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide truncate">{f.label}</p>
                <p className="text-sm font-bold text-slate-800 mt-1 tabular-nums truncate leading-snug">{f.value}</p>
              </div>
            ))}
          </div>
          <GeneralExpensesTable
            sheetData={sheetData}
            handleChange={handleChange}
            pickupTolls={trip.pickupTolls || 0}
            totalExpenses1={totalExpenses1}
            totalExpenses2={totalExpenses2}
            totalAllExpenses={totalAllExpenses}
            totalDistanceCovered={totalDistanceCovered}
            averageKmLtr={averageKmLtr}
            openingMeter={openingMeter}
            destMeter={destMeter}
            trip={trip}
            readOnly
            onMeterNotice={(msg) => setToast({ message: msg, type: "warning" })}
          />
          <DieselExpensesTable
            tripId={trip.id}
            sheetData={sheetData}
            handleChange={handleChange}
            applyBatchUpdates={applyBatchUpdates}
            dieselAmounts={dieselAmounts}
            totalDieselAmount={totalDieselAmount}
            destMeter={destMeter}
            readOnly
          />
        </div>
      ) : (
        // ─── Editable View ────────────────────────────────────────────
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <Receipt size={18} className="text-orange-600" />
                {t("ops.trip.title.expenses")}
              </h3>
              <TripNoBadge tripNo={trip.tripNo} />
            </div>
            <div className="flex items-center gap-2">
              {/* Edit mode only: animated Close X → locked submitted view */}
              {isSubmitted ? (
                <StepCloseButton onClose={handleExitToLocked} animated />
              ) : null}
              <span className="text-[11px] text-slate-700 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                {t("ops.trip.editable_view")}
              </span>
            </div>
          </div>

          {/* Equal-size field boxes with clean margins (live totals while editing) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              {
                label: t("ops.trip.date_time"),
                value: submittedTimeDisplay || t("ops.trip.time_pending_short"),
                tone: "border-sky-200/80 bg-sky-50/50 text-slate-900",
              },
              {
                label: t("operations.vehicle_no"),
                value: trip.vehicleNo || "—",
                tone: "border-indigo-200/80 bg-indigo-50/50 text-indigo-800",
              },
              {
                label: t("ops.trip.field_advance_given"),
                value: formatInr(Number(trip.advanceAmount || 0)),
                tone: "border-emerald-200/80 bg-emerald-50/50 text-emerald-800",
              },
              {
                label: t("operations.total_expenses"),
                value: formatInr(totalAllExpenses),
                tone: "border-red-200/80 bg-red-50/50 text-red-700",
              },
              {
                label: t("ops.trip.total_diesel"),
                value: formatInr(totalDieselAmount),
                tone: "border-blue-200/80 bg-blue-50/50 text-blue-700",
              },
              {
                label: t("ops.trip.field_total_all"),
                value: formatInr(totalAllExpenses + totalDieselAmount),
                tone: "border-slate-300 bg-slate-50 text-slate-900",
              },
            ].map((f) => (
              <div
                key={f.label}
                className={`rounded-xl border px-3 py-2.5 min-w-0 shadow-sm ${f.tone}`}
              >
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide truncate">{f.label}</p>
                <p className="text-sm font-bold text-slate-800 mt-1 tabular-nums truncate leading-snug">{f.value}</p>
              </div>
            ))}
          </div>

          <GeneralExpensesTable
            key={`general-${trip.id}`}
            sheetData={sheetData}
            handleChange={handleChange}
            pickupTolls={trip.pickupTolls || 0}
            totalExpenses1={totalExpenses1}
            totalExpenses2={totalExpenses2}
            totalAllExpenses={totalAllExpenses}
            totalDistanceCovered={totalDistanceCovered}
            averageKmLtr={averageKmLtr}
            openingMeter={openingMeter}
            destMeter={destMeter}
            trip={trip}
            onMeterNotice={(msg) => setToast({ message: msg, type: "warning" })}
          />

          <DieselExpensesTable
            key={`diesel-${trip.id}`}
            tripId={trip.id}
            sheetData={sheetData}
            handleChange={handleChange}
            applyBatchUpdates={applyBatchUpdates}
            dieselAmounts={dieselAmounts}
            totalDieselAmount={totalDieselAmount}
            destMeter={destMeter}
          />

          {errorMsg ? (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
              {errorMsg}
            </div>
          ) : null}

          <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
            <textarea
              rows={2}
              value={sheetData.remarks}
              onChange={(e) => {
                setErrorMsg("");
                const val = e.target.value;
                const updated = { ...sheetData, remarks: val };
                setSheetData(updated);
              }}
              placeholder={t("ops.trip.optional_trip_notes")}
              className="w-full text-xs font-medium text-slate-800 outline-none bg-transparent resize-none placeholder:text-slate-400 text-left"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2 font-bold text-xs text-slate-900">
            <span>{t("ops.trip.balance_remaining")}</span>
            <span className="text-emerald-600 tabular-nums">{formatInr(remainingBalance)}</span>
          </div>

          <WizardStepNotice
            notice={toast ? { type: toast.type === "warning" ? "info" : toast.type, message: toast.message } : null}
            dirty={hasUnsavedChanges}
          />
          <WizardActionBar
            onCancel={handleCloseView}
            onSave={saveEndProgress ? handleSaveProgress : undefined}
            onSubmit={handleInitiateSubmit}
            busy={isSubmitting}
            saveDisabled={!hasUnsavedChanges}
            submitDisabled={endMeterInvalid}
            submitLabel={isSubmitted ? "ops.trip.update_end_details" : "ops.trip.submit_end_details"}
          />
        </div>
      )}

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