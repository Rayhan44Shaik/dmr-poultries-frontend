// src/modules/operations/vehicle-trips/components/Step_5/DieselExpensesTable.tsx

import React, { useRef, useState, useEffect, useCallback } from "react";
import { AlertTriangle, Plus, Gauge, CheckCircle2, Circle, Upload, MapPin, Loader2 } from "lucide-react";
import {
  submitTripDiesel,
  updateTripDiesel,
  handleApiError,
} from "../../services/tripHeaderApiService";

import type { Trip } from "../../types/trip";
import {
  isMeterInvalid,
  collectDieselMeterSlots,
  findMeterChainIssues,
  findLaterBillsBelow,
} from "../../utils/meterValidation";
import { GpsAddressText } from "../GpsAddressText";
import { BillPreviewLink } from "./BillPreviewLink";

import { useSafeNotification } from "../../../../../hooks/useSafeNotification";
import { compressImageFile } from "../../../../../utils/compressImage";
import { captureGpsQuiet } from "../../utils/captureGps";
import { loadBirdTypes } from "../../../../masters/bird-types/services/birdTypeService";
import type { BirdType } from "../../../../masters/bird-types/types/birdType";

import { useI18n } from "../../../../../i18n";

interface DieselExpensesTableProps {
  tripId: number;
  sheetData: any;
  handleChange: (field: string, value: any) => void;
  applyBatchUpdates: (updates: Record<string, any>) => void;
  dieselAmounts: number[];
  totalDieselAmount: number;
  showNotification?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  destMeter: number;
  readOnly?: boolean;
  onTripSynced?: (trip: Trip) => void;
  isRentedVehicle?: boolean;
}

const OTHER_BUNK_VALUE = "__other__";

function isValidGps(lat: unknown, lon: unknown) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

function isPositive(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function hasRealBill(image: unknown) {
  if (typeof image !== "string") return false;
  const s = image.trim();
  if (!s || /^(bill|key|true|yes)$/i.test(s)) return false;
  // data: URLs (JPEG/PNG/SVG) or long base64 bill images
  if (s.startsWith("data:image") || s.startsWith("blob:") || s.startsWith("http")) return true;
  return s.length >= 40;
}

/** Collect every diesel row slot on the sheet — no max count. */
function collectDieselSlotIndices(data: Record<string, unknown> | null | undefined): number[] {
  const found = new Set<number>();
  if (!data) return [];
  for (const key of Object.keys(data)) {
    const m = key.match(
      /^diesel(?:Ltr|Rate|Meter|Bunk|BunkSource|FuelBunkId|OtherBunk|Image|ImageName|Submitted|SubmittedAt|Id|ClientKey|GpsLat|GpsLon|GpsAccuracy|GpsCapturedAt|Amount)(\d+)$/
    );
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1) found.add(n);
    }
  }
  return Array.from(found).sort((a, b) => a - b);
}

/** True when a diesel slot has any meaningful content. */
function dieselSlotActive(data: Record<string, unknown>, i: number): boolean {
  return !!(
    data[`dieselSubmitted${i}`] ||
    data[`dieselLtr${i}`] ||
    data[`dieselRate${i}`] ||
    data[`dieselAmount${i}`] ||
    data[`dieselMeter${i}`] ||
    data[`dieselBunk${i}`] ||
    data[`dieselImage${i}`] ||
    data[`dieselId${i}`]
  );
}

/** Visible diesel rows: submitted/active sheet slots, plus empty rows the user
 *  explicitly opened with + Add Diesel Entry. Never keep a phantom slot 1 after
 *  a remount when bills already live on 2, 3, 4 (delete-then-re-add). */
export function mergeVisibleDieselRows(
  prev: number[],
  activeFromSheet: number[],
  keepEmpty: ReadonlySet<number>
): number[] {
  const draftOnly = prev.filter(
    (n) => n >= 1 && !activeFromSheet.includes(n) && keepEmpty.has(n)
  );
  const next = Array.from(new Set([...activeFromSheet, ...draftOnly])).sort((a, b) => a - b);
  return next.length > 0 ? next : [1];
}

function dieselRowsFromSheet(data: Record<string, unknown>): number[] {
  const slots = collectDieselSlotIndices(data).filter((i) => dieselSlotActive(data, i));
  return slots.length > 0 ? slots : [1];
}

