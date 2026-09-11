import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Scale, Bird, Box, Gauge, Clock, Pencil, Package, Lock,
  Plus, Trash2, FileText, AlertTriangle, Camera, Download
} from "lucide-react";
import type { Trip, BoxDetail } from "../types/trip";
import { getVehicles } from "../../../masters/vehicles/services/vehicleService";
import { generatePickupReportPDF } from "../utils/generatePickupPDF";
import { StepCloseButton, WizardActionBar, WizardStepNotice } from "./WizardStepUI";
import { TripNoBadge } from "./TripNoBadge";
import { calculatePickupTotals, calculateBoxAvgWeight } from "../../../../shared/trip/calculations";
import {
  TRIP_FIELD_DEFINITIONS,
} from "../../../../shared/trip/definitions";
import { useI18n } from "../../../../i18n";
import { compressImageFile } from "../../../../utils/compressImage";
import { formatIstStamp } from "../services/tripHeaderApiService";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  updateBoxDetails: (rows: BoxDetail[], persistToStorage?: boolean, silent?: boolean) => void;
  submitPickupStep: (data: Partial<Trip>) => boolean | Promise<boolean>;
  savePickupProgress?: (data: Partial<Trip>) => Promise<boolean>;
  editable?: boolean;
  canEdit?: boolean;
  /** Bottom Cancel → leave wizard / Create New Trip. */
  onCancel?: () => void;
  /** Header Close while editing → locked submitted view. */
  onExitEdit?: () => void;
  clearForm?: () => void;
}

type Row = BoxDetail & { uid: string };
type PickupPhoto = { key: string; mime: string; data: string };
const generateUid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
const makeRow = (boxNo: number): Row => ({
  uid: generateUid(),
  boxNo,
  birds: 0,
  weight: 0,
  avgWeight: null,
});

function formatAvg(birds: number, weight: number, stored?: number | null) {
  const avg = stored != null && Number.isFinite(stored) && stored > 0
    ? stored
    : calculateBoxAvgWeight(birds, weight);
  return avg == null ? "—" : String(avg);
}

function photosFromTrip(trip: Trip): PickupPhoto[] {
  const out: PickupPhoto[] = [];
  if (trip.dcPhotoData && trip.dcPhotoData.startsWith("data:image/")) {
    out.push({
      key: trip.dcPhotoKey || `dc_photo_${trip.id}_1`,
      mime: trip.dcPhotoMime || "image/jpeg",
      data: trip.dcPhotoData,
    });
  }
  if (trip.dcPhotoData2 && trip.dcPhotoData2.startsWith("data:image/")) {
    out.push({
      key: trip.dcPhotoKey2 || `dc_photo_${trip.id}_2`,
      mime: trip.dcPhotoMime2 || "image/jpeg",
      data: trip.dcPhotoData2,
    });
  }
  return out.slice(0, 2);
}

// ─── Confirmation Modal ──────────────────────────────────────────────
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "warning" | "info";
}

