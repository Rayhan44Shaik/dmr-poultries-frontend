// src/modules/operations/vehicle-trips/components/Step_5/DieselExpensesTable.tsx

import React, { useRef, useState, useEffect } from "react";
import { Upload, X, MapPin, AlertTriangle, Plus, Pencil, Trash2, Loader2, Gauge } from "lucide-react";
import {
  submitTripDiesel,
  updateTripDiesel,
  deleteTripDiesel,
  handleApiError,
} from "../../services/tripHeaderApiService";
import type { Trip } from "../../types/trip";
import { meterMustBeGreaterThan } from "../../utils/meterValidation";
import { GpsAddressText } from "../GpsAddressText";
import { usePendingDelete } from "../../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../../components/common/PendingDeleteNotification";
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
  return typeof image === "string" && image.trim().length >= 80 && !/^(bill|key|true|yes)$/i.test(image.trim());
}

export default function DieselExpensesTable({
  tripId,
  sheetData,
  handleChange,
  applyBatchUpdates,
  dieselAmounts,
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
  const [isEditingSubmitted, setIsEditingSubmitted] = useState(false);
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

  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
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
    setRowIndices(activeIndices);
  }, []);

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

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      notifyUser(t("ops.trip.bill_jpeg_png"), "error");
      e.target.value = "";
      return;
    }
    if (file.size > 1_048_576) {
      notifyUser(t("ops.trip.bill_image_size"), "error");
      e.target.value = "";
      return;
    }
    const sequence = String(index).padStart(3, "0");
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "png";
    const newFileName = `BILL-${fallbackDateStr}-${sequence}.${extension}`;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      if (!/^data:image\/(jpeg|jpg|png);base64,/i.test(result)) {
        notifyUser(t("ops.trip.bill_jpeg_png"), "error");
        return;
      }
      if (editingRow === index) {
        setDraftField(`dieselImageName${index}`, newFileName);
        setDraftField(`dieselImage${index}`, result);
      } else {
        applyBatchUpdates({
          [`dieselImageName${index}`]: newFileName,
          [`dieselImage${index}`]: result,
        });
      }
      notifyUser(t("ops.trip.bill_uploaded_row", { row: index }), "success");
    };
    reader.readAsDataURL(file);
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

  const getMinAllowedMeter = (num: number) => {
    const baseLabel = t("ops.trip.farm_meter_label", { meter: absoluteDestMeter });
    if (num === 1) return { minAllowed: absoluteDestMeter, referenceLabel: baseLabel };
    for (let i = num - 1; i >= 1; i--) {
      const isEditingThisRow = editingRow === i;
      const submitted = !!sheetData[`dieselSubmitted${i}`];
      if (!submitted && !isEditingThisRow) continue;
      const prevVal = isEditingThisRow ? draftData[`dieselMeter${i}`] : sheetData[`dieselMeter${i}`];
      if (prevVal !== undefined && prevVal !== "" && !isNaN(Number(prevVal))) {
        return { minAllowed: Number(prevVal), referenceLabel: t("ops.trip.row_label", { row: i, meter: prevVal }) };
      }
    }
    return { minAllowed: absoluteDestMeter, referenceLabel: baseLabel };
  };

  const rowReady = (num: number, useDraft = false) => {
    const data = useDraft && editingRow === num ? draftData : sheetData;
    const ltr = data[`dieselLtr${num}`];
    const rate = data[`dieselRate${num}`];
    const reading = data[`dieselMeter${num}`];
    const bunk = String(data[`dieselBunk${num}`] || "").trim();
    const image = data[`dieselImage${num}`];
    const lat = data[`dieselGpsLat${num}`];
    const lon = data[`dieselGpsLon${num}`];
    return (
      isPositive(ltr) &&
      isPositive(rate) &&
      isPositive(Number(ltr) * Number(rate)) &&
      isPositive(reading) &&
      !!bunk &&
      !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(bunk) &&
      hasRealBill(image) &&
      isValidGps(lat, lon) &&
      !meterErrors[num]
    );
  };

  const rowBlockReason = (num: number, useDraft = false): string | null => {
    if (meterErrors[num]) return meterErrors[num];
    const data = useDraft && editingRow === num ? draftData : sheetData;
    if (!isPositive(data[`dieselLtr${num}`])) return t("ops.trip.diesel_ltr_required");
    if (!isPositive(data[`dieselRate${num}`])) return t("ops.trip.rate_required");
    if (!isPositive(Number(data[`dieselLtr${num}`]) * Number(data[`dieselRate${num}`]))) {
      return t("ops.trip.amount_greater_zero");
    }
    if (!isPositive(data[`dieselMeter${num}`])) return t("ops.trip.reading_required");
    const bunk = String(data[`dieselBunk${num}`] || "").trim();
    if (!bunk) return t("ops.trip.bunk_required");
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(bunk)) return t("ops.trip.bunk_required");
    if (!isValidGps(data[`dieselGpsLat${num}`], data[`dieselGpsLon${num}`])) {
      return t("ops.trip.gps_must_captured");
    }
    if (!hasRealBill(data[`dieselImage${num}`])) return t("ops.trip.bill_image_required");
    return null;
  };

  const handleRowSubmit = async (num: number) => {
    if (busyRow !== null) return;
    const useDraft = editingRow === num;
    if (!rowReady(num, useDraft)) {
      notifyUser(t("ops.trip.fill_mandatory_diesel", { row: num }), "error");
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
      bunkName: String(data[`dieselBunk${num}`]).trim(),
      gpsLat: Number(data[`dieselGpsLat${num}`]),
      gpsLon: Number(data[`dieselGpsLon${num}`]),
      gpsAccuracy: data[`dieselGpsAccuracy${num}`] === "" ? null : Number(data[`dieselGpsAccuracy${num}`]),
      gpsCapturedAt: data[`dieselGpsCapturedAt${num}`] || null,
      imageData: String(data[`dieselImage${num}`]),
      imageName: data[`dieselImageName${num}`] || null,
    };
    setBusyRow(num);
    try {
      const entryId = Number(data[`dieselId${num}`]);
      const saved =
        entryId > 0
          ? await updateTripDiesel(tripId, entryId, payload)
          : await submitTripDiesel(tripId, payload);
      applyBatchUpdates({
        ...Object.fromEntries(
          Object.keys(saved).filter((k) => k.startsWith("diesel")).map((k) => [k, (saved as any)[k]])
        ),
      });
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
      const updates: Record<string, any> = {};
      for (let i = 1; i <= 6; i++) {
        [
          "dieselId",
          "dieselLtr",
          "dieselRate",
          "dieselAmount",
          "dieselMeter",
          "dieselBunk",
          "dieselGpsLat",
          "dieselGpsLon",
          "dieselGpsAccuracy",
          "dieselGpsCapturedAt",
          "dieselImage",
          "dieselImageName",
          "dieselSubmitted",
          "dieselSubmittedAt",
          "dieselClientKey",
        ].forEach((p) => {
          updates[`${p}${i}`] = (saved as any)[`${p}${i}`] ?? "";
        });
      }
      applyBatchUpdates(updates);
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              {!isLastRowSubmitted ? t("ops.trip.submit_current_entry") : t("ops.trip.ready_next_entry")}
            </span>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                absoluteDestMeter > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <Gauge size={12} />
              <span>{t("ops.trip.dest_farm_meter")} :- {absoluteDestMeter > 0 ? `${absoluteDestMeter} KM` : t("ops.trip.dest_meter_missing")}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            disabled={!isLastRowSubmitted || rowIndices.length >= 6}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
              isLastRowSubmitted && rowIndices.length < 6
                ? "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
          >
            <Plus size={14} />
            <span>{t("ops.trip.add_diesel_entry")}</span>
          </button>
        </div>
      )}

      <div className="relative rounded-lg border border-slate-200 overflow-x-auto shadow-sm pb-2">
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

        <table className="sheet-joined-table bg-white min-w-[860px] w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "27%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 font-normal text-slate-700 text-[11px] tracking-wider border-b border-slate-200">
              <th className="py-2.5 px-2 text-center">{t("table.s_no")}</th>
              <th className="py-2.5 px-1 text-center">{t("ops.trip.diesel_ltr")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1 text-center">{t("common.rate")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-1 text-center">{t("table.amount")}</th>
              <th className="py-2.5 px-1 text-center">{t("ops.trip.reading")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-left">{t("ops.trip.bunk_address")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-center">GPS</th>
              <th className="py-2.5 px-1 text-center">{t("ops.trip.bill_image_slip")} <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-center">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-xs text-slate-400 py-4">{t("ops.trip.no_submitted_diesel")}</td>
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
              const ltrNum = Number(ltrVal || 0);
              const rateNum = Number(rateVal || 0);
              const amountVal = isEditingThisRow
                ? ltrNum * rateNum
                : Number(sheetData[`dieselAmount${num}`]) ||
                  (dieselAmounts[idx] !== undefined ? dieselAmounts[idx] : ltrNum * rateNum);
              const hasError = !!meterErrors[num];
              const isSubmitted = !!sheetData[`dieselSubmitted${num}`];
              const locked = (isSubmitted && !isEditingThisRow) || readOnly;
              const isFetching = !!isFetchingGPS[num];
              const { minAllowed: rowMinAllowed } = getMinAllowedMeter(num);
              const gpsLat = getFieldValue(`dieselGpsLat${num}`, num);
              const gpsLon = getFieldValue(`dieselGpsLon${num}`, num);
              const gpsOk = isValidGps(gpsLat, gpsLon);

              return (
                <tr key={num} className={`border-b border-slate-100 ${isSubmitted ? "bg-emerald-50/30" : "hover:bg-slate-50/50"}`}>
                  <td className="text-slate-700 text-xs py-2 px-3 text-center bg-slate-50/85">{idx + 1}</td>
                  <td className="p-1 text-center">
                    <input type="number" step="0.01" min="0" disabled={locked} value={ltrVal} onKeyDown={blockInvalidChar}
                      onChange={(e) => handleFieldChange(`dieselLtr${num}`, num, e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-16 text-center p-1 bg-slate-50/70 border border-slate-200 rounded text-xs mx-auto block outline-none disabled:bg-slate-100" />
                  </td>
                  <td className="p-1 text-center">
                    <input type="number" step="0.01" min="0" disabled={locked} value={rateVal} onKeyDown={blockInvalidChar}
                      onChange={(e) => handleFieldChange(`dieselRate${num}`, num, e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-16 text-center p-1 bg-slate-50/70 border border-slate-200 rounded text-xs mx-auto block outline-none disabled:bg-slate-100" />
                  </td>
                  <td className="p-1 text-center text-slate-800 text-xs bg-slate-50/40">
                    {amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-1 text-center relative">
                    <input type="number" min={rowMinAllowed > 0 ? rowMinAllowed + 1 : 0} disabled={locked} value={meterVal} onKeyDown={blockInvalidChar}
                      onChange={(e) => handleFieldChange(`dieselMeter${num}`, num, e.target.value === "" ? "" : Number(e.target.value))}
                      className={`w-24 text-center p-1 border ${hasError ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/70"} rounded text-xs mx-auto block outline-none disabled:bg-slate-100`} />
                    {hasError ? (
                      <div className="mt-1 mx-auto max-w-[9rem] rounded border border-red-300 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700">
                        {meterErrors[num]}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-1 text-left align-middle px-2 w-36 max-w-[9rem]">
                    <input type="text" placeholder={t("ops.trip.bunk_placeholder")} disabled={locked || isFetching} value={bunkVal} title={bunkVal}
                      onChange={(e) => handleFieldChange(`dieselBunk${num}`, num, e.target.value)}
                      className="w-full max-w-[9rem] pl-2 py-1 bg-slate-50/70 border border-slate-200 rounded outline-none text-xs disabled:text-slate-500" />
                  </td>
                  <td className="p-1 text-center align-middle">
                    {gpsOk ? (
                      <a
                        href={`https://www.google.com/maps?q=${Number(gpsLat)},${Number(gpsLon)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-700 font-semibold underline break-words"
                        title={`Open in maps (${Number(gpsLat).toFixed(6)}, ${Number(gpsLon).toFixed(6)})`}
                      >
                        <GpsAddressText
                          lat={gpsLat}
                          lon={gpsLon}
                          fallback={t("ops.trip.location_captured")}
                        />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">GPS: {t("ops.trip.not_captured")}</span>
                    )}
                    {!locked && (
                      <button type="button" onClick={() => handleGetLocation(num)} disabled={isFetching}
                        className="mt-1 px-2 py-0.5 bg-white text-slate-700 rounded text-[11px] font-medium inline-flex items-center gap-1 border border-slate-200">
                        {isFetching ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} className="text-red-500" />}
                        GPS
                      </button>
                    )}
                  </td>
                  <td className="p-1 text-center align-middle">
                    <input type="file" accept="image/*" className="hidden" ref={(el) => { fileInputRefs.current[num] = el; }} onChange={(e) => handleImageUpload(num, e)} />
                    {imageVal ? (
                      <div className="w-full px-2 flex justify-center">
                        <div className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 flex items-center justify-between gap-1 max-w-[7.5rem] w-full">
                          <a href={imageVal} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 font-medium truncate w-full text-left" title={imageNameVal}>
                            {imageNameVal}
                          </a>
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
                              className="text-slate-400 hover:text-red-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      !locked && (
                        <button type="button" onClick={() => fileInputRefs.current[num]?.click()}
                          className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-md text-xs font-semibold border border-slate-200 inline-flex items-center gap-1.5">
                          <Upload size={13} /> {t("ops.trip.upload_bill")}
                        </button>
                      )
                    )}
                  </td>
                  <td className="p-1 text-center align-middle">
                    {readOnly ? (
                      <span className="text-[11px] font-semibold text-emerald-700">{t("ops.trip.submitted")}</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        {isSubmitted && !isEditingThisRow ? (
                          <>
                            <span className="text-[10px] font-semibold text-emerald-700 mr-1">{t("ops.trip.submitted")}</span>
                            <button type="button" onClick={() => startEdit(num)} className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-full" title={t("ops.trip.edit_row")}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => requestDelete(num, { label: t("ops.trip.deleting_diesel_row", { row: num }) })} disabled={busyRow === num} className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-full" title={t("ops.trip.delete_row")}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500">{t("status.draft")}</span>
                        )}
                      </div>
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
        return (
          <div className="space-y-2">
            {reason ? (
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
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleRowSubmit(actionRow)}
                disabled={!canSubmit || busyRow === actionRow}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white ${
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