export default function DieselExpensesTable({
  tripId,
  sheetData,
  handleChange,
  applyBatchUpdates,
  dieselAmounts: _dieselAmounts,
  destMeter,
  showNotification,
  readOnly = false,
  isRentedVehicle = false,
}: DieselExpensesTableProps) {
  const { t } = useI18n();
  const { showNotification: showCornerNotification } = useSafeNotification();
  const gpsRequestRef = useRef<Record<number, number>>({});
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [meterErrors, setMeterErrors] = useState<{ [key: number]: string }>({});
  const [isFetchingGPS, setIsFetchingGPS] = useState<{ [key: number]: boolean }>({});
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [fuelBunks, setFuelBunks] = useState<BirdType[]>([]);
  useEffect(() => {
    let active = true;
    void loadBirdTypes().then((rows) => {
      if (active) setFuelBunks(rows.filter((row) => row.category === "Fuel Bunk" && row.status === "Active"));
    }).catch(() => { if (active) setFuelBunks([]); });
    return () => {
      active = false;
    };
  }, []);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [, setIsEditingSubmitted] = useState(false);
  const [draftData, setDraftData] = useState<Record<string, any>>({});
  const [rowIndices, setRowIndices] = useState<number[]>(() =>
    dieselRowsFromSheet(sheetData as Record<string, unknown>)
  );
  /** Empty slots opened via + Add Diesel Entry — kept across sheet hydrates,
   *  dropped on remount so a leftover S.No 01 does not reappear. */
  const keepEmptySlotsRef = useRef<Set<number>>(new Set());
  const [draftClientKey, setDraftClientKey] = useState<string>(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `diesel-${Date.now()}`
  );

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const fallbackDateStr = `${yyyy}${mm}${dd}`;

  /** Keep visible rows in sync when parent hydrates dieselEntries → sheet slots
   *  (API dieselEntries / resume). No upper limit on how many diesel bills. */
  useEffect(() => {
    const slots = collectDieselSlotIndices(sheetData as Record<string, unknown>);
    const activeFromSheet = slots.filter((i) =>
      dieselSlotActive(sheetData as Record<string, unknown>, i)
    );
    for (const n of activeFromSheet) keepEmptySlotsRef.current.delete(n);
    setRowIndices((prev) => {
      const final = mergeVisibleDieselRows(prev, activeFromSheet, keepEmptySlotsRef.current);
      const same = prev.length === final.length && prev.every((v, i) => v === final[i]);
      return same ? prev : final;
    });
  }, [sheetData, tripId]);

  const notifyUser = (msg: string, type: "warning" | "error" | "success" = "warning") => {
    (showNotification ?? showCornerNotification)(msg, type);
  };

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
  };

  /** Validate that a single diesel bill litres is in valid range (0, 100].
   * Returns { valid, message } for the caller to display inline.
   */
  const validateLitresRange = (value: number): { valid: boolean; message: string | null } => {
    if (value <= 0 || !Number.isFinite(value)) return { valid: false, message: t("ops.trip.diesel_ltr_must_be_positive") };
    if (value > 100) return { valid: false, message: t("ops.trip.diesel_exceeds_100_litres") };
    return { valid: true, message: null };
  };

  /** Inline validation message for litres range. Displayed below the litres field. */
  const litresRangeError = (num: number): string | null => {
    const data = sheetData;
    const ltr = data[`dieselLtr${num}`];
    const litresNum = Number(ltr);
    const range = validateLitresRange(litresNum);
    return range.message ?? null;
  };

  /** Blur on wheel so focused number fields don't nudge values while scrolling.
   *  Do not call preventDefault — React registers wheel as passive.
   */
  const blockWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const getFieldValue = (field: string, num: number) => {
    if (editingRow === num && draftData[field] !== undefined) {
      return draftData[field];
    }
    return sheetData[field];
  };

  const setDraftField = (field: string, value: any) => {
    setDraftData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldChange = (field: string, num: number, value: any) => {
    if (editingRow === num) {
      setDraftField(field, value);
    } else {
      handleChange(field, value);
    }
  };

  const handleAddRow = () => {
    const lastRow = rowIndices[rowIndices.length - 1] ?? 0;
    // Require the current last entry to be submitted before opening a new slot.
    if (lastRow > 0 && !sheetData[`dieselSubmitted${lastRow}`]) {
      notifyUser(t("ops.trip.submit_diesel_first"), "warning");
      return;
    }
    // Next free id — no upper limit on diesel bills.
    let nextId = lastRow + 1;
    if (rowIndices.includes(nextId)) {
      nextId = Math.max(0, ...rowIndices) + 1;
    }
    if (!nextId || nextId < 1) nextId = 1;
    const nextKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `diesel-${Date.now()}`;
    applyBatchUpdates({
      [`dieselLtr${nextId}`]: "",
      [`dieselRate${nextId}`]: "",
      [`dieselMeter${nextId}`]: "",
      [`dieselBunk${nextId}`]: "",
      [`dieselBunkSource${nextId}`]: "",
      [`dieselFuelBunkId${nextId}`]: "",
      [`dieselOtherBunk${nextId}`]: "",
      [`dieselGpsLat${nextId}`]: "",
      [`dieselGpsLon${nextId}`]: "",
      [`dieselGpsAccuracy${nextId}`]: "",
      [`dieselGpsCapturedAt${nextId}`]: "",
      [`dieselImage${nextId}`]: "",
      [`dieselImageName${nextId}`]: "",
      [`dieselSubmitted${nextId}`]: false,
      [`dieselId${nextId}`]: "",
      [`dieselClientKey${nextId}`]: nextKey,
    });
    setDraftClientKey(nextKey);
    keepEmptySlotsRef.current.add(nextId);
    setRowIndices((prev) => (prev.includes(nextId) ? prev : [...prev, nextId].sort((a, b) => a - b)));
    // Open the new row for editing so Upload Bill is immediately available.
    setEditingRow(nextId);
    setIsEditingSubmitted(false);
    setDraftData({
      [`dieselLtr${nextId}`]: "",
      [`dieselRate${nextId}`]: "",
      [`dieselMeter${nextId}`]: "",
      [`dieselBunk${nextId}`]: "",
      [`dieselBunkSource${nextId}`]: "",
      [`dieselFuelBunkId${nextId}`]: "",
      [`dieselOtherBunk${nextId}`]: "",
      [`dieselGpsLat${nextId}`]: "",
      [`dieselGpsLon${nextId}`]: "",
      [`dieselGpsAccuracy${nextId}`]: "",
      [`dieselGpsCapturedAt${nextId}`]: "",
      [`dieselImage${nextId}`]: "",
      [`dieselImageName${nextId}`]: "",
      [`dieselClientKey${nextId}`]: nextKey,
      [`dieselId${nextId}`]: "",
    });
    notifyUser(t("ops.trip.new_row_added"), "success");
  };

  const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Accept common camera formats; compressor normalises to JPEG.
    const okType =
      ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", ""].includes(
        file.type
      ) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!okType) {
      notifyUser(t("ops.trip.bill_jpeg_png"), "error");
      e.target.value = "";
      return;
    }
    // Up to 8 MB accepted — auto-compressed to ≤ ~120 KB for storage.
    if (file.size > 8 * 1024 * 1024) {
      notifyUser(t("ops.trip.image_size_5mb"), "error");
      e.target.value = "";
      return;
    }
    const sequence = String(index).padStart(3, "0");
    try {
      const compressed = await compressImageFile(file, {
        maxBytes: 120 * 1024,
        maxDimension: 1800,
        minDimension: 720,
      });
      let result = compressed.dataUrl;
      // If codec failed (e.g. HEIC), fall back to raw FileReader data URL when possible.
      if (!result || (!/^data:image\//i.test(result) && !result.startsWith("blob:"))) {
        result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read_failed"));
          reader.readAsDataURL(file);
        });
      }
      if (!result || !/^data:image\//i.test(result)) {
        notifyUser(t("ops.trip.failed_read_image"), "error");
        e.target.value = "";
        return;
      }
      const newFileName = `BILL-${fallbackDateStr}-${sequence}.jpg`;
      const imagePatch = {
        [`dieselImageName${index}`]: newFileName,
        [`dieselImage${index}`]: result,
      };
      // Always persist on the sheet immediately.
      applyBatchUpdates(imagePatch);

      const rowWasSubmitted = !!sheetData[`dieselSubmitted${index}`];
      // Submitted rows must enter edit mode so Save/Submit can keep the new bill.
      // Do this here (after file pick) — never defer the file dialog itself.
      if (editingRow === index) {
        setDraftData((prev) => ({ ...prev, ...imagePatch }));
      } else if (rowWasSubmitted) {
        setDraftData({ ...sheetData, ...imagePatch });
        setIsEditingSubmitted(true);
        setEditingRow(index);
      }
      if (compressed.compressed) {
        notifyUser(
          t("ops.trip.photo_auto_compressed", {
            from: Math.round(compressed.originalBytes / 1024),
            to: Math.round(compressed.storedBytes / 1024),
          }),
          "success"
        );
      } else {
        notifyUser(t("ops.trip.bill_uploaded_row", { row: index }), "success");
      }
    } catch {
      notifyUser(t("ops.trip.failed_read_image"), "error");
    }
    e.target.value = "";
  };

  /** Open the bill file picker in the SAME user click.
   * Browsers block file dialogs opened after setTimeout/async — that was why
   * Upload Bill appeared to do nothing on already-submitted diesel rows.
   */
  const openBillPicker = (num: number) => {
    if (readOnly) return;
    const input = fileInputRefs.current[num];
    if (!input) {
      notifyUser(t("ops.trip.failed_read_image"), "error");
      return;
    }
    input.value = "";
    input.click();
  };

  const handleGetOtherLocation = (index: number) => {
    const requestId = (gpsRequestRef.current[index] ?? 0) + 1;
    gpsRequestRef.current[index] = requestId;
    const captureIntoDraft = editingRow === index;
    setIsFetchingGPS((prev) => ({ ...prev, [index]: true }));

    void captureGpsQuiet({ timeoutMs: 8000 }).then((gps) => {
      if (gpsRequestRef.current[index] !== requestId) return;
      if (gps) {
        const gpsPatch = {
          [`dieselGpsLat${index}`]: gps.latitude,
          [`dieselGpsLon${index}`]: gps.longitude,
          [`dieselGpsAccuracy${index}`]: gps.accuracy,
          [`dieselGpsCapturedAt${index}`]: gps.capturedAt,
        };
        if (captureIntoDraft) {
          setDraftData((prev) => ({ ...prev, ...gpsPatch }));
        } else {
          applyBatchUpdates(gpsPatch);
        }
      } else {
        // Diesel GPS is optional: leave the fields empty rather than storing
        // fabricated coordinates, and tell the operator what to do.
        notifyUser(t("ops.trip.gps_unavailable"), "warning");
      }
      setIsFetchingGPS((prev) => ({ ...prev, [index]: false }));
    });
  };

  const handleBunkChange = (num: number, value: string) => {
    if (value === OTHER_BUNK_VALUE) {
      handleFieldChange(`dieselBunk${num}`, num, OTHER_BUNK_VALUE);
      handleFieldChange(`dieselBunkSource${num}`, num, "OTHER");
      handleFieldChange(`dieselFuelBunkId${num}`, num, "");
    } else {
      const master = fuelBunks.find((bunk) => bunk.birdType === value);
      handleFieldChange(`dieselBunk${num}`, num, value);
      handleFieldChange(`dieselBunkSource${num}`, num, "MASTER");
      handleFieldChange(`dieselFuelBunkId${num}`, num, master?.id ?? "");
      handleFieldChange(`dieselOtherBunk${num}`, num, "");
    }
  };

  const handleBunkOtherChange = (num: number, value: string) => {
    handleFieldChange(`dieselOtherBunk${num}`, num, value);
  };

  const handleRowSubmit = async (num: number) => {
    if (busyRow !== null) return;
    const useDraft = editingRow === num;
    const dataForCheck = useDraft ? draftData : sheetData;
    const thisMeter = Number(dataForCheck[`dieselMeter${num}`]);

    // Backward check: this reading must be greater than the previous diesel bill.
    const liveMeterErr = meterViolation(num, dataForCheck[`dieselMeter${num}`], useDraft ? dataForCheck : undefined);
    if (liveMeterErr) {
      setMeterErrors((prev) => ({ ...prev, [num]: liveMeterErr }));
      // The top banner beside Last Entered Meter is the single visible message.
      return;
    }

    // Forward check: when saving bill-1 high, flag any later bill that is already lower
    // (e.g. submit S.No 01 = 36985 while S.No 02 = 36981).
    if (Number.isFinite(thisMeter) && thisMeter > 0) {
      const snap = useDraft ? { ...sheetData, ...dataForCheck } : { ...sheetData };
      snap[`dieselMeter${num}`] = thisMeter;
      const slots = collectDieselMeterSlots(
        rowIndices,
        (row) => snap[`dieselMeter${row}`],
        (row) => {
          const idx = rowIndices.indexOf(row);
          return idx >= 0 ? idx : row - 1;
        }
      );
      const laterIssues = findLaterBillsBelow(slots, num, thisMeter);
      if (laterIssues.length > 0) {
        const errs: { [key: number]: string } = { ...scanMeterChainErrors(snap) };
        for (const issue of laterIssues) {
          errs[issue.row] = formatMeterChainMsg(issue);
        }
        // Also stamp the submitted row so chainBanner picks the forward message.
        errs[num] =
          t("ops.trip.meter_later_below", {
            sno: snoForRow(num),
            meter: thisMeter,
            laterSno: laterIssues[0].sno,
            laterMeter: laterIssues[0].meter,
          });
        setMeterErrors(errs);
        // Single top banner only — no toast / no under-field copy.
        return;
      }
    }

    if (!rowReady(num, useDraft)) {
      notifyUser(rowBlockReason(num, useDraft) || t("ops.trip.fill_mandatory_diesel", { row: num }), "error");
      return;
    }
    if (!tripId) {
      notifyUser(t("ops.trip.trip_id_missing"), "error");
      return;
    }
    const data = useDraft ? draftData : sheetData;
    const selectedBunk = String(data[`dieselBunk${num}`] || "").trim();
    const resolvedBunkName = selectedBunk === OTHER_BUNK_VALUE
      ? String(data[`dieselOtherBunk${num}`] || "").trim()
      : selectedBunk;
    const clientKey = String(data[`dieselClientKey${num}`] || draftClientKey);
    if (!data[`dieselClientKey${num}`]) {
      if (useDraft) {
        setDraftField(`dieselClientKey${num}`, clientKey);
      } else {
        applyBatchUpdates({ [`dieselClientKey${num}`]: clientKey });
      }
    }
    const payload = {
      clientKey,
      litres: Number(data[`dieselLtr${num}`]),
      amount: Number(data[`dieselAmount${num}`]),
      rate: Number((Number(data[`dieselAmount${num}`]) / Number(data[`dieselLtr${num}`])).toFixed(2)),
      meter: Number(data[`dieselMeter${num}`]),
      bunkName: resolvedBunkName,
      bunkSource: selectedBunk === OTHER_BUNK_VALUE ? "OTHER" as const : "MASTER" as const,
      fuelBunkId: selectedBunk === OTHER_BUNK_VALUE
        ? null
        : fuelBunks.find((bunk) => bunk.birdType === selectedBunk)?.id ?? null,
      gpsLat: Number(data[`dieselGpsLat${num}`]),
      gpsLon: Number(data[`dieselGpsLon${num}`]),
      gpsAccuracy: data[`dieselGpsAccuracy${num}`] === "" ? null : Number(data[`dieselGpsAccuracy${num}`]),
      gpsCapturedAt: data[`dieselGpsCapturedAt${num}`] || null,
      imageData: String(data[`dieselImage${num}`]),
      imageName: data[`dieselImageName${num}`] || null,
      // Keep stable row slot so mock/backend re-hydrate maps to the same column.
      rowIndex: num,
    };
    setBusyRow(num);
    try {
      const entryId = Number(data[`dieselId${num}`]);
      const saved =
        entryId > 0
          ? await updateTripDiesel(tripId, entryId, payload)
          : await submitTripDiesel(tripId, payload);

      // Prefer API dieselEntries flatten. If the response has no entries yet
      // (edge case), still write the values we just submitted so the edit sticks.
      const flattened = flattenDieselEntries(saved as Trip);
      const hasThisRow =
        flattened[`dieselLtr${num}`] !== "" && flattened[`dieselLtr${num}`] != null;
      if (!hasThisRow) {
        flattened[`dieselId${num}`] = entryId > 0 ? entryId : flattened[`dieselId${num}`] || "";
        flattened[`dieselLtr${num}`] = payload.litres;
        flattened[`dieselRate${num}`] = payload.rate;
        flattened[`dieselAmount${num}`] = payload.amount;
        flattened[`dieselMeter${num}`] = payload.meter;
        flattened[`dieselBunk${num}`] = payload.bunkName;
        flattened[`dieselBunkSource${num}`] = payload.bunkSource;
        flattened[`dieselFuelBunkId${num}`] = payload.fuelBunkId ?? "";
        flattened[`dieselGpsLat${num}`] = payload.gpsLat;
        flattened[`dieselGpsLon${num}`] = payload.gpsLon;
        flattened[`dieselGpsAccuracy${num}`] = payload.gpsAccuracy ?? "";
        flattened[`dieselGpsCapturedAt${num}`] = payload.gpsCapturedAt ?? "";
        flattened[`dieselImage${num}`] = payload.imageData;
        flattened[`dieselImageName${num}`] = payload.imageName ?? flattened[`dieselImageName${num}`] ?? "";
        flattened[`dieselSubmitted${num}`] = true;
        flattened[`dieselClientKey${num}`] = payload.clientKey;
      }
      // Never drop the bill we just uploaded — some responses omit large imageData.
      if (payload.imageData && !hasRealBill(flattened[`dieselImage${num}`])) {
        flattened[`dieselImage${num}`] = payload.imageData;
        flattened[`dieselImageName${num}`] = payload.imageName ?? flattened[`dieselImageName${num}`] ?? "";
      }
      if (payload.imageData && hasRealBill(payload.imageData)) {
        // Prefer the bill the user just sent over a stale/empty server copy.
        flattened[`dieselImage${num}`] = payload.imageData;
        if (payload.imageName) flattened[`dieselImageName${num}`] = payload.imageName;
      }
      flattened[`dieselSubmitted${num}`] = true;
      applyBatchUpdates(flattened);
      // Leave edit mode so the submitted row locks; the visible row list is
      // already correct, so no row-index rebuild is needed here.
      setEditingRow(null);
      setDraftData({});
      notifyUser(t("ops.trip.row_submitted", { row: num }), "success");
    } catch (err) {
      const raw = handleApiError(err);
      const lower = raw.toLowerCase();
      const message =
        lower === "not found" || lower.includes("was not found")
          ? t("ops.trip.failed_save_diesel")
          : raw || t("ops.trip.failed_save_diesel");
      notifyUser(message, "error");
    } finally {
      setBusyRow(null);
    }
  };

  const absoluteDestMeter = destMeter || 0;
  const rowIndicesKey = rowIndices.join(",");

  /** Diesel readings are ordered only against other diesel bills. A filling
   * may occur before or after the farm reading, so row 1 has no farm-meter
   * minimum; row N must still be greater than the previous diesel bill.
   */
  const getMinAllowedMeter = (num: number, overrideData?: Record<string, unknown>) => {
    const ordered = [...rowIndices].sort((a, b) => a - b);
    const pos = ordered.indexOf(num);
    const prior = pos > 0 ? ordered.slice(0, pos).reverse() : [];

    for (const i of prior) {
      let prevVal: unknown;
      if (overrideData && overrideData[`dieselMeter${i}`] !== undefined) {
        prevVal = overrideData[`dieselMeter${i}`];
      } else if (editingRow === i && draftData[`dieselMeter${i}`] !== undefined) {
        prevVal = draftData[`dieselMeter${i}`];
      } else {
        prevVal = sheetData[`dieselMeter${i}`];
      }
      if (prevVal !== undefined && prevVal !== "" && Number.isFinite(Number(prevVal)) && Number(prevVal) > 0) {
        return {
          minAllowed: Number(prevVal),
          referenceLabel: t("ops.trip.row_label", { row: i, meter: Number(prevVal) }),
        };
      }
    }
    return { minAllowed: 0, referenceLabel: "" };
  };

  /** Resolve meter value for a row (draft / override / sheet). */
  const resolveMeterValue = useCallback(
    (row: number, overrideData?: Record<string, unknown>): unknown => {
      if (overrideData && overrideData[`dieselMeter${row}`] !== undefined) {
        return overrideData[`dieselMeter${row}`];
      }
      if (editingRow === row && draftData[`dieselMeter${row}`] !== undefined) {
        return draftData[`dieselMeter${row}`];
      }
      return sheetData[`dieselMeter${row}`];
    },
    [editingRow, draftData, sheetData]
  );

  const formatMeterChainMsg = useCallback(
    (issue: {
      sno: string;
      meter: number;
      prevSno: string;
      prevMeter: number;
      laterThanSubmitted?: boolean;
    }) => {
      if (issue.laterThanSubmitted) {
        return t("ops.trip.meter_later_below_short", {
          laterSno: issue.sno,
          laterMeter: issue.meter,
          meter: issue.prevMeter,
        });
      }
      return t("ops.trip.meter_chain_banner", {
        sno: issue.sno,
        meter: issue.meter,
        prevSno: issue.prevSno === "Farm" ? t("ops.trip.last_entered_meter") : issue.prevSno,
        prevMeter: issue.prevMeter,
      });
    },
    [t]
  );

  /** Scan all visible rows and flag any reading that is ≤ the previous one. */
  const scanMeterChainErrors = useCallback(
    (overrideData?: Record<string, unknown>): { [key: number]: string } => {
      const slots = collectDieselMeterSlots(rowIndices, (row) => resolveMeterValue(row, overrideData), (row) => {
        const idx = rowIndices.indexOf(row);
        return idx >= 0 ? idx : row - 1;
      });
      const issues = findMeterChainIssues(slots);
      const errs: { [key: number]: string } = {};
      for (const issue of issues) {
        errs[issue.row] = formatMeterChainMsg(issue);
      }
      return errs;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowIndicesKey, resolveMeterValue, formatMeterChainMsg]
  );

  // Flag bad chains on load / when dest meter or rows change (e.g. 36981 after 36985).
  useEffect(() => {
    const errs = scanMeterChainErrors();
    setMeterErrors((old) => {
      const oldKeys = Object.keys(old);
      const newKeys = Object.keys(errs);
      const same =
        oldKeys.length === newKeys.length && newKeys.every((k) => old[Number(k)] === errs[Number(k)]);
      return same ? old : errs;
    });
  }, [scanMeterChainErrors]);

  /** Single top banner: prefer live chain scan, else any stored meterErrors message. */
  const chainBannerMessages = (() => {
    const slots = collectDieselMeterSlots(
      rowIndices,
      (row) => resolveMeterValue(row),
      (row) => {
        const idx = rowIndices.indexOf(row);
        return idx >= 0 ? idx : row - 1;
      }
    );
    const fromScan = findMeterChainIssues(slots).map(formatMeterChainMsg);
    if (fromScan.length) return [fromScan[0]];
    const fromState = Object.keys(meterErrors)
      .map((k) => meterErrors[Number(k)])
      .filter(Boolean);
    return fromState.length ? [fromState[0]] : [];
  })();

  const meterViolation = (num: number, value: unknown, overrideData?: Record<string, unknown>): string | null => {
    if (value === "" || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const endMeter = Number(overrideData?.endMeter ?? draftData.endMeter ?? sheetData.endMeter ?? 0);
    if (endMeter > 0 && n > endMeter) {
      return t("ops.trip.meter_exceeds_end", { meter: endMeter });
    }
    const { minAllowed } = getMinAllowedMeter(num, overrideData);
    if (minAllowed > 0 && isMeterInvalid(n, minAllowed)) {
      // Prefer S.No-style message when the previous bar is another diesel row.
      const slots = collectDieselMeterSlots(
        rowIndices,
        (row) => (row === num ? n : resolveMeterValue(row, overrideData)),
        (row) => {
          const idx = rowIndices.indexOf(row);
          return idx >= 0 ? idx : row - 1;
        }
      );
      const issue = findMeterChainIssues(slots).find((i) => i.row === num);
      if (issue) return formatMeterChainMsg(issue);
      return t("ops.trip.meter_must_gt", { min: minAllowed });
    }
    return null;
  };

  const handleMeterChange = (num: number, raw: string) => {
    const value = raw === "" ? "" : Number(raw);
    handleFieldChange(`dieselMeter${num}`, num, value);
    const draftSnap =
      editingRow === num
        ? { ...draftData, [`dieselMeter${num}`]: value }
        : { ...sheetData, [`dieselMeter${num}`]: value };
    // Full chain scan so bill-2 < bill-1 is always caught immediately.
    setMeterErrors(scanMeterChainErrors(draftSnap));
  };

  /** Visible S.No for a table row index (01, 02…). */
  const snoForRow = useCallback(
    (row: number) => {
      const idx = rowIndices.indexOf(row);
      const display = idx >= 0 ? idx : row - 1;
      return String(display + 1).padStart(2, "0");
    },
    [rowIndices]
  );

  /** Later bills already lower than the meter we're about to save for `num`. */
  const laterBillsBlocking = (num: number, useDraft = false) => {
    const data = useDraft && editingRow === num ? { ...sheetData, ...draftData } : sheetData;
    const reading = Number(data[`dieselMeter${num}`]);
    if (!Number.isFinite(reading) || reading <= 0) return [];
    const slots = collectDieselMeterSlots(
      rowIndices,
      (row) => (row === num ? reading : resolveMeterValue(row, useDraft ? data : undefined)),
      (row) => {
        const idx = rowIndices.indexOf(row);
        return idx >= 0 ? idx : row - 1;
      }
    );
    return findLaterBillsBelow(slots, num, reading);
  };

  const rowReady = (num: number, useDraft = false) => {
    const data = useDraft && editingRow === num ? draftData : sheetData;
    const ltr = data[`dieselLtr${num}`];
    const amount = data[`dieselAmount${num}`];
    const reading = data[`dieselMeter${num}`];
    const selectedBunk = String(data[`dieselBunk${num}`] || "").trim();
    const bunkName = selectedBunk === OTHER_BUNK_VALUE
      ? String(data[`dieselOtherBunk${num}`] || "").trim()
      : selectedBunk;
    // Bunk city is optional (short city name). GPS + bill are mandatory.
    const image = data[`dieselImage${num}`];
    const lat = data[`dieselGpsLat${num}`];
    const lon = data[`dieselGpsLon${num}`];
    const meterErr = isRentedVehicle ? null : meterErrors[num] || meterViolation(num, reading, useDraft ? data : undefined);
    // Fix: single assignment with proper logic
    const laterBlock = !isRentedVehicle && laterBillsBlocking(num, useDraft).length > 0;
    const litresNum = Number(ltr);
    const litresRange = validateLitresRange(litresNum);

    return (
      isPositive(ltr) &&
      isPositive(amount) &&
      (isRentedVehicle || isPositive(reading)) &&
      bunkName.length > 0 &&
      hasRealBill(image) &&
      isValidGps(lat, lon) &&
      !meterErr &&
      litresRange.valid &&
      !laterBlock
    );
  };

  const rowBlockReason = (num: number, useDraft = false): string | null => {
    const data = useDraft && editingRow === num ? draftData : sheetData;
    const reasons: string[] = [];
    if (meterErrors[num]) reasons.push(meterErrors[num]);
    if (!isPositive(data[`dieselLtr${num}`])) reasons.push(t("ops.trip.diesel_ltr_required"));
    if (!isPositive(data[`dieselAmount${num}`])) {
      reasons.push(t("ops.trip.amount_greater_zero"));
    }
    if (!isRentedVehicle && !isPositive(data[`dieselMeter${num}`])) reasons.push(t("ops.trip.reading_required"));
    const selectedBunk = String(data[`dieselBunk${num}`] || "").trim();
    const bunkName = selectedBunk === OTHER_BUNK_VALUE
      ? String(data[`dieselOtherBunk${num}`] || "").trim()
      : selectedBunk;
    if (!bunkName) reasons.push(t("ops.trip.bunk_required"));
    const meterErr = isRentedVehicle ? null : meterViolation(num, data[`dieselMeter${num}`], useDraft ? data : undefined);
    if (meterErr && !reasons.includes(meterErr)) reasons.push(meterErr);
    const later = laterBillsBlocking(num, useDraft);
    if (later.length > 0) {
      const issue = later[0];
      reasons.push(t("ops.trip.meter_later_below", {
        sno: snoForRow(num),
        meter: Number(data[`dieselMeter${num}`]),
        laterSno: issue.sno,
        laterMeter: issue.meter,
      }));
    }
    // GPS is mandatory; bunk city is optional free-text (Kodad / Vijayawada…).
    if (!isValidGps(data[`dieselGpsLat${num}`], data[`dieselGpsLon${num}`])) {
      reasons.push(t("ops.trip.gps_must_captured"));
    }
    if (!hasRealBill(data[`dieselImage${num}`])) reasons.push(t("ops.trip.bill_image_required"));
    const meter = Number(data[`dieselMeter${num}`]);
    const image = String(data[`dieselImage${num}`] || "");
    const clientKey = String(data[`dieselClientKey${num}`] || "");
    for (const other of rowIndices) {
      if (other === num || !dieselSlotActive(sheetData, other)) continue;
      if (meter > 0 && Number(sheetData[`dieselMeter${other}`]) === meter) {
        reasons.push(t("ops.trip.duplicate_diesel_meter", { row: snoForRow(other), meter }));
      }
      if (image && image === String(sheetData[`dieselImage${other}`] || "")) {
        reasons.push(t("ops.trip.duplicate_diesel_bill", { row: snoForRow(other) }));
      }
      if (clientKey && clientKey === String(sheetData[`dieselClientKey${other}`] || "")) {
        reasons.push(t("ops.trip.duplicate_diesel_entry", { row: snoForRow(other) }));
      }
    }
    // Add litres range validation
    const litresError = litresRangeError(num);
    if (litresError && !reasons.includes(litresError)) reasons.push(litresError);
    const unique = Array.from(new Set(reasons));
    return unique.length ? unique.map((reason) => `• ${reason}`).join("\n") : null;
  };

  /** Flatten trip.dieselEntries[] → dieselLtrN / dieselRateN / … sheet keys (unlimited rows).
   *  Preserves local bill images when the API omits large imageData (common on multi-bill trips).
   */
  const flattenDieselEntries = (saved: Trip | Record<string, unknown>): Record<string, unknown> => {
    const updates: Record<string, unknown> = {};
    const prev = sheetData as Record<string, unknown>;
    // Keep any already-flattened diesel* keys the API may return.
    for (const [k, v] of Object.entries(saved || {})) {
      if (k.startsWith("diesel") && k !== "dieselEntries") updates[k] = v;
    }
    const entries = Array.isArray((saved as Trip)?.dieselEntries)
      ? ((saved as Trip).dieselEntries as NonNullable<Trip["dieselEntries"]>)
      : [];
    // Clear every known sheet slot (current UI + API flatten keys) so deletes don't leave stale values.
    const clearSlots = new Set<number>([
      ...collectDieselSlotIndices(prev),
      ...collectDieselSlotIndices(updates),
      ...rowIndices,
    ]);
    const preservedImages = new Map<number, { data: unknown; name: unknown }>();
    for (const i of clearSlots) {
      if (hasRealBill(prev[`dieselImage${i}`])) {
        preservedImages.set(i, {
          data: prev[`dieselImage${i}`],
          name: prev[`dieselImageName${i}`] ?? "",
        });
      }
      updates[`dieselId${i}`] = "";
      updates[`dieselLtr${i}`] = "";
      updates[`dieselRate${i}`] = "";
      updates[`dieselAmount${i}`] = "";
      updates[`dieselMeter${i}`] = "";
      updates[`dieselBunk${i}`] = "";
      updates[`dieselGpsLat${i}`] = "";
      updates[`dieselGpsLon${i}`] = "";
      updates[`dieselGpsAccuracy${i}`] = "";
      updates[`dieselGpsCapturedAt${i}`] = "";
      updates[`dieselImage${i}`] = "";
      updates[`dieselImageName${i}`] = "";
      updates[`dieselSubmitted${i}`] = false;
      updates[`dieselSubmittedAt${i}`] = "";
      updates[`dieselClientKey${i}`] = "";
    }
    entries.forEach((entry, idx) => {
      const raw = Number(entry.rowIndex);
      const n = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : idx + 1;
      const litres = entry.litres ?? "";
      const rate = entry.rate ?? "";
      const amount =
        entry.amount != null
          ? entry.amount
          : litres !== "" && rate !== ""
            ? Math.round(Number(litres) * Number(rate) * 100) / 100
            : "";
      updates[`dieselId${n}`] = entry.id ?? "";
      updates[`dieselLtr${n}`] = litres;
      updates[`dieselRate${n}`] = rate;
      updates[`dieselAmount${n}`] = amount;
      updates[`dieselMeter${n}`] = entry.meter ?? "";
      updates[`dieselBunk${n}`] = entry.bunkName ?? "";
      updates[`dieselBunkSource${n}`] = entry.bunkSource ?? "OTHER";
      updates[`dieselFuelBunkId${n}`] = entry.fuelBunkId ?? "";
      updates[`dieselGpsLat${n}`] = entry.gpsLat ?? "";
      updates[`dieselGpsLon${n}`] = entry.gpsLon ?? "";
      updates[`dieselGpsAccuracy${n}`] = entry.gpsAccuracy ?? "";
      updates[`dieselGpsCapturedAt${n}`] = entry.gpsCapturedAt ?? "";
      const serverImage = entry.imageData ?? "";
      const kept = preservedImages.get(n);
      updates[`dieselImage${n}`] = hasRealBill(serverImage)
        ? serverImage
        : kept?.data ?? "";
      updates[`dieselImageName${n}`] = entry.imageName || kept?.name || "";
      updates[`dieselSubmitted${n}`] = entry.submitted !== false;
      updates[`dieselClientKey${n}`] = entry.clientKey ?? `diesel-${n}`;
    });
    return updates;
  };

  const lastRowIndex = rowIndices[rowIndices.length - 1];
  const isLastRowSubmitted = !!sheetData[`dieselSubmitted${lastRowIndex}`];
  // Unlimited diesel bills — Add stays available after each submitted entry.
  const canAddDieselRow = !readOnly && isLastRowSubmitted;
  const visibleRows = readOnly
    ? rowIndices.filter((num) => sheetData[`dieselSubmitted${num}`])
    : rowIndices;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-col gap-2 px-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-[13px] font-medium text-slate-500 shrink-0">
                {!isLastRowSubmitted ? t("ops.trip.submit_current_entry") : t("ops.trip.ready_next_entry")}
              </span>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold border shrink-0 ${`
                  absoluteDestMeter > 0 ? "bg-blue-50/70 border-blue-100 text-blue-500"
                  : "bg-red-50/70 border-red-100 text-red-500"
                `}`}
              >
                <Gauge size={12} />
                <span>
                  {t("ops.trip.last_entered_meter")} :-
                  {absoluteDestMeter > 0 ? `${absoluteDestMeter} KM` : t("ops.trip.dest_meter_missing")}
                </span>
              </div>
              {/* Meter chain error — once only, beside Last Entered Meter */}
              {chainBannerMessages[0] ? (
                <div
                  className="inline-flex items-start gap-1.5 max-w-full sm:max-w-xl rounded-md border border-red-100 bg-red-50/70 px-2.5 py-1.5 text-[12px] font-semibold text-red-500 leading-snug shadow-sm"
                  role="alert"
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5 text-red-500" />
                  <span className="min-w-0 break-words">{chainBannerMessages[0]}</span>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleAddRow}
              disabled={!canAddDieselRow}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-lg shadow-sm transition-all shrink-0 ${`
                canAddDieselRow
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              `}`}
            >
              <Plus size={14} />
              <span>{t("ops.trip.add_diesel_entry")}</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative rounded-xl border border-slate-200 overflow-x-auto shadow-sm bg-white">
        <table className="w-full min-w-[920px] border-collapse text-[13px] table-fixed">
          <colgroup>
            {/* Compact S.No / Ltr / Rate; free space to GPS + bill */}
            <col style={{ width: "28px" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-50/95 text-[12px] font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200">
              <th className="py-2.5 px-1.5 text-center">{t("table.s_no")}</th>
              <th className="py-2.5 px-1.5 text-center">{t("ops.trip.diesel_ltr")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-center">{t("ops.trip.diesel_rate")}</th>
              <th className="py-2.5 px-1.5 text-center">{t("ops.trip.diesel_amount")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-center">{t("ops.trip.diesel_reading")} {!isRentedVehicle && <span className="text-red-500">*</span>}</th>
              <th className="py-2.5 px-1.5 text-left">{t("ops.trip.bunk_address")}</th>
              <th className="py-2.5 px-2 text-left">GPS <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-center">{t("ops.trip.bill_image_slip")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-center">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-[13px] text-slate-400 py-6">{t("ops.trip.no_submitted_diesel")}</td>
              </tr>
            )}
            {visibleRows.map((num, idx) => {
              const isEditingThisRow = editingRow === num;
              const ltrVal = getFieldValue(`dieselLtr${num}`, num) ?? "";
              const amountVal = getFieldValue(`dieselAmount${num}`, num) ?? "";
              const meterVal = getFieldValue(`dieselMeter${num}`, num) ?? "";
              const bunkVal = getFieldValue(`dieselBunk${num}`, num) ?? "";
              const otherBunkVal = getFieldValue(`dieselOtherBunk${num}`, num) ?? "";
              const isOtherBunk = bunkVal === OTHER_BUNK_VALUE;
              const imageVal = getFieldValue(`dieselImage${num}`, num) ?? "";
              const imageNameVal = getFieldValue(`dieselImageName${num}`, num) || `BILL-${fallbackDateStr}-${String(num).padStart(3, "0")}.png`;
              const ltrNum = Number(ltrVal);
              const amountNum = Number(amountVal);
              const rateNum = ltrNum > 0 && Number.isFinite(amountNum)
                ? Number((amountNum / ltrNum).toFixed(2))
                : 0;
              const rateDisplay =
                ltrVal === "" || amountVal === "" || ltrNum <= 0
                  ? "—"
                  : rateNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const isSubmitted = !!sheetData[`dieselSubmitted${num}`];
              const locked = (isSubmitted && !isEditingThisRow) || readOnly;
              const { minAllowed: rowMinAllowed } = getMinAllowedMeter(
                num,
                isEditingThisRow ? draftData : undefined
              );
              // Live check so bill-2 ≤ bill-1 is always visible even before state catches up.
              const liveMeterErr =
                meterErrors[num] ||
                meterViolation(num, meterVal, isEditingThisRow ? draftData : undefined);
              const hasError = !!liveMeterErr;
              const gpsLat = getFieldValue(`dieselGpsLat${num}`, num);
              const gpsLon = getFieldValue(`dieselGpsLon${num}`, num);
              const gpsOk = isValidGps(gpsLat, gpsLon);
              const isFetching = !!isFetchingGPS[num];
              const canSubmitRow = !locked && rowReady(num, editingRow === num);
              // Compact numeric inputs (S.No / Ltr / Rate columns are tighter).
              const inputBase =
                "w-full min-w-0 box-border tabular-nums text-center px-1 py-1.5 rounded-md border text-[12px] font-semibold outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-default [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
              const inputOk = "bg-white border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15";
              const inputErr = "bg-red-50/70 border-red-400 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/15";

              return (
                <tr
                  key={num}
                  className={`transition-colors ${
                    isSubmitted && !isEditingThisRow
                      ? "bg-emerald-50/25"
                      : isEditingThisRow
                      ? "bg-amber-50/40"
                      : "hover:bg-slate-50/70"
                  }`}
                >
                  <td className="py-2.5 px-1.5 text-center font-semibold text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-1.5 text-center">
                    <input
                      type="number"
                      inputMode="decimal"
                      disabled={locked}
                      aria-label="Ltr"
                      className={`${inputBase} ${inputOk}`}
                      value={ltrVal}
                      onChange={(e) => handleFieldChange(`dieselLtr${num}`, num, e.target.value)}
                      onKeyDown={(e) => blockInvalidChar(e)}
                      onWheel={blockWheelChange}
                      onBlur={() => {
                        const rangeError = litresRangeError(num);
                        if (rangeError) notifyUser(rangeError, "error");
                      }}
                    />
                    {litresRangeError(num) && (
                      <span className="text-red-500 text-[11px] mt-1 block">{litresRangeError(num)}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-1.5 text-center font-semibold tabular-nums text-slate-600" aria-label="Rate (₹)">
                    {rateDisplay}
                  </td>
                  <td className="py-2.5 px-1.5 text-center">
                    <input
                      type="number"
                      inputMode="decimal"
                      disabled={locked}
                      aria-label="Amount (₹)"
                      className={`${inputBase} ${inputOk}`}
                      value={amountVal}
                      onChange={(e) => handleFieldChange(`dieselAmount${num}`, num, e.target.value)}
                      onKeyDown={(e) => blockInvalidChar(e)}
                      onWheel={blockWheelChange}
                    />
                  </td>
                  <td className="py-2.5 px-1.5 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={rowMinAllowed > 0 ? rowMinAllowed : 0}
                      disabled={locked}
                      className={`${inputBase} ${hasError ? inputErr : inputOk}`}
                      value={meterVal}
                      onChange={(e) => handleMeterChange(num, e.target.value)}
                      onKeyDown={(e) => blockInvalidChar(e)}
                      onWheel={blockWheelChange}
                      aria-label="Reading (KM)"
                      aria-invalid={hasError}
                    />
                  </td>
                  <td className="py-2.5 px-2 text-left font-medium text-slate-700">
                    <select
                      disabled={locked}
                      value={isOtherBunk ? OTHER_BUNK_VALUE : bunkVal}
                      onChange={(e) => handleBunkChange(num, e.target.value)}
                      className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-1 py-1.5 text-[12px] font-semibold outline-none transition-colors focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-600"
                    >
                      <option value="">{t("ops.trip.bunk_placeholder")}</option>
                      {fuelBunks.map((bunk) => (
                        <option key={bunk.id ?? bunk.birdType} value={bunk.birdType}>
                          {bunk.birdType}
                        </option>
                      ))}
                      <option value={OTHER_BUNK_VALUE}>{t("common.other")}</option>
                    </select>
                    {isOtherBunk && (
                      <input
                        disabled={locked}
                        placeholder={t("ops.trip.other_bunk_placeholder")}
                        value={otherBunkVal}
                        onChange={(e) => handleBunkOtherChange(num, e.target.value)}
                        className="mt-1 w-full min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-[12px] outline-none transition-colors focus:border-emerald-400 disabled:bg-slate-100 placeholder:text-slate-400"
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-left">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button"
                        disabled={locked || isFetching}
                        onClick={() => handleGetOtherLocation(num)}
                        title="GPS"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-bold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isFetching ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                        GPS
                      </button>
                      {gpsOk ? (
                        <GpsAddressText
                          lat={gpsLat}
                          lon={gpsLon}
                          className="block text-[12px] font-semibold text-emerald-600"
                          maxLines={2}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {hasRealBill(imageVal) ? (
                        <BillPreviewLink href={String(imageVal)} fileName={String(imageNameVal)} />
                      ) : (
                        <span className="text-[13px] text-slate-400">—</span>
                      )}
                      {!locked && (
                        <>
                          <button
                            type="button"
                            onClick={() => openBillPicker(num)}
                            title={t("ops.trip.upload_bill")}
                            aria-label={t("ops.trip.upload_bill")}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700"
                          >
                            <Upload size={12} />
                          </button>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[num] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(num, e)}
                          />
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center">
                    {!readOnly && !isSubmitted && (
                      <button
                        type="button"
                        onClick={() => handleRowSubmit(num)}
                        disabled={!canSubmitRow || busyRow === num}
                        className={`mb-1 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold shadow-sm transition-all ${canSubmitRow && busyRow !== num ? "bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"}`}
                      >
                        {t("ops.trip.submit_diesel_entry")}
                      </button>
                    )}
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 size={13} /> {t("ops.trip.submitted")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-500">
                        <Circle size={13} /> {t("status.draft")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
