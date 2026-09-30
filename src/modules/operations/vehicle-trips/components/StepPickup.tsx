import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Scale, Bird, Box, Gauge, Clock, Pencil, Package, Lock,
  Plus, Trash2, FileText, Camera, Download
} from "lucide-react";
import type { Trip, BoxDetail } from "../types/trip";
import { getVehicles, loadVehicles } from "../../../masters/vehicles/services/vehicleService";
import { generatePickupReportPDF } from "../utils/generatePickupPDF";
import { StepCloseButton, WizardActionBar } from "./WizardStepUI";
import { TripContextBadges } from "./TripNoBadge";
import { StepKpiCard } from "./WizardControls";
import TripStepConfirmDialog from "./TripStepConfirmDialog";
import { calculatePickupTotals, calculateBoxAvgWeight } from "../../../../shared/trip/calculations";
import {
  TRIP_FIELD_DEFINITIONS,
} from "../../../../shared/trip/definitions";
import { useI18n } from "../../../../i18n";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { compressImageFile } from "../../../../utils/compressImage";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { formatTripViewStamp } from "../utils/tripViewLocalization";
import { TripTimestampDisplay } from "./TripTimestampDisplay";
import { withMinSaveDuration } from "../utils/withMinSaveDuration";
import SearchableSelect from "../../../../components/common/SearchableSelect";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  updateBoxDetails: (rows: BoxDetail[], persistToStorage?: boolean, silent?: boolean) => void;
  submitPickupStep: (data: Partial<Trip>) => boolean | Promise<boolean>;
  savePickupProgress?: (data: Partial<Trip>, opts?: { silent?: boolean }) => Promise<boolean>;
  editable?: boolean;
  canEdit?: boolean;
  /** Bottom Cancel → leave wizard / Create New Trip. */
  onCancel?: () => void;
  /** Header Close while editing → locked submitted view. */
  onExitEdit?: () => void;
  clearForm?: () => void;
  /** Hide locked-view Close X (Recent / Trip List read-only view). */
  hideWizardClose?: boolean; hideLockedChip?: boolean;
}

type Row = BoxDetail & { uid: string };
type PickupPhoto = { key: string; mime: string; data: string };
/** One calm tone per ROW (not per box). All three boxes in a row share the
 * same light band, and the next row takes the next tone, so rows stay
 * visually distinct across the dense 3-up table. */
const PICKUP_BOX_PALETTE = [
  { cell: "bg-sky-50/75", badge: "border-sky-200 bg-sky-100 text-sky-800", edge: "border-l-sky-300" },
  { cell: "bg-emerald-50/70", badge: "border-emerald-200 bg-emerald-100 text-emerald-800", edge: "border-l-emerald-300" },
  { cell: "bg-amber-50/70", badge: "border-amber-200 bg-amber-100 text-amber-800", edge: "border-l-amber-300" },
  { cell: "bg-violet-50/65", badge: "border-violet-200 bg-violet-100 text-violet-800", edge: "border-l-violet-300" },
  { cell: "bg-rose-50/60", badge: "border-rose-200 bg-rose-100 text-rose-800", edge: "border-l-rose-300" },
] as const;
const pickupRowTone = (rowIdx: number) =>
  PICKUP_BOX_PALETTE[((Math.max(0, rowIdx) % PICKUP_BOX_PALETTE.length) + PICKUP_BOX_PALETTE.length) % PICKUP_BOX_PALETTE.length];
const generateUid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
const makeRow = (boxNo: number, defaultBirds = 0): Row => ({
  uid: generateUid(),
  boxNo,
  birds: defaultBirds > 0 ? defaultBirds : 0,
  weight: 0,
  avgWeight: null,
});

function formatAvg(birds: number, weight: number, stored?: number | null) {
  const avg = stored != null && Number.isFinite(stored) && stored > 0
    ? stored
    : calculateBoxAvgWeight(birds, weight);
  return avg == null ? "—" : String(avg);
}