function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "ops.trip.yes_proceed",
  cancelLabel = "common.cancel",
  onConfirm,
  onCancel,
  type = "warning",
}: ConfirmationModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const iconColor = type === "warning" ? "text-amber-600" : "text-blue-600";
  const borderColor = type === "warning" ? "border-amber-200" : "border-slate-200";
  const bgGradient = type === "warning"
    ? "from-amber-50 to-orange-50"
    : "from-blue-50 to-slate-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border ${borderColor}`}>
        <div className={`bg-gradient-to-br ${bgGradient} p-6`}>
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 p-2 rounded-full bg-white/60 border ${borderColor}`}>
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
            className="h-10 px-5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all hover:shadow-sm inline-flex items-center justify-center shrink-0"
          >
            {t(cancelLabel)}
          </button>
          <button
            onClick={onConfirm}
            className={`h-10 px-5 rounded-lg text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center shrink-0 ${
              type === "warning"
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {t(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StepPickup({
  trip,
  setTrip: _setTrip,
  updateTrip,
  updateBoxDetails: _updateBoxDetails,
  submitPickupStep,
  savePickupProgress,
  editable = false,
  canEdit = false,
  onCancel,
  onExitEdit,
  clearForm,
}: Props) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(Boolean(editable));
  useEffect(() => {
    if (editable) setIsLocalEditing(true);
  }, [editable, trip.id]);
  const [removedBoxNos, setRemovedBoxNos] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[]>(() => {
    const details = trip.boxDetails || [];
    return details.length > 0 ? details.map((d) => ({ ...d, uid: generateUid() })) : [makeRow(1)];
  });

  const maxBoxes = useMemo(() => {
    if (trip.vehicleBoxCapacity && trip.vehicleBoxCapacity > 0) return trip.vehicleBoxCapacity;
    try {
      const vehicles = getVehicles();
      const matched = vehicles.find(
        (v) =>
          v.vehicleNumber?.trim().toLowerCase() === trip.vehicleNo?.trim().toLowerCase()
      );
      return matched?.noOfBoxes && matched.noOfBoxes > 0 ? matched.noOfBoxes : 0;
    } catch {
      return 0;
    }
  }, [trip.vehicleNo, trip.vehicleBoxCapacity]);

  const [photos, setPhotos] = useState<PickupPhoto[]>(() => photosFromTrip(trip));

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which DC-photo slot (0 or 1) the picker was opened for.
  const slotIndexRef = useRef(0);
  const savedPhotosRef = useRef<PickupPhoto[]>(photosFromTrip(trip));

  // ─── Toast state ────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ─── One operation per intentional action ─────────────────────────────
  // Guards the read-only view's DC-photo download and Pickup KPI PDF at the
  // OPERATION level (not just the disabled attribute): a mouse double-click
  // or repeated Enter/Space cannot produce duplicate downloads. The lock is
  // ref-based so it also protects programmatic invocation, held briefly
  // (500ms) after completion to swallow the second click of a double-click,
  // and released immediately on unmount. A failed operation re-arms the same
  // way, so retry always works.
  const [busyAction, setBusyAction] = useState<"image" | "pdf" | null>(null);
  const actionLockRef = useRef<"image" | "pdf" | null>(null);
  const actionLockTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    // Cleanup-safe: never leave a stale timer/lock after unmount.
    return () => window.clearTimeout(actionLockTimerRef.current);
  }, []);
  const beginAction = (action: "image" | "pdf"): boolean => {
    if (actionLockRef.current !== null) return false;
    actionLockRef.current = action;
    setBusyAction(action);
    return true;
  };
  const endAction = () => {
    window.clearTimeout(actionLockTimerRef.current);
    actionLockTimerRef.current = window.setTimeout(() => {
      actionLockRef.current = null;
      setBusyAction(null);
    }, 500);
  };

  // ─── Confirmation state ─────────────────────────────────────────────
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

  const hasUnsavedChanges = useMemo(() => {
    const currentBoxes = rows.map(({ uid, ...rest }) => rest);
    const savedBoxes = trip.boxDetails || [];
    return JSON.stringify(currentBoxes) !== JSON.stringify(savedBoxes) ||
      JSON.stringify(photos.map((p) => p.key)) !== JSON.stringify(savedPhotosRef.current.map((p) => p.key));
  }, [rows, trip.boxDetails, photos]);

  useEffect(() => {
    setPhotos(photosFromTrip(trip));
    savedPhotosRef.current = photosFromTrip(trip);
  }, [trip.id, trip.dcPhotoKey, trip.dcPhotoKey2, trip.dcPhotoData, trip.dcPhotoData2]);

  useEffect(() => {
    const details = trip.boxDetails || [];
    if (details.length > 0) {
      setRows(details.map((d) => ({ ...d, uid: generateUid() })));
    } else {
      setRows([makeRow(1)]);
    }
    // Fresh trip → no pending removals from a previous trip's edit session.
    setRemovedBoxNos([]);
  }, [trip.id, isLocalEditing, trip.boxDetails?.length]);

  const totals = useMemo(() => calculatePickupTotals(rows), [rows]);

  // ─── Row operations with Max Box Limit Check ───────────────────────
  const addRow = () => {
    if (maxBoxes > 0 && rows.length >= maxBoxes) {
      setToast({
        message: t("ops.trip.box_limit_exceeded", { max: maxBoxes }),
        type: "error",
      });
      return;
    }
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (!(lastRow.birds > 0) || !(lastRow.weight > 0)) {
        setToast({
          message: t("ops.trip.fill_current_box"),
          type: "error",
        });
        return;
      }
    }
    setRows((prev) => [...prev, makeRow(prev.length + 1)]);
  };

  // ANY box can be deleted. Remaining boxes automatically shift into the
  // freed slot and renumber contiguously (1..n), so entries stay compact.
  const removeRow = (uid: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const victim = prev.find((r) => r.uid === uid);
      if (!victim) return prev;
      setRemovedBoxNos((ids) => [...ids, victim.boxNo]);
      return prev
        .filter((r) => r.uid !== uid)
        .map((r, i) => ({ ...r, boxNo: i + 1 }));
    });
  };

  const updateRow = (uid: string, field: "birds" | "weight", value: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.uid !== uid) return r;
        const next = { ...r, [field]: value };
        next.avgWeight = calculateBoxAvgWeight(next.birds, next.weight);
        return next;
      })
    );
  };

  const blockScrollAndArrows = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  const getBoxDetails = (): BoxDetail[] => rows.map(({ uid, ...rest }) => rest);

  const isLastRowComplete = useMemo(() => {
    if (rows.length === 0) return true;
    const lastRow = rows[rows.length - 1];
    return lastRow.birds > 0 && lastRow.weight > 0;
  }, [rows]);

  // ─── Image upload handlers ──────────────────────────────────────────
  const photoFields = (): Partial<Trip> & { syncPickupPhotos: boolean } => ({
    dcPhotoKey: photos[0]?.key,
    dcPhotoMime: photos[0]?.mime,
    dcPhotoData: photos[0]?.data,
    dcPhotoKey2: photos[1]?.key,
    dcPhotoMime2: photos[1]?.mime,
    dcPhotoData2: photos[1]?.data,
    syncPickupPhotos: true,
  });

  // Official Step 3 time capture — appears ONLY after the FIRST successful
  // submit and is then frozen forever (edits never change it). Before that
  // first submit no time is shown, just the "auto-captured on submit" note.
  const officialPickupTime = trip.pickupStepSubmitted
    ? trip.pickupStepSubmittedAt
      ? formatIstStamp(trip.pickupStepSubmittedAt)
      : trip.pickupLoadTime || ""
    : "";

  const uploadBusyRef = useRef(false);

  const openFilePicker = (slot: number) => {
    if (uploadBusyRef.current) return;
    slotIndexRef.current = slot;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadBusyRef.current) return;
    uploadBusyRef.current = true;

    try {
      if (!file.type.startsWith("image/")) {
        setToast({ message: t("ops.trip.valid_image"), type: "error" });
        return;
      }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: t("ops.trip.image_size_5mb"), type: "error" });
      return;
    }
    if (photos.length >= 2) {
      setToast({ message: t("ops.trip.max_2_photos"), type: "error" });
      return;
    }

    // Auto-compress before storing: every photo lands under ~100 KB while
      // staying clear (quality-first JPEG stepping, dimension floor 640px).
      // The 5 MB gate above only rejects undecodable monsters — compression
      // handles everything in between.
      const result = await compressImageFile(file, { maxBytes: 100 * 1024, maxDimension: 1600 });
      const data = result.dataUrl;
      if (!data.startsWith("data:image/")) {
        setToast({ message: t("ops.trip.valid_image"), type: "error" });
        return;
      }
      const next: PickupPhoto = {
        key: `dc_photo_${trip.id}_${photos.length + 1}_${Date.now()}`,
        mime: result.mime,
        data,
      };
      // Place the photo in the slot the user tapped; keep max 2.
      const target = Math.min(slotIndexRef.current, photos.length);
      const nextPhotos = [...photos];
      nextPhotos.splice(target, 0, next);
      const capped = nextPhotos.slice(0, 2);
      setPhotos(capped);
      updateTrip({
        dcPhotoKey: capped[0]?.key,
        dcPhotoMime: capped[0]?.mime,
        dcPhotoData: capped[0]?.data,
        dcPhotoKey2: capped[1]?.key,
        dcPhotoMime2: capped[1]?.mime,
        dcPhotoData2: capped[1]?.data,
      });
      if (result.compressed) {
        setToast({
          message: t("ops.trip.photo_auto_compressed", {
            from: Math.round(result.originalBytes / 1024),
            to: Math.round(result.storedBytes / 1024),
          }),
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to read image:", error);
      setToast({ message: t("ops.trip.failed_read_image"), type: "error" });
    } finally {
      uploadBusyRef.current = false;
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = async (key: string) => {
    const nextPhotos = photos.filter((p) => p.key !== key);
    setPhotos(nextPhotos);
    updateTrip({
      dcPhotoKey: nextPhotos[0]?.key,
      dcPhotoMime: nextPhotos[0]?.mime,
      dcPhotoData: nextPhotos[0]?.data,
      dcPhotoKey2: nextPhotos[1]?.key,
      dcPhotoMime2: nextPhotos[1]?.mime,
      dcPhotoData2: nextPhotos[1]?.data,
    });
  };

  // ─── Download Image ──────────────────────────────────────────────────
  const downloadImage = async () => {
    if (!beginAction("image")) return;
    try {
      if (!photos[0]?.data) return;
      const link = document.createElement("a");
      link.href = photos[0].data;
      link.download = `DC_Photo_${trip.tripNo || "trip"}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download image:", error);
      setToast({ message: t("ops.trip.failed_download_image"), type: "error" });
    } finally {
      endAction();
    }
  };

  // ─── Manual Save ────────────────────────────────────────────────
  const handleSaveProgress = async () => {
    if (!savePickupProgress) return;
    setIsSaving(true);
    const success = await savePickupProgress({
      boxDetails: getBoxDetails(),
      removedBoxNos,
      ...photoFields(),
    } as Partial<Trip>);
    setToast(success
      ? { message: t("ops.trip.progress_saved"), type: "success" }
      : { message: t("ops.trip.failed_save_pickup"), type: "error" });
    if (success) {
      savedPhotosRef.current = photos;
      setRemovedBoxNos([]);
    }
    setIsSaving(false);
  };

  // Bottom Cancel → leave wizard (Create New Trip). Close → locked submitted view.
  const handleCancel = () => {
    setIsLocalEditing(false);
    if (onCancel) {
      onCancel();
      return;
    }
    clearForm?.();
  };

  const handleExitToLocked = () => {
    setIsLocalEditing(false);
    onExitEdit?.();
  };

  // ─── Submit / Update with confirmation ─────────────────────────────
  const handleSubmit = () => {
    if (rows.length === 0) return;
    if (isSubmitting) return;
    if (trip.pickupStepSubmitted && !editable && !isLocalEditing) return;

    if (!photos.length) {
      setToast({ message: t("ops.trip.upload_dc_photo"), type: "error" });
      return;
    }

    // Persisted flag decides Create vs Update: React state (isLocalEditing) is
    // only ever an entry-mode toggle and must NOT drive the label.
    const isEditMode = Boolean(trip.pickupStepSubmitted) && (editable || isLocalEditing);
    const title = isEditMode ? t("ops.trip.update_pickup_kpi") : t("ops.trip.submit_pickup_kpi");
    const message = isEditMode
      ? t("ops.trip.confirm_update_pickup")
      : t("ops.trip.confirm_submit_pickup");

    setConfirmation({
      isOpen: true,
      title,
      message,
      confirmLabel: isEditMode ? t("ops.trip.yes_update") : t("ops.trip.yes_create"),
      cancelLabel: t("common.cancel"),
      type: isEditMode ? "info" : "warning",
      onConfirm: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
        void (async () => {
          setIsSubmitting(true);
          try {
            const success = await submitPickupStep({
              boxDetails: getBoxDetails(),
              ...photoFields(),
            });
            if (success) {
              setIsLocalEditing(false);
              setToast({ message: t("ops.trip.step3_submitted"), type: "success" });
            } else {
              setToast({ message: t("ops.trip.failed_submit_pickup"), type: "error" });
            }
          } finally {
            setIsSubmitting(false);
          }
        })();
      },
      onCancel: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const canSubmit = rows.length > 0 && totals.totalBirds > 0 && totals.dcWeight > 0 && photos.length >= 1;

  // ─── PDF Generation ─────────────────────────────────────────────────
  const generatePDF = async () => {
    if (!trip.pickupStepSubmitted) return;
    if (!beginAction("pdf")) return;
    try {
      await generatePickupReportPDF(trip, {
        pickupTime: officialPickupTime || undefined,
        maxBoxes: maxBoxes || undefined,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      setToast({ message: t("ops.trip.pdf_generation_failed"), type: "error" });
    } finally {
      endAction();
    }
  };

  // ─── LOCKED VIEW ───────────────────────────────────────────────────
  if (trip.pickupStepSubmitted && !editable && !isLocalEditing) {
    const grouped = trip.boxDetails?.reduce((acc: BoxDetail[][], _, i, arr) => {
      if (i % 3 === 0) acc.push(arr.slice(i, i + 3));
      return acc;
    }, []) || [];

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Package size={18} className="text-amber-600" />
              {t("ops.trip.title.pickup")}
            </h3>
            <TripNoBadge tripNo={trip.tripNo} />
          </div>
          <div className="flex items-center gap-2 shrink-0">

            {canEdit && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title={t("ops.trip.edit_pickup_kpi")}
              >
                <Pencil size={14} />
              </button>
            )}
            <StepCloseButton onClose={clearForm || onCancel} />
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              {t("ops.trip.submitted_locked")}
            </span>
          </div>
        </div>

        {/* 5 Column Compact Deliveries-Style KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Clock size={ 12 } /></span> {t("ops.trip.time")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{officialPickupTime || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Scale size={ 12 } /></span> {t("ops.trip.dc_wt")}
            </span>
            <span className="text-xs font-bold text-slate-800">{trip.dcWeight ? `${Number(trip.dcWeight).toFixed(2)} Kg` : t("ops.trip.not_entered")}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><Bird size={ 12 } /></span> {t("common.birds")}
            </span>
            <span className="text-xs font-bold text-slate-800">{trip.totalBirds}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><Box size={ 12 } /></span> {t("common.boxes")}
            </span>
            <span className="text-xs font-bold text-slate-800">{trip.boxes} / {maxBoxes}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Gauge size={ 12 } /></span> {t("ops.trip.avg_wt")}
            </span>
            <span className="text-xs font-bold text-slate-800">{trip.avgWeight ? `${trip.avgWeight} Kg` : "—"}</span>
          </div>
        </div>

        {/* DC Photo Status Card */}
        {photos.length > 0 && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 text-xs font-medium text-slate-700 flex-wrap">
            <span className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Camera size={ 16 } /></span>
            <span>{t("ops.trip.photos_uploaded", { count: photos.length })}</span>
            {photos.map((p) => (
              <img key={p.key} src={p.data} alt="Pickup" className="h-12 w-12 object-cover rounded-lg border border-slate-200" />
            ))}
          </div>
        )}

        {/* Box Table */}
        {trip.boxDetails && trip.boxDetails.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                {Array.from({ length: 12 }).map((_, i) => (
                  <col key={i} className="w-[8.33%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[10px] uppercase sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((i, idx) => (
                    <React.Fragment key={i}>
                      <th className={`text-center px-2 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200 ${idx > 0 ? 'pl-4' : ''}`}>{t("ops.trip.box")}</th>
                      <th className="text-center px-2 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200">{t("common.birds")}</th>
                      <th className="text-center px-2 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200">{t("ops.trip.wt_kg")}</th>
                      <th className={`text-center px-2 py-2 font-bold bg-slate-50 text-slate-600 ${idx < 2 ? 'border-r-2 border-slate-300' : ''}`}>{t("ops.trip.avg_wt_kg")}</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {grouped.map((group, idx) => (
                  <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                    {group.map((r, colIdx) => (
                      <React.Fragment key={r.boxNo}>
                        <td className={`text-center px-2 py-2 font-semibold text-slate-800 border-r border-slate-200 ${colIdx > 0 ? 'pl-4' : ''}`}>{r.boxNo}</td>
                        <td className="text-center px-2 py-2 font-bold text-slate-800 border-r border-slate-200">{r.birds || t("ops.trip.not_entered")}</td>
                        <td className="text-center px-2 py-2 font-semibold text-slate-800 border-r border-slate-200">{r.weight ? Number(r.weight).toFixed(2) : t("ops.trip.not_entered")}</td>
                        <td className={`text-center px-2 py-2 font-semibold text-slate-800 ${colIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>
                          {formatAvg(Number(r.birds), Number(r.weight), r.avgWeight)}
                        </td>
                      </React.Fragment>
                    ))}
                    {group.length < 3 &&
                      Array.from({ length: 3 - group.length }).map((_, i) => {
                        const emptyIdx = group.length + i;
                        return (
                          <React.Fragment key={i}>
                            <td className={`text-center px-2 py-2 text-slate-300 border-r border-slate-200 ${emptyIdx > 0 ? 'pl-4' : ''}`}>—</td>
                            <td className="text-center px-2 py-2 text-slate-300 border-r border-slate-200">—</td>
                            <td className="text-center px-2 py-2 text-slate-300 border-r border-slate-200">—</td>
                            <td className={`text-center px-2 py-2 text-slate-300 ${emptyIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>—</td>
                          </React.Fragment>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Banner with Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-slate-600 font-normal">
            {t("ops.trip.pickup_submitted_ok")}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {photos.length > 0 && (
              <button
                onClick={downloadImage}
                disabled={busyAction !== null}
                aria-label={t("ops.trip.download_image")}
                className="flex items-center justify-center p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                title={t("ops.trip.download_image")}
              >
                <Download size={16} className={busyAction === "image" ? "animate-pulse" : ""} />
              </button>
            )}
            <button
              onClick={generatePDF}
              disabled={busyAction !== null}
              aria-label={t("ops.trip.download_pdf")}
              className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              title={t("ops.trip.download_pdf")}
            >
              <FileText size={16} className={busyAction === "pdf" ? "animate-pulse" : ""} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDIT / ENTRY VIEW ──────────────────────────────────────────────────
  const showAddSlot = isLastRowComplete && maxBoxes > 0 && rows.length < maxBoxes;
  const entrySlots: Array<{ type: "box"; row: Row } | { type: "add" }> = [
    ...rows.map((row) => ({ type: "box" as const, row })),
    ...(showAddSlot ? [{ type: "add" as const }] : []),
  ];
  const groupedRows = entrySlots.reduce((acc: typeof entrySlots[], _, i, arr) => {
    if (i % 3 === 0) acc.push(arr.slice(i, i + 3));
    return acc;
  }, [] as typeof entrySlots[]);

  const isEditMode = Boolean(trip.pickupStepSubmitted) && (editable || isLocalEditing);

  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-spinner {
          -moz-appearance: textfield;
          appearance: none;
        }
        .mini-input {
          height: 28px;
          padding: 0 4px;
          font-size: 0.8rem;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          text-align: center;
          width: 100%;
          min-width: 0;
          transition: all 0.15s;
          color: #2563eb;
          font-weight: 700;
        }
        .mini-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .mini-input:focus {
          background: white;
          border-color: #2563eb;
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
        }
        .mini-input:hover {
          border-color: #93c5fd;
        }
        .mini-delete {
          padding: 2px;
          border-radius: 4px;
          border: 1px solid transparent;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
        }
        .mini-delete:hover:not(:disabled) {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fecaca;
        }
        .mini-delete:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Package size={18} className="text-amber-600" />
              {t("ops.trip.title.pickup")}
            </h3>
            <TripNoBadge tripNo={trip.tripNo} />
          </div>
          <div className="flex items-center gap-3">
            {(isEditMode || isLocalEditing) && trip.pickupStepSubmitted && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                {t("ops.trip.editable_view")}
              </span>
            )}
          </div>
        </div>

        {/* Official time capture — set once at submit, cannot be edited */}
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="h-5 w-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Clock size={ 14 } /></span>
          {officialPickupTime ? (
            <>
              <span className="font-semibold text-slate-700">{officialPickupTime}</span>
              <span
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5"
                title={t("ops.trip.time_locked_hint")}
              >
                <Lock size={9} /> {t("ops.trip.time_locked")}
              </span>
            </>
          ) : (
            <span>{t("ops.trip.auto_time_on_submit")}</span>
          )}
        </div>

        {/* Image Upload Section — two DC photo slots */}
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
          <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 flex-wrap">
            <span className="h-6 w-6 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <Camera size={14} />
            </span>
            {t("ops.trip.field.dc_photo")} {TRIP_FIELD_DEFINITIONS.dcPhotoKey.required && <span className="text-red-500">*</span>}
            <span className="text-xs font-normal text-slate-400">
              {t("ops.trip.photos_of_2", { count: photos.length })}
            </span>
          </label>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {[0, 1].map((slot) => {
              const p = photos[slot];
              return p ? (
                <div key={p.key} className="relative">
                  <img src={p.data} alt={`Pickup ${slot + 1}`} className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-xs" />
                  <button
                    type="button"
                    onClick={() => void removeImage(p.key)}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 text-[10px] leading-5 shadow-sm transition-all active:scale-90"
                    title={t("ops.trip.remove_photo")}
                  >
                    ×
                  </button>
                  <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {slot + 1}
                  </span>
                </div>
              ) : (
                <button
                  key={`add-slot-${slot}`}
                  type="button"
                  onClick={() => openFilePicker(slot)}
                  className="h-24 w-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-400 hover:bg-sky-50/60 text-slate-400 hover:text-sky-500 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                  title={t("ops.trip.choose_image")}
                >
                  <Camera size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-wide">{t("ops.trip.add_photo")}</span>
                </button>
              );
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-[10px] text-slate-400 flex-1 min-w-[140px]">{t("ops.trip.photo_requirements")}</p>
          </div>
        </div>

        {/* Entry Table Container */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <Package size={14} />
              </span>
              {t("ops.trip.box_entries", { max: maxBoxes || "—" })}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-80 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                {Array.from({ length: 12 }).map((_, i) => (
                  <col key={i} className="w-[8.33%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((blockIdx) => (
                    <React.Fragment key={blockIdx}>
                      <th className={`text-center px-1 py-2 font-bold text-slate-600 bg-slate-50 border-r border-slate-200 ${blockIdx > 1 ? 'pl-4' : ''}`}>{t("ops.trip.box")}</th>
                      <th className="text-center px-1 py-2 font-bold text-slate-600 bg-slate-50 border-r border-slate-200">{t("common.birds")}</th>
                      <th className="text-center px-1 py-2 font-bold text-slate-600 bg-slate-50 border-r border-slate-200">{t("ops.trip.wt_kg")}</th>
                      <th className={`text-center px-1 py-2 font-bold text-slate-600 bg-slate-50 ${blockIdx < 3 ? 'border-r-2 border-slate-300' : ''}`}>{t("ops.trip.avg_wt_kg")}</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {groupedRows.map((group, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors bg-white">
                    {group.map((slot, groupIdx) => {
                      if (slot.type === "add") {
                        return (
                          <td
                            key="add-box"
                            colSpan={4}
                            className={`px-1 py-1.5 bg-white ${groupIdx < 2 ? "border-r-2 border-slate-300" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={addRow}
                              className="w-full h-8 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
                            >
                              <Plus size={12} className="inline mr-1" /> {t("ops.trip.add_box")}
                            </button>
                          </td>
                        );
                      }
                      const row = slot.row;
                      return (
                      <React.Fragment key={row.uid}>
                        <td className={`text-center px-1 py-1.5 font-bold text-slate-700 text-xs bg-white border-r border-slate-200 ${groupIdx > 0 ? 'pl-4' : ''}`}>{row.boxNo}</td>
                        <td className="px-1 py-1.5 bg-white border-r border-slate-200">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={row.birds || ""}
                            onChange={(e) => updateRow(row.uid, "birds", parseInt(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            onKeyDown={blockScrollAndArrows}
                            placeholder="0"
                            className="mini-input hide-spinner"
                          />
                        </td>
                        <td className="px-1 py-1.5 bg-white border-r border-slate-200">
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.weight || ""}
                              onChange={(e) => updateRow(row.uid, "weight", parseFloat(e.target.value) || 0)}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={blockScrollAndArrows}
                              placeholder="0.00"
                              className="mini-input hide-spinner"
                            />
                            <button
                              type="button"
                              onClick={() => removeRow(row.uid)}
                              disabled={rows.length === 1}
                              className="mini-delete shrink-0"
                              title={t("ops.trip.delete_box")}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                        <td className={`text-center px-1 py-1.5 text-xs font-semibold text-slate-700 bg-white ${groupIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>
                          {formatAvg(row.birds, row.weight, row.avgWeight)}
                        </td>
                      </React.Fragment>
                      );
                    })}
                    {group.length < 3 &&
                      Array.from({ length: 3 - group.length }).map((_, i) => {
                        const emptyIdx = group.length + i;
                        return (
                          <React.Fragment key={i}>
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-xs bg-white border-r border-slate-200 ${emptyIdx > 0 ? 'pl-4' : ''}`}>—</td>
                            <td className="text-center px-1 py-1.5 text-slate-300 text-xs bg-white border-r border-slate-200">—</td>
                            <td className="text-center px-1 py-1.5 text-slate-300 text-xs bg-white border-r border-slate-200">—</td>
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-xs bg-white ${emptyIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>—</td>
                          </React.Fragment>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {t("ops.trip.use_tab_navigate")}
            {!isLastRowComplete && rows.length > 0 && (
              <span className="text-amber-600 ml-2">⚠️ {t("ops.trip.fill_current_box_warn")}</span>
            )}
            {rows.length >= maxBoxes && (
              <span className="text-red-600 ml-2 font-bold">🚫 {t("ops.trip.box_limit_reached", { max: maxBoxes })}</span>
            )}
          </p>
        </div>

        {/* Totals Summary Bar - Deliveries Style KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><Box size={ 12 } /></span> {t("common.boxes")}
            </span>
            <span className="text-xs font-bold text-slate-800">{totals.boxes} / {maxBoxes}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><Bird size={ 12 } /></span> {t("common.birds")}
            </span>
            <span className="text-xs font-bold text-slate-800">{totals.totalBirds}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Scale size={ 12 } /></span> {t("ops.trip.dc_wt")}
            </span>
            <span className="text-xs font-bold text-slate-800">{totals.dcWeight.toFixed(2)} Kg</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <span className="h-5 w-5 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Gauge size={ 12 } /></span> {t("ops.trip.avg_wt")}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {totals.avgWeight > 0 ? `${totals.avgWeight} Kg` : "—"}
            </span>
          </div>
        </div>

        <WizardStepNotice
          notice={toast ? { type: toast.type, message: toast.message } : null}
          dirty={hasUnsavedChanges}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {trip.pickupStepSubmitted && isEditMode ? (
            <button
              type="button"
              onClick={handleExitToLocked}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-[13px] font-semibold hover:bg-slate-50"
            >
              {t("common.close")}
            </button>
          ) : (
            <span />
          )}
          <WizardActionBar
            onCancel={handleCancel}
            onSave={savePickupProgress ? handleSaveProgress : undefined}
            onSubmit={handleSubmit}
            busy={isSaving || isSubmitting}
            saveDisabled={false}
            submitDisabled={!canSubmit || (trip.pickupStepSubmitted && !isEditMode)}
            submitLabel={isEditMode ? "ops.trip.update_pickup" : "ops.trip.submit_pickup"}
          />
        </div>
      </div>

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
    </>
  );
}