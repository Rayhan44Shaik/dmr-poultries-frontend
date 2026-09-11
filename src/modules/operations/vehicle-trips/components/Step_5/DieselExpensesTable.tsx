// src/modules/operations/vehicle-trips/components/Step_5/DieselExpensesTable.tsx

import React, { useRef, useState, useEffect, useCallback } from "react";
import { MapPin, AlertTriangle, Plus, Pencil, Trash2, Loader2, Gauge, CheckCircle2, Circle } from "lucide-react";
import {
  submitTripDiesel,
  updateTripDiesel,
  deleteTripDiesel,
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
import { usePendingDelete } from "../../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../../components/common/PendingDeleteNotification";
import { useI18n } from "../../../../../i18n";
import { compressImageFile } from "../../../../../utils/compressImage";

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
}

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
  // data: URLs (JPEG/PNG/SVG) or long base64 — sample SVG bills are ~2–4KB
  if (s.startsWith("data:image") || s.startsWith("blob:") || s.startsWith("http")) return true;
  return s.length >= 40;
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
}: DieselExpensesTableProps) {
  const { t } = useI18n();
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [toastMessage, setToastMessage] = useState<{ message: string; type: "warning" | "error" | "success" } | null>(null);
  const [meterErrors, setMeterErrors] = useState<{ [key: number]: string }>({});
  const [isFetchingGPS, setIsFetchingGPS] = useState<{ [key: number]: boolean }>({});
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [, setIsEditingSubmitted] = useState(false);
  const [draftData, setDraftData] = useState<Record<string, any>>({});
  const [rowIndices, setRowIndices] = useState<number[]>([1]);
  const [draftClientKey, setDraftClientKey] = useState<string>(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `diesel-${Date.now()}`
  );

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const fallbackDateStr = `${yyyy}${mm}${dd}`;

  /** Keep visible rows in sync when parent hydrates dieselEntries → sheet slots
   *  (sample bills / resume). Without this, bills stay empty after first mount. */
  useEffect(() => {
    const activeIndices: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const submitted = sheetData[`dieselSubmitted${i}`];
      const ltr = sheetData[`dieselLtr${i}`];
      const rate = sheetData[`dieselRate${i}`];
      const meter = sheetData[`dieselMeter${i}`];
      const bunk = sheetData[`dieselBunk${i}`];
      const img = sheetData[`dieselImage${i}`];
      if (submitted || ltr || rate || meter || bunk || img) activeIndices.push(i);
    }
    if (activeIndices.length === 0) activeIndices.push(1);
    setRowIndices((prev) => {
      const same =
        prev.length === activeIndices.length && prev.every((v, i) => v === activeIndices[i]);
      return same ? prev : activeIndices;
    });
  }, [
    // Re-run when any diesel slot appears/changes (hydration from trip.dieselEntries)
    sheetData.dieselLtr1,
    sheetData.dieselLtr2,
    sheetData.dieselLtr3,
    sheetData.dieselLtr4,
    sheetData.dieselLtr5,
    sheetData.dieselLtr6,
    sheetData.dieselImage1,
    sheetData.dieselImage2,
    sheetData.dieselImage3,
    sheetData.dieselImage4,
    sheetData.dieselImage5,
    sheetData.dieselImage6,
    sheetData.dieselSubmitted1,
    sheetData.dieselSubmitted2,
    sheetData.dieselSubmitted3,
    sheetData.dieselSubmitted4,
    sheetData.dieselSubmitted5,
    sheetData.dieselSubmitted6,
    tripId,
  ]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const notifyUser = (msg: string, type: "warning" | "error" | "success" = "warning") => {
    if (showNotification) showNotification(msg, type);
    else setToastMessage({ message: msg, type });
  };

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
  };
  /** Block mouse-wheel from changing focused number values. */
  const blockWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
    e.preventDefault();
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

  const startEdit = (num: number) => {
    const submitted = !!sheetData[`dieselSubmitted${num}`];
    const newDraft: Record<string, any> = {};
    const fields = [
      "dieselLtr",
      "dieselRate",
      "dieselMeter",
      "dieselBunk",
      "dieselGpsLat",
      "dieselGpsLon",
      "dieselGpsAccuracy",
      "dieselGpsCapturedAt",
      "dieselImage",
      "dieselImageName",
      "dieselClientKey",
      "dieselId",
    ];
    fields.forEach((f) => {
      newDraft[`${f}${num}`] = sheetData[`${f}${num}`] ?? "";
    });
    setDraftData(newDraft);
    setIsEditingSubmitted(submitted);
    setEditingRow(num);
  };

  const cancelEdit = () => {
    setDraftData({});
    setIsEditingSubmitted(false);
    setEditingRow(null);
  };

  const handleAddRow = () => {
    const lastRow = rowIndices[rowIndices.length - 1];
    if (!sheetData[`dieselSubmitted${lastRow}`]) {
      notifyUser(t("ops.trip.submit_diesel_first"), "warning");
      return;
    }
    if (lastRow >= 6) {
      notifyUser(t("ops.trip.max_6_diesel"), "warning");
      return;
    }
    const nextId = lastRow + 1;
    const nextKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `diesel-${Date.now()}`;
    applyBatchUpdates({
      [`dieselLtr${nextId}`]: "",
      [`dieselRate${nextId}`]: "",
      [`dieselMeter${nextId}`]: "",
      [`dieselBunk${nextId}`]: "",
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
    setRowIndices((prev) => [...prev, nextId]);
    notifyUser(t("ops.trip.new_row_added"), "success");
  };

  const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      notifyUser(t("ops.trip.bill_jpeg_png"), "error");
      e.target.value = "";
      return;
    }
    // Up to 5 MB accepted — everything is auto-compressed to ≤ ~100 KB on
    // store (quality-first JPEG stepping keeps bills crisp), so disk usage
    // stays flat no matter what the camera produces.
    if (file.size > 5 * 1024 * 1024) {
      notifyUser(t("ops.trip.image_size_5mb"), "error");
      e.target.value = "";
      return;
    }
    const sequence = String(index).padStart(3, "0");
    try {
      // Compress hard on size but keep receipts readable: high-res long edge,
      // quality-first JPEG steps (see compressImage.ts). Clarity is preserved.
      const compressed = await compressImageFile(file, {
        maxBytes: 120 * 1024,
        maxDimension: 1800,
        minDimension: 720,
      });
      const result = compressed.dataUrl;
      if (!/^data:image\/(jpeg|jpg|png);base64,/i.test(result)) {
        notifyUser(t("ops.trip.bill_jpeg_png"), "error");
        e.target.value = "";
        return;
      }
      // Recompressed output is always JPEG.
      const newFileName = `BILL-${fallbackDateStr}-${sequence}.jpg`;
      if (editingRow === index) {
        setDraftField(`dieselImageName${index}`, newFileName);
        setDraftField(`dieselImage${index}`, result);
      } else {
        applyBatchUpdates({
          [`dieselImageName${index}`]: newFileName,
          [`dieselImage${index}`]: result,
        });
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

  const handleClearRow = (num: number) => {
    if (sheetData[`dieselSubmitted${num}`]) return;
    applyBatchUpdates({
      [`dieselLtr${num}`]: "",
      [`dieselRate${num}`]: "",
      [`dieselMeter${num}`]: "",
      [`dieselBunk${num}`]: "",
      [`dieselGpsLat${num}`]: "",
      [`dieselGpsLon${num}`]: "",
      [`dieselGpsAccuracy${num}`]: "",
      [`dieselGpsCapturedAt${num}`]: "",
      [`dieselImage${num}`]: "",
      [`dieselImageName${num}`]: "",
      [`dieselClientKey${num}`]: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `diesel-${Date.now()}`,
    });
    if (fileInputRefs.current[num]) fileInputRefs.current[num]!.value = "";
    setMeterErrors((prev) => {
      const copy = { ...prev };
      delete copy[num];
      return copy;
    });
    if (rowIndices.length > 1) setRowIndices((prev) => prev.filter((id) => id !== num));
    notifyUser(t("ops.trip.row_cancelled", { row: num }), "success");
  };

  const handleGetLocation = (index: number) => {
    if (!navigator.geolocation) {
      notifyUser(t("ops.trip.geo_unsupported"), "error");
      return;
    }
    setIsFetchingGPS((prev) => ({ ...prev, [index]: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (latitude === 0 && longitude === 0) {
          notifyUser(t("ops.trip.gps_zero_invalid"), "error");
          setIsFetchingGPS((prev) => ({ ...prev, [index]: false }));
          return;
        }
        const capturedAt = new Date(position.timestamp || Date.now()).toISOString();
        applyBatchUpdates({
          [`dieselGpsLat${index}`]: latitude,
          [`dieselGpsLon${index}`]: longitude,
          [`dieselGpsAccuracy${index}`]: accuracy,
          [`dieselGpsCapturedAt${index}`]: capturedAt,
        });
        notifyUser(t("ops.trip.gps_captured_row", { row: index }), "success");
        setIsFetchingGPS((prev) => ({ ...prev, [index]: false }));
      },
      (error) => {
        console.error("Geolocation error:", error);
        notifyUser(t("ops.trip.unable_retrieve_location"), "error");
        setIsFetchingGPS((prev) => ({ ...prev, [index]: false }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const absoluteDestMeter = destMeter || 0;

  /**
   * Each diesel meter must be STRICTLY greater than the previous reading:
   *   row 1  > farm dest meter
   *   row N  > row N-1 meter (submitted or currently being edited)
   * So bill-2 reading 36981 is rejected when bill-1 is 36985.
   */
  const getMinAllowedMeter = (num: number, overrideData?: Record<string, unknown>) => {
    const baseLabel = t("ops.trip.farm_meter_label", { meter: absoluteDestMeter });
    if (num <= 1) return { minAllowed: absoluteDestMeter, referenceLabel: baseLabel };

    for (let i = num - 1; i >= 1; i--) {
      let prevVal: unknown;
      if (overrideData && overrideData[`dieselMeter${i}`] !== undefined) {
        prevVal = overrideData[`dieselMeter${i}`];
      } else if (editingRow === i && draftData[`dieselMeter${i}`] !== undefined) {
        prevVal = draftData[`dieselMeter${i}`];
      } else {
        prevVal = sheetData[`dieselMeter${i}`];
      }
      // Prefer any filled previous-row meter (submitted or draft) so chain stays ordered.
      if (prevVal !== undefined && prevVal !== "" && Number.isFinite(Number(prevVal)) && Number(prevVal) > 0) {
        return {
          minAllowed: Number(prevVal),
          referenceLabel: t("ops.trip.row_label", { row: i, meter: Number(prevVal) }),
        };
      }
    }
    return { minAllowed: absoluteDestMeter, referenceLabel: baseLabel };
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

  /** Visible S.No for a table row index (01, 02…). */
  const snoForRow = useCallback(
    (row: number) => {
      const idx = rowIndices.indexOf(row);
      const display = idx >= 0 ? idx : row - 1;
      return String(display + 1).padStart(2, "0");
    },
    [rowIndices]
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
        prevSno: issue.prevSno === "Farm" ? t("ops.trip.dest_farm_meter") : issue.prevSno,
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
      const issues = findMeterChainIssues(slots, absoluteDestMeter);
      const errs: { [key: number]: string } = {};
      for (const issue of issues) {
        errs[issue.row] = formatMeterChainMsg(issue);
      }
      return errs;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [absoluteDestMeter, rowIndices.join(","), resolveMeterValue, formatMeterChainMsg]
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
    const fromScan = findMeterChainIssues(slots, absoluteDestMeter).map(formatMeterChainMsg);
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
      const issue = findMeterChainIssues(slots, absoluteDestMeter).find((i) => i.row === num);
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
    const rate = data[`dieselRate${num}`];
    const reading = data[`dieselMeter${num}`];
    // Bunk city is optional (short city name). GPS + bill are mandatory.
    const image = data[`dieselImage${num}`];
    const lat = data[`dieselGpsLat${num}`];
    const lon = data[`dieselGpsLon${num}`];
    const meterErr = meterErrors[num] || meterViolation(num, reading, useDraft ? data : undefined);
    const laterBlock = laterBillsBlocking(num, useDraft).length > 0;
    return (
      isPositive(ltr) &&
      isPositive(rate) &&
      isPositive(Number(ltr) * Number(rate)) &&
      isPositive(reading) &&
      hasRealBill(image) &&
      isValidGps(lat, lon) &&
      !meterErr &&
      !laterBlock
    );
  };

  const rowBlockReason = (num: number, useDraft = false): string | null => {
    const data = useDraft && editingRow === num ? draftData : sheetData;
    if (meterErrors[num]) return meterErrors[num];
    if (!isPositive(data[`dieselLtr${num}`])) return t("ops.trip.diesel_ltr_required");
    if (!isPositive(data[`dieselRate${num}`])) return t("ops.trip.rate_required");
    if (!isPositive(Number(data[`dieselLtr${num}`]) * Number(data[`dieselRate${num}`]))) {
      return t("ops.trip.amount_greater_zero");
    }
    if (!isPositive(data[`dieselMeter${num}`])) return t("ops.trip.reading_required");
    const meterErr = meterViolation(num, data[`dieselMeter${num}`], useDraft ? data : undefined);
    if (meterErr) return meterErr;
    const later = laterBillsBlocking(num, useDraft);
    if (later.length > 0) {
      const issue = later[0];
      return t("ops.trip.meter_later_below", {
        sno: snoForRow(num),
        meter: Number(data[`dieselMeter${num}`]),
        laterSno: issue.sno,
        laterMeter: issue.meter,
      });
    }
    // GPS is mandatory; bunk city is optional free-text (Kodad / Vijayawada…).
    if (!isValidGps(data[`dieselGpsLat${num}`], data[`dieselGpsLon${num}`])) {
      return t("ops.trip.gps_must_captured");
    }
    if (!hasRealBill(data[`dieselImage${num}`])) return t("ops.trip.bill_image_required");
    return null;
  };

  /** Flatten trip.dieselEntries[] → dieselLtrN / dieselRateN / … sheet keys. */
  const flattenDieselEntries = (saved: Trip | Record<string, unknown>): Record<string, unknown> => {
    const updates: Record<string, unknown> = {};
    // Keep any already-flattened diesel* keys the API may return.
    for (const [k, v] of Object.entries(saved || {})) {
      if (k.startsWith("diesel") && k !== "dieselEntries") updates[k] = v;
    }
    const entries = Array.isArray((saved as Trip)?.dieselEntries)
      ? ((saved as Trip).dieselEntries as NonNullable<Trip["dieselEntries"]>)
      : [];
    // Clear slots first so deleted rows don't leave stale sheet values.
    for (let i = 1; i <= 6; i++) {
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
      const n = Math.min(6, Math.max(1, Number(entry.rowIndex) > 0 ? Number(entry.rowIndex) : idx + 1));
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
      updates[`dieselGpsLat${n}`] = entry.gpsLat ?? "";
      updates[`dieselGpsLon${n}`] = entry.gpsLon ?? "";
      updates[`dieselGpsAccuracy${n}`] = entry.gpsAccuracy ?? "";
      updates[`dieselGpsCapturedAt${n}`] = entry.gpsCapturedAt ?? "";
      updates[`dieselImage${n}`] = entry.imageData ?? "";
      updates[`dieselImageName${n}`] = entry.imageName ?? "";
      updates[`dieselSubmitted${n}`] = entry.submitted !== false;
      updates[`dieselSubmittedAt${n}`] = entry.submittedAt ?? "";
      updates[`dieselClientKey${n}`] = entry.clientKey ?? `diesel-${n}`;
    });
    return updates;
  };

  const handleRowSubmit = async (num: number) => {
    if (busyRow !== null) return;
    const useDraft = editingRow === num;
    const dataForCheck = useDraft ? draftData : sheetData;
    const thisMeter = Number(dataForCheck[`dieselMeter${num}`]);

    // Backward check: this reading must be > previous bill / farm meter.
    const liveMeterErr = meterViolation(num, dataForCheck[`dieselMeter${num}`], useDraft ? dataForCheck : undefined);
    if (liveMeterErr) {
      setMeterErrors((prev) => ({ ...prev, [num]: liveMeterErr }));
      // Top banner beside Destination Farm Meter is the single visible message.
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
      rate: Number(data[`dieselRate${num}`]),
      meter: Number(data[`dieselMeter${num}`]),
      bunkName: String(data[`dieselBunk${num}`] || "").trim(),
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
        flattened[`dieselAmount${num}`] = Math.round(payload.litres * payload.rate * 100) / 100;
        flattened[`dieselMeter${num}`] = payload.meter;
        flattened[`dieselBunk${num}`] = payload.bunkName;
        flattened[`dieselGpsLat${num}`] = payload.gpsLat;
        flattened[`dieselGpsLon${num}`] = payload.gpsLon;
        flattened[`dieselGpsAccuracy${num}`] = payload.gpsAccuracy ?? "";
        flattened[`dieselGpsCapturedAt${num}`] = payload.gpsCapturedAt ?? "";
        flattened[`dieselImage${num}`] = payload.imageData;
        flattened[`dieselImageName${num}`] = payload.imageName ?? "";
        flattened[`dieselSubmitted${num}`] = true;
        flattened[`dieselClientKey${num}`] = payload.clientKey;
      }
      applyBatchUpdates(flattened);

      // Keep visible row indices in sync with what the sheet now holds.
      const nextRows: number[] = [];
      for (let i = 1; i <= 6; i++) {
        if (flattened[`dieselSubmitted${i}`] || flattened[`dieselLtr${i}`] || flattened[`dieselId${i}`]) {
          nextRows.push(i);
        }
      }
      if (nextRows.length === 0) nextRows.push(1);
      setRowIndices(nextRows);

      cancelEdit();
      notifyUser(t("ops.trip.row_submitted", { row: num }), "success");
    } catch (err) {
      notifyUser(handleApiError(err), "error");
    } finally {
      setBusyRow(null);
    }
  };

  const handleDeleteSubmitted = async (num: number) => {
    const entryId = Number(sheetData[`dieselId${num}`]);
    if (!entryId) return;
    setBusyRow(num);
    try {
      const saved = await deleteTripDiesel(tripId, entryId);
      const flattened = flattenDieselEntries(saved as Trip);
      applyBatchUpdates(flattened);
      const nextRows: number[] = [];
      for (let i = 1; i <= 6; i++) {
        if (flattened[`dieselSubmitted${i}`] || flattened[`dieselLtr${i}`] || flattened[`dieselId${i}`]) {
          nextRows.push(i);
        }
      }
      if (nextRows.length === 0) nextRows.push(1);
      setRowIndices(nextRows);
      notifyUser(t("ops.trip.row_deleted", { row: num }), "success");
    } catch (err) {
      notifyUser(handleApiError(err), "error");
    } finally {
      setBusyRow(null);
    }
  };

  const { requestDelete, cancel, pendingItems } = usePendingDelete<number>((num) => handleDeleteSubmitted(num));

  const lastRowIndex = rowIndices[rowIndices.length - 1];
  const isLastRowSubmitted = !!sheetData[`dieselSubmitted${lastRowIndex}`];
  const visibleRows = readOnly
    ? rowIndices.filter((num) => sheetData[`dieselSubmitted${num}`])
    : rowIndices;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-col gap-2 px-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-slate-500 shrink-0">
                {!isLastRowSubmitted ? t("ops.trip.submit_current_entry") : t("ops.trip.ready_next_entry")}
              </span>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border shrink-0 ${
                  absoluteDestMeter > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <Gauge size={12} />
                <span>
                  {t("ops.trip.dest_farm_meter")} :-{" "}
                  {absoluteDestMeter > 0 ? `${absoluteDestMeter} KM` : t("ops.trip.dest_meter_missing")}
                </span>
              </div>
              {/* Meter chain error — once only, beside Destination Farm Meter */}
              {chainBannerMessages[0] ? (
                <div
                  className="inline-flex items-start gap-1.5 max-w-full sm:max-w-xl rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 leading-snug shadow-sm"
                  role="alert"
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5 text-red-600" />
                  <span className="min-w-0 break-words">{chainBannerMessages[0]}</span>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleAddRow}
              disabled={!isLastRowSubmitted || rowIndices.length >= 6}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0 ${
                isLastRowSubmitted && rowIndices.length < 6
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              }`}
            >
              <Plus size={14} />
              <span>{t("ops.trip.add_diesel_entry")}</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative rounded-xl border border-slate-200 overflow-x-auto shadow-sm bg-white">
        {toastMessage && (
          <div
            className={`absolute top-2 right-2 z-50 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-medium ${
              toastMessage.type === "error" ? "bg-red-600" : toastMessage.type === "success" ? "bg-emerald-600" : "bg-amber-600"
            }`}
          >
            <AlertTriangle size={15} className="shrink-0" />
            <span>{toastMessage.message}</span>
          </div>
        )}

        <table className="w-full min-w-[980px] border-collapse text-xs table-fixed">
          <colgroup>
            {/* Balanced layout — GPS no longer eats all leftover space */}
            <col style={{ width: "36px" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-50/95 text-[11px] font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200">
              <th className="py-2.5 px-1.5 text-center">{t("table.s_no")}</th>
              <th className="py-2.5 px-1.5 text-right">{t("ops.trip.diesel_ltr")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-right">{t("ops.trip.diesel_rate")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-right">{t("ops.trip.diesel_amount")}</th>
              <th className="py-2.5 px-1.5 text-right">{t("ops.trip.diesel_reading")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-left">{t("ops.trip.bunk_address")}</th>
              <th className="py-2.5 px-2 text-left">GPS <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-center">{t("ops.trip.bill_image_slip")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1.5 text-center">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-xs text-slate-400 py-6">{t("ops.trip.no_submitted_diesel")}</td>
              </tr>
            )}
            {visibleRows.map((num, idx) => {
              const isEditingThisRow = editingRow === num;
              const ltrVal = getFieldValue(`dieselLtr${num}`, num) ?? "";
              const rateVal = getFieldValue(`dieselRate${num}`, num) ?? "";
              const meterVal = getFieldValue(`dieselMeter${num}`, num) ?? "";
              const bunkVal = getFieldValue(`dieselBunk${num}`, num) ?? "";
              const imageVal = getFieldValue(`dieselImage${num}`, num) ?? "";
              const imageNameVal = getFieldValue(`dieselImageName${num}`, num) || `BILL-${fallbackDateStr}-${String(num).padStart(3, "0")}.png`;
              const ltrNum = Number(ltrVal);
              const rateNum = Number(rateVal);
              // Always Ltr × Rate — never rely on a parallel array index that can drift.
              const amountVal =
                Number.isFinite(ltrNum) && Number.isFinite(rateNum) && (ltrNum > 0 || rateNum > 0)
                  ? Math.round(ltrNum * rateNum * 100) / 100
                  : 0;
              const amountDisplay =
                ltrVal === "" && rateVal === ""
                  ? "—"
                  : amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const isSubmitted = !!sheetData[`dieselSubmitted${num}`];
              const locked = (isSubmitted && !isEditingThisRow) || readOnly;
              const isFetching = !!isFetchingGPS[num];
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
              // Numeric inputs: room for value + unit suffix so Rate is never clipped.
              const inputBase =
                "w-full min-w-0 box-border tabular-nums text-right pl-1.5 py-1.5 rounded-md border text-xs font-semibold outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-default [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
              const inputOk = "bg-white border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15";
              const inputErr = "bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/15";

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
                  <td className="py-2 px-1.5 text-center text-slate-500 font-semibold tabular-nums bg-slate-50/60">
                    {String(idx + 1).padStart(2, "0")}
                  </td>

                  {/* Ltr */}
                  <td className="py-2 px-1.5 align-middle">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        disabled={locked}
                        value={ltrVal}
                        onKeyDown={blockInvalidChar}
                        onWheel={blockWheelChange}
                        onChange={(e) =>
                          handleFieldChange(`dieselLtr${num}`, num, e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="0.00"
                        className={`${inputBase} ${inputOk} pr-6`}
                        aria-label={t("ops.trip.diesel_ltr")}
                      />
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        L
                      </span>
                    </div>
                  </td>

                  {/* Rate — wider + extra right pad so ₹ never clips digits */}
                  <td className="py-2 px-1.5 align-middle">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        disabled={locked}
                        value={rateVal}
                        onKeyDown={blockInvalidChar}
                        onWheel={blockWheelChange}
                        onChange={(e) =>
                          handleFieldChange(`dieselRate${num}`, num, e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="0.00"
                        className={`${inputBase} ${inputOk} pr-7`}
                        aria-label={t("ops.trip.diesel_rate")}
                      />
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ₹
                      </span>
                    </div>
                  </td>

                  {/* Amount = Ltr × Rate (read-only) */}
                  <td className="py-2 px-1.5 align-middle">
                    <div
                      className="w-full min-w-0 tabular-nums text-right pl-1.5 pr-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 truncate"
                      title={amountDisplay === "—" ? undefined : `${ltrNum || 0} L × ₹${rateNum || 0} = ₹${amountDisplay}`}
                    >
                      {amountDisplay === "—" ? "—" : `₹ ${amountDisplay}`}
                    </div>
                  </td>

                  {/* Meter reading */}
                  <td className="py-2 px-1.5 align-middle">
                    <div className="relative">
                      <input
                        type="number"
                        min={rowMinAllowed > 0 ? rowMinAllowed + 1 : 0}
                        inputMode="numeric"
                        disabled={locked}
                        value={meterVal}
                        onKeyDown={blockInvalidChar}
                        onWheel={blockWheelChange}
                        onChange={(e) => handleMeterChange(num, e.target.value)}
                        onBlur={() => {
                          const v = getFieldValue(`dieselMeter${num}`, num);
                          const err = meterViolation(num, v, editingRow === num ? draftData : undefined);
                          if (err) {
                            setMeterErrors((prev) => ({ ...prev, [num]: err }));
                            // Message shows once at top beside Destination Farm Meter — no toast duplicate.
                          }
                        }}
                        placeholder="0"
                        title={hasError ? liveMeterErr || undefined : rowMinAllowed > 0 ? `> ${rowMinAllowed}` : undefined}
                        className={`${inputBase} ${hasError ? inputErr : inputOk} pr-8`}
                        aria-label={t("ops.trip.diesel_reading")}
                        aria-invalid={hasError}
                      />
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        KM
                      </span>
                    </div>
                  </td>

                  {/* Bunk city — optional short city (Kodad, Vijayawada…) */}
                  <td className="py-2 px-1.5 align-middle">
                    <input
                      type="text"
                      placeholder={t("ops.trip.bunk_placeholder")}
                      disabled={locked || isFetching}
                      value={bunkVal}
                      title={bunkVal}
                      maxLength={40}
                      onChange={(e) => handleFieldChange(`dieselBunk${num}`, num, e.target.value)}
                      className="w-full min-w-0 px-1.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 disabled:bg-slate-100 disabled:text-slate-600 truncate"
                    />
                  </td>

                  {/* GPS — mandatory; preview + full address in portal tooltip */}
                  <td className="py-2 px-1.5 align-middle overflow-visible">
                    <div className="flex items-start gap-1.5 min-w-0 w-full">
                      <div className="min-w-0 flex-1 overflow-visible">
                        {gpsOk ? (
                          <GpsAddressText
                            lat={gpsLat}
                            lon={gpsLon}
                            className="block text-[11px] text-emerald-700 font-semibold underline decoration-emerald-300/80 hover:decoration-emerald-600 leading-snug cursor-help"
                            withTooltip
                            maxLines={2}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">{t("ops.trip.not_captured")}</span>
                        )}
                      </div>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => handleGetLocation(num)}
                          disabled={isFetching}
                          className={`shrink-0 px-1.5 py-1 rounded-md text-[10px] font-semibold inline-flex items-center gap-0.5 border ${
                            gpsOk
                              ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          }`}
                          title={t("ops.trip.gps_must_captured")}
                        >
                          {isFetching ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} className={gpsOk ? "text-emerald-600" : "text-red-500"} />}
                          GPS
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Bill — compact text; portal tooltip so first rows never clip */}
                  <td className="py-2 px-1 text-center align-middle overflow-visible">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => {
                        fileInputRefs.current[num] = el;
                      }}
                      onChange={(e) => handleImageUpload(num, e)}
                    />
                    {hasRealBill(imageVal) ? (
                      <div className="inline-flex flex-col items-center justify-center gap-0.5">
                        <BillPreviewLink href={String(imageVal)} fileName={String(imageNameVal)} />
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingThisRow) {
                                setDraftField(`dieselImage${num}`, "");
                                setDraftField(`dieselImageName${num}`, "");
                              } else {
                                applyBatchUpdates({ [`dieselImage${num}`]: "", [`dieselImageName${num}`]: "" });
                              }
                            }}
                            className="text-[9px] font-medium text-slate-400 hover:text-red-600 leading-none"
                            title={t("common.delete")}
                          >
                            {t("common.remove")}
                          </button>
                        )}
                      </div>
                    ) : !locked ? (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[num]?.click()}
                        className="text-[11px] font-semibold text-slate-600 hover:text-emerald-700 underline decoration-slate-300 hover:decoration-emerald-500 underline-offset-2 whitespace-nowrap px-0.5 py-0.5"
                      >
                        {t("ops.trip.upload_bill")}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>

                  {/* Status — icon only so it never overflows the column */}
                  <td className="py-2 px-2 text-center align-middle">
                    {readOnly || (isSubmitted && !isEditingThisRow) ? (
                      <div className="inline-flex items-center justify-center gap-1">
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200"
                          title={t("ops.trip.submitted")}
                          aria-label={t("ops.trip.submitted")}
                        >
                          <CheckCircle2 size={15} strokeWidth={2.25} />
                        </span>
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(num)}
                              className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-full bg-white hover:bg-slate-50 text-slate-600"
                              title={t("ops.trip.edit_row")}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(num, { label: t("ops.trip.deleting_diesel_row", { row: num }) })}
                              disabled={busyRow === num}
                              className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-full bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                              title={t("ops.trip.delete_row")}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200"
                        title={t("status.draft")}
                        aria-label={t("status.draft")}
                      >
                        <Circle size={14} strokeWidth={2} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(() => {
        const actionRow = visibleRows.find((num) => {
          const submitted = !!sheetData[`dieselSubmitted${num}`];
          return !readOnly && (!submitted || editingRow === num);
        });
        if (!actionRow) return null;
        const isEditingActionRow = editingRow === actionRow;
        const reason = rowBlockReason(actionRow, isEditingActionRow);
        const canSubmit = rowReady(actionRow, isEditingActionRow);
        // Meter chain messages already show once at top beside Destination Farm Meter.
        const isMeterReason =
          !!reason &&
          (reason === meterErrors[actionRow] ||
            /meter|S\.No|reading/i.test(reason) ||
            chainBannerMessages.includes(reason));
        const showBottomReason = reason && !isMeterReason;
        return (
          <div className="space-y-2">
            {showBottomReason ? (
              <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {reason}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isEditingActionRow) cancelEdit();
                  else handleClearRow(actionRow);
                }}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center shrink-0"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleRowSubmit(actionRow)}
                disabled={!canSubmit || busyRow === actionRow}
                className={`h-9 px-4 rounded-lg text-xs font-bold text-white inline-flex items-center justify-center shrink-0 ${
                  canSubmit && busyRow !== actionRow
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                {busyRow === actionRow ? `${t("ops.trip.submitting")}…` : t("ops.trip.submit_diesel_entry")}
              </button>
            </div>
          </div>
        );
      })()}
      <PendingDeleteNotification items={pendingItems} onCancel={cancel} />
    </div>
  );
}