function photosFromTrip(trip: Pick<Trip, "id" | "dcPhotoKey" | "dcPhotoKey2" | "dcPhotoMime" | "dcPhotoMime2" | "dcPhotoData" | "dcPhotoData2">): PickupPhoto[] {
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

export default function StepPickup({
  trip,
  updateTrip,
  submitPickupStep,
  savePickupProgress,
  editable = false,
  canEdit = false,
  onCancel,
  onExitEdit,
  clearForm,
  hideWizardClose = false, hideLockedChip = false,
}: Props) {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Same-tick double-submit guard. */
  const submitLockRef = useRef(false);
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
  /** After Add Box, focus the new row's Weight field (birds are defaulted). */
  const pendingWeightFocusUidRef = useRef<string | null>(null);
  const weightInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const addBoxButtonRef = useRef<HTMLButtonElement | null>(null);
  const [selectedBoxNo, setSelectedBoxNo] = useState("");

  // Local operator preference for NEW box bird counts. It is intentionally not
  // trip/backend data, but survives refreshes on this device.
  const DEFAULT_BOX_SIZE_KEY = "dmr-trip-step3-default-box-size";
  const storedDefaultBoxSize = () => {
    try {
      const n = Number(globalThis.localStorage?.getItem(DEFAULT_BOX_SIZE_KEY) ?? 0);
      return Number.isInteger(n) && n > 0 && n <= 999 ? n : 0;
    } catch {
      return 0;
    }
  };
  const [defaultBoxSizeDraft, setDefaultBoxSizeDraft] = useState(() => String(storedDefaultBoxSize() || ""));
  const [appliedDefaultBoxSize, setAppliedDefaultBoxSize] = useState(storedDefaultBoxSize);
  useEffect(() => {
    setSelectedBoxNo("");
  }, [trip.id]);

  const selectBox = (value: string) => {
    setSelectedBoxNo(value);
    const boxNo = Number(value);
    const row = rows.find((item) => item.boxNo === boxNo);
    if (!row) return;
    requestAnimationFrame(() => {
      document.querySelector(`[data-pickup-box-no="${boxNo}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      const weightInput = weightInputRefs.current.get(row.uid);
      weightInput?.focus({ preventScroll: true });
      weightInput?.select();
    });
  };

  const applyDefaultBoxSize = () => {
    const n = Math.floor(Number(defaultBoxSizeDraft));
    if (!Number.isFinite(n) || n <= 0 || n > 999) {
      setToast({ message: t("ops.trip.default_box_size_invalid"), type: "error" });
      return;
    }
    setAppliedDefaultBoxSize(n);
    setDefaultBoxSizeDraft(String(n));
    try {
      globalThis.localStorage?.setItem(DEFAULT_BOX_SIZE_KEY, String(n));
    } catch {
      // The preference is optional; keep the active session working when storage is blocked.
    }
    // Only fill blank draft rows (no birds and no weight yet). Already-entered
    // boxes keep whatever the user typed.
    let focusUid: string | null = null;
    setRows((prev) => {
      const next = prev.map((row) => {
        if (row.birds > 0 || row.weight > 0) return row;
        if (!focusUid) focusUid = row.uid;
        return { ...row, birds: n, avgWeight: calculateBoxAvgWeight(n, row.weight) };
      });
      if (!focusUid && next[0]) focusUid = next[0].uid;
      return next;
    });
    // Birds are filled — put the caret on Weight so Tab flow starts there.
    if (focusUid) pendingWeightFocusUidRef.current = focusUid;
  };

  const [maxBoxes, setMaxBoxes] = useState<number>(() => {
    if (trip.vehicleBoxCapacity && trip.vehicleBoxCapacity > 0) return trip.vehicleBoxCapacity;
    try {
      const vehicles = getVehicles();
      const matched = vehicles.find(
        (v) =>
          (trip.vehicleId && v.id === trip.vehicleId) ||
          v.vehicleNumber?.trim().toLowerCase() === trip.vehicleNo?.trim().toLowerCase()
      );
      return matched?.noOfBoxes && matched.noOfBoxes > 0 ? matched.noOfBoxes : 0;
    } catch {
      return 0;
    }
  });

  // Resolve capacity from Vehicle Master (no_of_boxes) so Boxes shows "0 / N".
  useEffect(() => {
    let cancelled = false;
    const fromTrip =
      trip.vehicleBoxCapacity && trip.vehicleBoxCapacity > 0 ? trip.vehicleBoxCapacity : 0;
    if (fromTrip > 0) {
      setMaxBoxes(fromTrip);
      return;
    }

    void (async () => {
      try {
        const vehicles = await loadVehicles();
        if (cancelled) return;
        const matched = vehicles.find(
          (v) =>
            (trip.vehicleId && v.id === trip.vehicleId) ||
            v.vehicleNumber?.trim().toLowerCase() === trip.vehicleNo?.trim().toLowerCase()
        );
        const capacity = matched?.noOfBoxes && matched.noOfBoxes > 0 ? matched.noOfBoxes : 0;
        setMaxBoxes(capacity);
        if (capacity > 0 && capacity !== trip.vehicleBoxCapacity) {
          updateTrip({ vehicleBoxCapacity: capacity });
        }
      } catch {
        if (!cancelled) setMaxBoxes(0);
      }
    })();

    return () => {
      cancelled = true;
    };
    // updateTrip is not memoized; omit it to avoid refetching on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vehicle identity + capacity are the inputs
  }, [trip.vehicleId, trip.vehicleNo, trip.vehicleBoxCapacity]);

  const [photos, setPhotos] = useState<PickupPhoto[]>(() => photosFromTrip(trip));
  const persistedPhotos = useMemo(() => photosFromTrip({
    id: trip.id,
    dcPhotoKey: trip.dcPhotoKey,
    dcPhotoKey2: trip.dcPhotoKey2,
    dcPhotoMime: trip.dcPhotoMime,
    dcPhotoMime2: trip.dcPhotoMime2,
    dcPhotoData: trip.dcPhotoData,
    dcPhotoData2: trip.dcPhotoData2,
  }), [
    trip.id,
    trip.dcPhotoKey,
    trip.dcPhotoKey2,
    trip.dcPhotoMime,
    trip.dcPhotoMime2,
    trip.dcPhotoData,
    trip.dcPhotoData2,
  ]);
  const persistedBoxDetails = trip.boxDetails;

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which DC-photo slot (0 or 1) the picker was opened for.
  const slotIndexRef = useRef(0);
  const [, setSavedPhotoKeys] = useState(() => photosFromTrip(trip).map((photo) => photo.key));
  // ─── Toast state ────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  // Auto-clear notices (e.g. "Progress saved.") after 5 seconds.
  useEffect(() => {
    window.clearTimeout(toastTimerRef.current);
    if (!toast) return;
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(toastTimerRef.current);
  }, [toast]);

  // Background autosave for Step 3 — persists after typing settles. Uses
  // silent mode so the server response never remounts box inputs / moves the
  // caret, and never flashes header loading.
  const pickupAutosaveTimerRef = useRef<number | undefined>(undefined);
  const pickupAutosaveBusyRef = useRef(false);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState("");
  const pickupDraftFingerprint = useMemo(
    () =>
      JSON.stringify({
        legIndex: Number(trip.activeLegIndex ?? 1),
        boxes: rows.map((row) =>
          Object.fromEntries(Object.entries(row).filter(([key]) => key !== "uid"))
        ),
        removedBoxNos,
        photoKeys: photos.map((p) => p.key),
      }),
    [trip.activeLegIndex, rows, removedBoxNos, photos]
  );
  const hasUnsavedChanges = pickupDraftFingerprint !== lastSavedFingerprint;
  const pickupLocked = Boolean(trip.pickupStepSubmitted) && !editable && !isLocalEditing;
  useEffect(() => {
    if (pickupLocked || !savePickupProgress || !trip.id || isSubmitting || isSaving) return;
    if (pickupDraftFingerprint === lastSavedFingerprint) return;

    window.clearTimeout(pickupAutosaveTimerRef.current);
    pickupAutosaveTimerRef.current = window.setTimeout(() => {
      if (pickupAutosaveBusyRef.current) return;
      const boxDetails = rows.map(
        (row) =>
          Object.fromEntries(Object.entries(row).filter(([key]) => key !== "uid")) as BoxDetail
      );
      const payload = {
        activeLegIndex: Number(trip.activeLegIndex ?? 1),
        boxDetails,
        removedBoxNos,
        ...(photos[0]
          ? {
              dcPhotoKey: photos[0].key,
              dcPhotoMime: photos[0].mime,
              dcPhotoData: photos[0].data,
            }
          : {}),
        ...(photos[1]
          ? {
              dcPhotoKey2: photos[1].key,
              dcPhotoMime2: photos[1].mime,
              dcPhotoData2: photos[1].data,
            }
          : {}),
      } as Partial<Trip>;
      const fingerprint = JSON.stringify({
        legIndex: Number(trip.activeLegIndex ?? 1),
        boxes: boxDetails,
        removedBoxNos,
        photoKeys: photos.map((p) => p.key),
      });
      if (fingerprint === lastSavedFingerprint) return;
      pickupAutosaveBusyRef.current = true;
      void (async () => {
        try {
          const ok = await savePickupProgress?.(payload, { silent: true });
          if (ok) {
            setLastSavedFingerprint(fingerprint);
            setSavedPhotoKeys(photos.map((p) => p.key));
          }
        } finally {
          pickupAutosaveBusyRef.current = false;
        }
      })();
    }, 2500);

    return () => window.clearTimeout(pickupAutosaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupDraftFingerprint, lastSavedFingerprint, pickupLocked, trip.id, isSubmitting, isSaving]);

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

  useEffect(() => {
    let cancelled = false;
    const nextPhotos = persistedPhotos;
    queueMicrotask(() => {
      if (cancelled) return;
      setPhotos(nextPhotos);
      setSavedPhotoKeys(nextPhotos.map((photo) => photo.key));
    });
    return () => { cancelled = true; };
  }, [persistedPhotos]);

  // Hydrate rows only when the trip identity changes or edit mode opens.
  // Do NOT depend on trip.boxDetails — background autosave must never remount
  // inputs (new UIDs) or the caret jumps while typing.
  useEffect(() => {
    const details = persistedBoxDetails || [];
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const nextRows =
        details.length > 0 ? details.map((d) => ({ ...d, uid: generateUid() })) : [makeRow(1)];
      setRows(nextRows);
      setRemovedBoxNos([]);
      setLastSavedFingerprint(
        JSON.stringify({
          boxes: details,
          removedBoxNos: [] as number[],
          photoKeys: (persistedPhotos || []).map((p) => p.key),
        })
      );
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, isLocalEditing]);

  const totals = useMemo(() => calculatePickupTotals(rows), [rows]);

  // ─── Row operations with Max Box Limit Check ───────────────────────
  /** After Add Box, focus the new row's Weight field once it mounts. */
  useEffect(() => {
    const uid = pendingWeightFocusUidRef.current;
    if (!uid) return;
    const el = weightInputRefs.current.get(uid);
    if (!el) return;
    el.focus();
    el.select();
    pendingWeightFocusUidRef.current = null;
  }, [rows]);

  const addRow = (options?: { focusWeight?: boolean }) => {
    if (maxBoxes > 0 && rows.length >= maxBoxes) {
      setToast({
        message: t("ops.trip.box_limit_exceeded", { max: maxBoxes }),
        type: "error",
      });
      return false;
    }
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (!(lastRow.birds > 0) || !(lastRow.weight > 0)) {
        setToast({
          message: t("ops.trip.fill_current_box"),
          type: "error",
        });
        return false;
      }
    }
    const nextRow = makeRow(rows.length + 1, appliedDefaultBoxSize);
    if (options?.focusWeight) {
      pendingWeightFocusUidRef.current = nextRow.uid;
    }
    setRows((prev) => [...prev, nextRow]);
    return true;
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

  /** Tab order: Weight → Add Box → (Tab/Enter adds) → Weight of new box.
   * Birds are pre-filled from Default Box Size, so they are skipped in the tab
   * cycle (still clickable to edit). */
  const handleBirdsKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    uid: string
  ) => {
    blockScrollAndArrows(e);
    // If the user clicked into Birds, Tab still jumps to this row's Weight.
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const weightEl = weightInputRefs.current.get(uid);
      weightEl?.focus();
      weightEl?.select();
    }
  };

  const handleWeightKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    uid: string
  ) => {
    blockScrollAndArrows(e);
    if (e.key !== "Tab" || e.shiftKey) return;

    const isLast = rows.length > 0 && rows[rows.length - 1]?.uid === uid;
    if (!isLast) return;

    const canShowAdd =
      isLastRowComplete && maxBoxes > 0 && rows.length < maxBoxes;
    if (!canShowAdd) return;

    // Jump straight to Add Box (skip delete + any other chrome).
    e.preventDefault();
    requestAnimationFrame(() => addBoxButtonRef.current?.focus());
  };

  const handleAddBoxKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      addRow({ focusWeight: true });
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      addRow({ focusWeight: true });
    }
  };

  const getBoxDetails = (): BoxDetail[] => rows.map((row) => {
    return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "uid")) as BoxDetail;
  });

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
      ? formatTripViewStamp(trip.pickupStepSubmittedAt, language)
      : formatTripViewStamp(trip.pickupLoadTime, language) || ""
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
        key: `${trip.tripNo || `trip-${trip.id}`}-load-${Number(trip.activeLegIndex ?? 1)}-photo-${photos.length + 1}-${Date.now()}`,
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
      if (!photos.length) return;
      photos.forEach((photo, index) => {
        const link = document.createElement("a");
        link.href = photo.data;
        link.download = `${trip.tripNo || "trip"}-load-${Number(trip.activeLegIndex ?? 1)}-pickup-${index + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } catch (error) {
      console.error("Failed to download image:", error);
      setToast({ message: t("ops.trip.failed_download_image"), type: "error" });
    } finally {
      endAction();
    }
  };

  // ─── Manual Save ────────────────────────────────────────────────
  const handleSaveProgress = async () => {
    if (!savePickupProgress || isSaving) return;
    setIsSaving(true);
    try {
      const boxDetails = getBoxDetails();
      const success = await withMinSaveDuration(() =>
        savePickupProgress({
          boxDetails,
          removedBoxNos,
          ...photoFields(),
        } as Partial<Trip>)
      );
      if (success) {
        showNotification(t("ops.trip.progress_saved"), "success");
        setSavedPhotoKeys(photos.map((photo) => photo.key));
        setRemovedBoxNos([]);
        setLastSavedFingerprint(
          JSON.stringify({
            boxes: boxDetails,
            removedBoxNos: [],
            photoKeys: photos.map((p) => p.key),
          })
        );
      } else {
        showNotification(t("ops.trip.failed_save_pickup"), "error");
      }
    } finally {
      setIsSaving(false);
    }
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
          if (submitLockRef.current || isSubmitting) return;
          submitLockRef.current = true;
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
            submitLockRef.current = false;
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
            <h3 className="text-[17px] sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Package size={18} className="text-amber-500" />
              {t("ops.trip.title.pickup")}
            </h3>
            <TripContextBadges tripNo={trip.tripNo} vehicleNo={trip.vehicleNo} supervisorName={trip.supervisorName} driverName={trip.driverName} />
          </div>
          <div className="flex items-center gap-2 shrink-0">

            {/* Locked / view: Close X → Create New Trip (Trip Entry only) */}
            {!hideWizardClose && (
              <StepCloseButton
                onClose={() => {
                  if (onCancel) onCancel();
                  else clearForm?.();
                }}
                animated
              />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocalEditing(true)}
                className="group relative bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                aria-label={t("ops.trip.edit_step")}
              >
                <Pencil size={14} className={uiActionIconMotionClass.edit} />
              </button>
            )}
            <span className={`bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap ${hideLockedChip ? "hidden" : ""}`}>
              {t("ops.trip.submitted_locked")}
            </span>
          </div>
        </div>

        {/* Same StepKpiCard font/layout as steps 1–2 / 4–5 (time first) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-[minmax(210px,1.25fr)_repeat(4,minmax(0,1fr))] gap-3 pt-2">
          <StepKpiCard
            icon={Clock}
            tone="bg-blue-50/70 text-blue-500"
            label={t("ops.trip.captured_time")}
            value={<TripTimestampDisplay value={officialPickupTime} empty="--" />}
            cardClass="col-span-2 sm:col-span-1"
            valueClass="overflow-visible whitespace-normal text-[12px] leading-none"
          />
          <StepKpiCard
            icon={Scale}
            tone="bg-emerald-50/70 text-emerald-500"
            label={t("ops.trip.dc_wt")}
            value={trip.dcWeight ? `${Number(trip.dcWeight).toFixed(2)} ${t("common.kg")}` : t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={Bird}
            tone="bg-sky-50/70 text-sky-500"
            label={t("common.birds")}
            value={trip.totalBirds != null ? String(trip.totalBirds) : t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={Box}
            tone="bg-amber-50/70 text-amber-500"
            label={t("common.boxes")}
            value={`${trip.boxes ?? 0} / ${maxBoxes || "—"}`}
          />
          <StepKpiCard
            icon={Gauge}
            tone="bg-purple-50/70 text-purple-500"
            label={t("ops.trip.avg_wt")}
            value={trip.avgWeight ? `${trip.avgWeight} ${t("common.kg")}` : "—"}
          />
        </div>

        {/* Load-scoped submitted DC photos — visible for inspection, not only PDF. */}
        {photos.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50/80 text-emerald-500"><Camera size={16} /></span>
              <span>{t("ops.trip.photos_uploaded", { count: photos.length })} · Load {Number(trip.activeLegIndex ?? 1)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2">
              {photos.map((photo, index) => (
                <a
                  key={photo.key}
                  href={photo.data}
                  target="_blank"
                  rel="noreferrer"
                  className="group w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  aria-label={`View Load ${Number(trip.activeLegIndex ?? 1)} pickup photo ${index + 1}`}
                >
                  <img src={photo.data} alt={`Load ${Number(trip.activeLegIndex ?? 1)} pickup ${index + 1}`} className="h-16 w-28 object-contain transition-transform duration-200 group-hover:scale-[1.02]" />
                  <span className="block truncate border-t border-slate-200 bg-white px-1.5 py-1 text-[9px] font-semibold text-slate-500">Photo {index + 1} · View</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Box Table */}
        {trip.boxDetails && trip.boxDetails.length > 0 && (
          <div className="max-h-[32rem] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <colgroup>
                {Array.from({ length: 12 }).map((_, i) => (
                  <col key={i} className="w-[8.33%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase sticky top-0 z-10 border-b border-slate-200">
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
                  <tr key={idx} className="bg-white">
                    {group.map((r, colIdx) => {
                      const tone = pickupRowTone(idx);
                      return (
                      <React.Fragment key={r.boxNo}>
                        <td className={`border-l-2 ${tone.edge} ${tone.cell} text-center px-2 py-2 font-semibold border-r border-slate-200 ${colIdx > 0 ? 'pl-4' : ''}`}><span className={`inline-flex h-6 min-w-7 items-center justify-center rounded-md border px-1.5 font-bold shadow-sm ${tone.badge}`}>{r.boxNo}</span></td>
                        <td className={`${tone.cell} text-center px-2 py-2 font-bold text-slate-800 border-r border-slate-200`}>{r.birds || t("ops.trip.not_entered")}</td>
                        <td className={`${tone.cell} text-center px-2 py-2 font-semibold text-slate-800 border-r border-slate-200`}>{r.weight ? Number(r.weight).toFixed(2) : t("ops.trip.not_entered")}</td>
                        <td className={`${tone.cell} text-center px-2 py-2 font-semibold text-slate-800 ${colIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>
                          {formatAvg(Number(r.birds), Number(r.weight), r.avgWeight)}
                        </td>
                      </React.Fragment>
                      );
                    })}
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
          <p className="text-[13px] text-slate-600 font-normal">
            {t("ops.trip.pickup_submitted_ok")}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {photos.length > 0 && (
              <button
                type="button"
                onClick={downloadImage}
                disabled={busyAction !== null}
                aria-label={t("ops.trip.download_image")}
                className="group relative flex items-center justify-center p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-xs transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Download size={16} className={busyAction === "image" ? "animate-pulse" : uiActionIconMotionClass.view} />
              </button>
            )}
            <button
              type="button"
              onClick={generatePDF}
              disabled={busyAction !== null}
              aria-label={t("ops.trip.download_pdf")}
              className="group relative flex items-center justify-center p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-xs transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <FileText size={16} className={busyAction === "pdf" ? "animate-pulse" : uiActionIconMotionClass.pdf} />
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
            <h3 className="text-[17px] sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Package size={18} className="text-amber-500" />
              {t("ops.trip.title.pickup")}
            </h3>
            <TripContextBadges tripNo={trip.tripNo} vehicleNo={trip.vehicleNo} supervisorName={trip.supervisorName} driverName={trip.driverName} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Edit mode only: animated Close X → locked submitted view */}
            {(isEditMode || isLocalEditing) && trip.pickupStepSubmitted ? (
              <StepCloseButton onClose={handleExitToLocked} animated />
            ) : null}
            {(isEditMode || isLocalEditing) && trip.pickupStepSubmitted && (
              <span className="text-[13px] text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                {t("ops.trip.editable_view")}
              </span>
            )}
          </div>
        </div>

        {/* Official time capture — set once at submit, cannot be edited */}
        <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium overflow-x-auto">
          <span className="h-5 w-5 rounded-md bg-blue-50/80 text-blue-500 flex items-center justify-center shrink-0"><Clock size={ 14 } /></span>
          {officialPickupTime ? (
            <>
              <TripTimestampDisplay value={officialPickupTime} />
              <span
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5"
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
          <label className="text-[15px] font-semibold text-slate-600 flex items-center gap-2 flex-wrap">
            <span className="h-6 w-6 rounded-md bg-sky-50/80 text-sky-500 flex items-center justify-center shrink-0">
              <Camera size={14} />
            </span>
            {t("ops.trip.field.dc_photo")} {TRIP_FIELD_DEFINITIONS.dcPhotoKey.required && <span className="text-red-500">*</span>}
            <span className="text-[13px] font-normal text-slate-400">
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
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-[11px] leading-5 shadow-sm transition-all active:scale-90"
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
                >
                  <Camera size={18} />
                  <span className="text-[11px] font-bold uppercase tracking-wide">{t("ops.trip.add_photo")}</span>
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
            <p className="text-[11px] text-slate-400 flex-1 min-w-[140px]">{t("ops.trip.photo_requirements")}</p>
          </div>
        </div>

        {/* Entry Table Container */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <span className="text-[15px] font-semibold text-slate-600 flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-violet-50/80 text-violet-500 flex items-center justify-center shrink-0">
                <Package size={14} />
              </span>
              {t("ops.trip.box_entries", { max: maxBoxes || "—" })}
            </span>
            <div className="inline-flex items-end gap-2 shrink-0">
            <SearchableSelect
              label=""
              ariaLabel={`Loaded boxes, ${rows.length} available`}
              value={selectedBoxNo}
              placeholder={`Loaded boxes (${rows.length})`}
              searchPlaceholder="Search box number..."
              options={rows.map((row) => ({
                value: String(row.boxNo),
                label: `${row.boxNo} · ${row.weight || 0} kg`,
              }))}
              onChange={selectBox}
              searchable
              allowClear={false}
              selectionTone="green"
              widthClass="w-48"
            />
            <label className="inline-flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                {t("ops.trip.default_box_size")}
              </span>
              <input
                type="number"
                min={1}
                max={999}
                step={1}
                inputMode="numeric"
                placeholder="18"
                value={defaultBoxSizeDraft}
                onChange={(e) => setDefaultBoxSizeDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyDefaultBoxSize();
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className="mini-input hide-spinner w-12 h-7 text-center text-[12px] font-bold tabular-nums"
                title={t("ops.trip.default_box_size_hint")}
                aria-label={t("ops.trip.default_box_size")}
              />
              <button
                type="button"
                onClick={applyDefaultBoxSize}
                className="h-7 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-50 border border-violet-100 hover:bg-violet-100/80 active:scale-95 transition"
              >
                {t("ops.trip.default_box_size_apply")}
              </button>
              {appliedDefaultBoxSize > 0 && (
                <span className="text-[10px] font-semibold text-emerald-600 tabular-nums">
                  {t("ops.trip.default_box_size_active", { n: appliedDefaultBoxSize })}
                </span>
              )}
            </label>
            </div>
          </div>

          <div
            data-pickup-boxes
            className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-80 overflow-y-auto"
          >
            <table className="w-full table-fixed border-collapse text-[13px]">
              <colgroup>
                {Array.from({ length: 12 }).map((_, i) => (
                  <col key={i} className="w-[8.33%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase font-bold sticky top-0 z-10 border-b border-slate-200">
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
                  <tr key={idx} className="bg-white">
                    {group.map((slot, groupIdx) => {
                      if (slot.type === "add") {
                        return (
                          <td
                            key="add-box"
                            colSpan={4}
                            className={`px-1 py-1.5 bg-transparent ${groupIdx < 2 ? "border-r-2 border-slate-300" : ""}`}
                          >
                            <button
                              type="button"
                              ref={addBoxButtonRef}
                              onClick={() => addRow({ focusWeight: true })}
                              onKeyDown={handleAddBoxKeyDown}
                              className="w-full h-8 text-[11px] font-bold uppercase tracking-wide text-blue-500 bg-blue-50/70 hover:bg-blue-50/70 border border-blue-100 rounded-lg"
                            >
                              <Plus size={12} className="inline mr-1" /> {t("ops.trip.add_box")}
                            </button>
                          </td>
                        );
                      }
                      const row = slot.row;
                      const tone = pickupRowTone(idx);
                      const isSelectedBox = selectedBoxNo === String(row.boxNo);
                      return (
                      <React.Fragment key={row.uid}>
                        <td data-pickup-box-no={row.boxNo} className={`border-l-2 ${tone.edge} ${tone.cell} ${isSelectedBox ? 'ring-2 ring-inset ring-emerald-400' : ''} text-center px-1 py-1.5 font-bold text-[13px] border-r border-slate-200 ${groupIdx > 0 ? 'pl-4' : ''}`}><span className={`inline-flex h-6 min-w-7 items-center justify-center rounded-md border px-1.5 shadow-sm ${isSelectedBox ? 'border-emerald-500 bg-emerald-600 text-white' : tone.badge}`}>{row.boxNo}</span></td>
                        <td className={`${tone.cell} ${isSelectedBox ? 'ring-2 ring-inset ring-emerald-400' : ''} px-1 py-1.5 border-r border-slate-200`}>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            tabIndex={-1}
                            value={row.birds || ""}
                            onChange={(e) => updateRow(row.uid, "birds", parseInt(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            onKeyDown={(e) => handleBirdsKeyDown(e, row.uid)}
                            placeholder="0"
                            className="mini-input hide-spinner"
                            title={t("ops.trip.birds_click_to_edit")}
                          />
                        </td>
                        <td className={`${tone.cell} ${isSelectedBox ? 'ring-2 ring-inset ring-emerald-400' : ''} px-1 py-1.5 border-r border-slate-200`}>
                          <div className="flex items-center gap-0.5">
                            <input
                              ref={(el) => {
                                if (el) weightInputRefs.current.set(row.uid, el);
                                else weightInputRefs.current.delete(row.uid);
                              }}
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.weight || ""}
                              onChange={(e) => updateRow(row.uid, "weight", parseFloat(e.target.value) || 0)}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => handleWeightKeyDown(e, row.uid)}
                              placeholder="0.00"
                              className="mini-input hide-spinner"
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => removeRow(row.uid)}
                              disabled={rows.length === 1}
                              className="mini-delete shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                        <td className={`${tone.cell} ${isSelectedBox ? 'ring-2 ring-inset ring-emerald-400' : ''} text-center px-1 py-1.5 text-[13px] font-semibold text-slate-700 ${groupIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>
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
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-[13px] bg-transparent border-r border-slate-200 ${emptyIdx > 0 ? 'pl-4' : ''}`}>—</td>
                            <td className="text-center px-1 py-1.5 text-slate-300 text-[13px] bg-transparent border-r border-slate-200">—</td>
                            <td className="text-center px-1 py-1.5 text-slate-300 text-[13px] bg-transparent border-r border-slate-200">—</td>
                            <td className={`text-center px-1 py-1.5 text-slate-300 text-[13px] bg-transparent ${emptyIdx < 2 ? 'border-r-2 border-slate-300' : ''}`}>—</td>
                          </React.Fragment>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {t("ops.trip.box_tab_hint")}
            {!isLastRowComplete && rows.length > 0 && (
              <span className="text-amber-500 ml-2">⚠️ {t("ops.trip.fill_current_box_warn")}</span>
            )}
            {rows.length >= maxBoxes && (
              <span className="text-red-500 ml-2 font-bold">🚫 {t("ops.trip.box_limit_reached", { max: maxBoxes })}</span>
            )}
          </p>
        </div>

        {/* Totals — same StepKpiCard font as locked view / other steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <StepKpiCard
            icon={Box}
            tone="bg-amber-50/70 text-amber-500"
            label={t("common.boxes")}
            value={`${totals.boxes} / ${maxBoxes || "—"}`}
          />
          <StepKpiCard
            icon={Bird}
            tone="bg-sky-50/70 text-sky-500"
            label={t("common.birds")}
            value={String(totals.totalBirds)}
          />
          <StepKpiCard
            icon={Scale}
            tone="bg-emerald-50/70 text-emerald-500"
            label={t("ops.trip.dc_wt")}
            value={`${totals.dcWeight.toFixed(2)} ${t("common.kg")}`}
          />
          <StepKpiCard
            icon={Gauge}
            tone="bg-purple-50/70 text-purple-500"
            label={t("ops.trip.avg_wt")}
            value={totals.avgWeight > 0 ? `${totals.avgWeight} ${t("common.kg")}` : "—"}
          />
        </div>

        <WizardActionBar
          notice={toast ? { type: toast.type, message: toast.message } : null}
          dirty={hasUnsavedChanges}
          onCancel={handleCancel}
          onSave={savePickupProgress ? handleSaveProgress : undefined}
          onSubmit={handleSubmit}
          busy={isSaving || isSubmitting}
          saveDisabled={false}
          submitDisabled={!canSubmit || (trip.pickupStepSubmitted && !isEditMode)}
          submitLabel={isEditMode ? "ops.trip.update_pickup" : "ops.trip.submit_pickup"}
        />
      </div>

      {/* Confirmation Modal */}
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
    </>
  );
}
