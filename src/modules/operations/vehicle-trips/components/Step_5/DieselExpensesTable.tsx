// src/modules/operations/vehicle-trips/components/Step_5/DieselExpensesTable.tsx

import React, { useRef, useState, useEffect } from "react";
import { Upload, X, MapPin, AlertTriangle, CheckCircle2, Plus, CircleX, Pencil, Trash2, Loader2, Gauge } from "lucide-react";

interface DieselExpensesTableProps {
  sheetData: any;
  handleChange: (field: string, value: any) => void;
  dieselAmounts: number[];
  totalDieselAmount: number;
  showNotification?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  destMeter: number;
}

export default function DieselExpensesTable({
  sheetData,
  handleChange,
  dieselAmounts,
  totalDieselAmount: _totalDieselAmount,
  showNotification,
  destMeter,
}: DieselExpensesTableProps) {
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [toastMessage, setToastMessage] = useState<{ message: string; type: "warning" | "error" | "success" } | null>(null);
  const [meterErrors, setMeterErrors] = useState<{ [key: number]: string }>({});
  const [isFetchingGPS, setIsFetchingGPS] = useState<{ [key: number]: boolean }>({});
  const [rowIndices, setRowIndices] = useState<number[]>([1]);
  const initialLoadDone = useRef(false);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const fallbackDateStr = `${yyyy}${mm}${dd}`;

  // ─── Initial load: scan for existing data ──────────────────────
  useEffect(() => {
    if (initialLoadDone.current) return;
    const activeIndices: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const ltr = sheetData[`dieselLtr${i}`];
      const rate = sheetData[`dieselRate${i}`];
      const meter = sheetData[`dieselMeter${i}`];
      const bunk = sheetData[`dieselBunk${i}`];
      const img = sheetData[`dieselImage${i}`];
      if (ltr || rate || meter || bunk || img) {
        activeIndices.push(i);
      }
    }
    if (activeIndices.length === 0) {
      activeIndices.push(1);
    }
    setRowIndices(activeIndices);
    initialLoadDone.current = true;
  }, [sheetData]);

  // ─── Toast timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const notifyUser = (msg: string, type: "warning" | "error" | "success" = "warning") => {
    if (showNotification) {
      showNotification(msg, type);
    } else {
      setToastMessage({ message: msg, type });
    }
  };

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  // ─── Helper: update a single field in React state ───────────────
  const handleFieldChange = (field: string, _num: number, value: any) => {
    handleChange(field, value);
  };

  // ─── Helper: apply batch updates in React state ─────────────────
  const applyBatchUpdates = (updates: Record<string, any>) => {
    Object.keys(updates).forEach(key => {
      handleChange(key, updates[key]);
    });
  };

  const handleAddRow = () => {
    const lastRow = rowIndices[rowIndices.length - 1];
    const ltr = sheetData[`dieselLtr${lastRow}`];
    const rate = sheetData[`dieselRate${lastRow}`];
    const meter = sheetData[`dieselMeter${lastRow}`];
    const bunk = sheetData[`dieselBunk${lastRow}`];
    const img = sheetData[`dieselImage${lastRow}`];
    const isLastSubmitted = !!(ltr && rate && meter && bunk && img);

    if (!isLastSubmitted) {
      notifyUser("Please submit the current diesel entry before adding a new one.", "warning");
      return;
    }
    if (lastRow >= 6) {
      notifyUser("Maximum of 6 diesel entries allowed.", "warning");
      return;
    }
    const nextId = lastRow + 1;
    const updates: Record<string, any> = {
      [`dieselLtr${nextId}`]: "",
      [`dieselRate${nextId}`]: "",
      [`dieselMeter${nextId}`]: "",
      [`dieselBunk${nextId}`]: "",
      [`dieselImage${nextId}`]: "",
      [`dieselImageName${nextId}`]: "",
    };
    applyBatchUpdates(updates);
    // ✅ Add the new index to the list so it appears
    setRowIndices(prev => [...prev, nextId]);
    notifyUser(`New row added.`, "info" as any);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sequence = String(index).padStart(3, "0");
      const extension = file.name.includes(".") ? file.name.split(".").pop() : "png";
      const newFileName = `BILL-${fallbackDateStr}-${sequence}.${extension}`;
      const updates: Record<string, any> = {
        [`dieselImageName${index}`]: newFileName,
      };
      const reader = new FileReader();
      reader.onloadend = () => {
        updates[`dieselImage${index}`] = reader.result as string;
        applyBatchUpdates(updates);
        notifyUser(`Bill image uploaded for Row ${index}.`, "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearRow = (num: number) => {
    const updates: Record<string, any> = {};
    [
      `dieselLtr${num}`,
      `dieselRate${num}`,
      `dieselMeter${num}`,
      `dieselBunk${num}`,
      `dieselImage${num}`,
      `dieselImageName${num}`,
    ].forEach(field => {
      updates[field] = "";
    });
    if (fileInputRefs.current[num]) {
      fileInputRefs.current[num]!.value = "";
    }
    applyBatchUpdates(updates);
    setMeterErrors((prev) => {
      const copy = { ...prev };
      delete copy[num];
      return copy;
    });
    // If this is not the only row, remove the index
    if (rowIndices.length > 1) {
      setRowIndices(prev => prev.filter(id => id !== num));
    }
    notifyUser(`Row ${num} data cleared.`, "info" as any);
  };

  const handleDeleteRow = (num: number) => {
    if (rowIndices.length > 1) {
      // Clear first, then remove
      handleClearRow(num);
      // The clear already removed the index if not the only one, so we just notify
      notifyUser(`Row ${num} deleted.`, "info" as any);
    } else {
      notifyUser(`Cannot delete the last row.`, "warning");
    }
  };

  const handleRowEdit = (num: number) => {
    notifyUser(`Edit mode enabled for Row ${num}`, "info" as any);
  };

  const handleGetLocation = (index: number) => {
    if (!navigator.geolocation) {
      notifyUser("Geolocation not supported.", "error");
      return;
    }
    setIsFetchingGPS((prev) => ({ ...prev, [index]: true }));
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          let finalVal = "";
          if (data && data.address) {
            const addr = data.address;
            const houseNumber = addr.house_number ? `${addr.house_number}, ` : "";
            const road = addr.road ? `${addr.road}, ` : "";
            const suburb = addr.suburb || addr.neighborhood || addr.village || addr.town || "";
            const city = addr.city || addr.county || "";
            const formattedAddress = `${houseNumber}${road}${suburb}, ${city}`.trim();
            finalVal = formattedAddress !== "," ? formattedAddress : data.display_name;
          } else if (data && data.display_name) {
            finalVal = data.display_name;
          } else {
            finalVal = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          }
          applyBatchUpdates({ [`dieselBunk${index}`]: finalVal });
          notifyUser(`Location updated for Row ${index}.`, "success");
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          applyBatchUpdates({ [`dieselBunk${index}`]: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
        } finally {
          setIsFetchingGPS((prev) => ({ ...prev, [index]: false }));
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        notifyUser("Unable to retrieve location.", "error");
        setIsFetchingGPS((prev) => ({ ...prev, [index]: false }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const absoluteDestMeter = destMeter || 0;

  const getMinAllowedMeter = (num: number) => {
    let baseLabel = `Dest Meter (${absoluteDestMeter} KM)`;
    if (num === 1) {
      return { minAllowed: absoluteDestMeter, referenceLabel: baseLabel };
    } else {
      for (let i = num - 1; i >= 1; i--) {
        const prevVal = sheetData[`dieselMeter${i}`];
        if (prevVal !== undefined && prevVal !== "" && !isNaN(Number(prevVal))) {
          return { minAllowed: Number(prevVal), referenceLabel: `Row ${i} (${prevVal} KM)` };
        }
      }
      return { minAllowed: absoluteDestMeter, referenceLabel: baseLabel };
    }
  };

  const handleMeterChange = (num: number, valStr: string) => {
    const currentMeter = valStr === "" ? "" : Number(valStr);
    handleChange(`dieselMeter${num}`, currentMeter);
    if (currentMeter === "" || isNaN(Number(currentMeter))) {
      setMeterErrors((prev) => {
        const copy = { ...prev };
        delete copy[num];
        return copy;
      });
      return;
    }
    const { minAllowed, referenceLabel } = getMinAllowedMeter(num);
    if (minAllowed > 0 && Number(currentMeter) <= minAllowed) {
      const errorMsg = `Must be strictly > ${referenceLabel}`;
      setMeterErrors((prev) => ({ ...prev, [num]: errorMsg }));
    } else {
      setMeterErrors((prev) => {
        const copy = { ...prev };
        delete copy[num];
        return copy;
      });
    }
  };

  const handleRowSubmit = (num: number) => {
    const ltr = sheetData[`dieselLtr${num}`];
    const rate = sheetData[`dieselRate${num}`];
    const reading = sheetData[`dieselMeter${num}`];
    const bunk = sheetData[`dieselBunk${num}`];
    const image = sheetData[`dieselImage${num}`];
    if (!ltr || !rate || reading === undefined || reading === "" || !bunk || !image) {
      notifyUser(`Please fill all mandatory fields for Row ${num}.`, "error");
      return;
    }
    const currentReading = Number(reading);
    const { minAllowed, referenceLabel } = getMinAllowedMeter(num);
    if (minAllowed > 0 && currentReading <= minAllowed) {
      const strictErrorMsg = `Invalid! Meter must be strictly greater than ${referenceLabel}.`;
      setMeterErrors((prev) => ({ ...prev, [num]: strictErrorMsg }));
      notifyUser(`Row ${num}: ${strictErrorMsg}`, "error");
      return;
    }
    if (meterErrors[num]) {
      notifyUser(`Please resolve the reading error in Row ${num} before submitting.`, "error");
      return;
    }
    notifyUser(`Row ${num} submitted successfully!`, "success");
  };

  const lastRowIndex = rowIndices[rowIndices.length - 1];
  const isLastRowSubmitted = !!(
    sheetData[`dieselLtr${lastRowIndex}`] &&
    sheetData[`dieselRate${lastRowIndex}`] &&
    sheetData[`dieselMeter${lastRowIndex}`] &&
    sheetData[`dieselBunk${lastRowIndex}`] &&
    sheetData[`dieselImage${lastRowIndex}`]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">
            {!isLastRowSubmitted ? "Submit current entry to enable adding more rows" : "Ready to add next entry"}
          </span>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
              absoluteDestMeter > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <Gauge size={12} />
            <span>Destination Farm meter :- {absoluteDestMeter > 0 ? `${absoluteDestMeter} KM` : "Error: Dest Meter Prop Missing"}</span>
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
          <span>Add Diesel Entry</span>
        </button>
      </div>

      <div className="relative rounded-lg border border-slate-200 overflow-x-auto shadow-sm pb-2">
        {toastMessage && (
          <div
            className={`absolute top-2 right-2 z-50 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
              toastMessage.type === "error"
                ? "bg-red-600"
                : toastMessage.type === "success"
                ? "bg-emerald-600"
                : "bg-amber-600"
            }`}
          >
            <AlertTriangle size={15} className="shrink-0" />
            <span>{toastMessage.message}</span>
          </div>
        )}

        <table className="sheet-joined-table bg-white min-w-[900px] w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 font-normal text-slate-700 text-[11px] tracking-wider border-b border-slate-200">
              <th className="py-2.5 px-3 text-center w-16">S.No</th>
              <th className="py-2.5 px-2 text-center w-28">Diesel (Ltr) <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-center w-32">Rate (₹ / Ltr) <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-center w-28">Amount (₹)</th>
              <th className="py-2.5 px-2 text-center w-32">Reading <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-left w-56">Bunk Address <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-center w-44">Bill Image / Slip <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-3 text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {rowIndices.map((num, idx) => {
              const ltrVal = sheetData[`dieselLtr${num}`] ?? "";
              const rateVal = sheetData[`dieselRate${num}`] ?? "";
              const meterVal = sheetData[`dieselMeter${num}`] ?? "";
              const bunkVal = sheetData[`dieselBunk${num}`] ?? "";
              const imageVal = sheetData[`dieselImage${num}`] ?? "";
              const imageNameVal = sheetData[`dieselImageName${num}`] || `BILL-${fallbackDateStr}-${String(num).padStart(3, "0")}.png`;
              const amountVal = dieselAmounts[num - 1] !== undefined ? dieselAmounts[num - 1] : 0;
              const hasError = !!meterErrors[num];
              const isSubmitted = !!(ltrVal && rateVal && meterVal && bunkVal && imageVal);
              const isFetching = !!isFetchingGPS[num];
              const { minAllowed: rowMinAllowed } = getMinAllowedMeter(num);

              return (
                <tr
                  key={num}
                  className={`border-b border-slate-100 transition-colors ${
                    isSubmitted ? "bg-emerald-50/30" : "hover:bg-slate-50/50"
                  }`}
                >
                  <td className="text-slate-700 text-xs py-2 px-3 text-center bg-slate-50/85">{idx + 1}</td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder=""
                      disabled={isSubmitted}
                      value={ltrVal}
                      onKeyDown={blockInvalidChar}
                      onChange={(e) =>
                        handleFieldChange(`dieselLtr${num}`, num, e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-24 text-center p-1 bg-slate-50/70 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-slate-300 rounded text-xs mx-auto block outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder=""
                      disabled={isSubmitted}
                      value={rateVal}
                      onKeyDown={blockInvalidChar}
                      onChange={(e) =>
                        handleFieldChange(`dieselRate${num}`, num, e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-32 text-center p-1 bg-slate-50/70 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-slate-300 rounded text-xs mx-auto block outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </td>
                  <td className="p-1 text-center text-slate-800 text-xs bg-slate-50/40">
                    {amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-1 text-center relative">
                    <input
                      type="number"
                      min={rowMinAllowed > 0 ? rowMinAllowed + 1 : 0}
                      placeholder=""
                      disabled={isSubmitted}
                      value={meterVal}
                      onKeyDown={blockInvalidChar}
                      onChange={(e) => handleMeterChange(num, e.target.value)}
                      className={`w-24 text-center p-1 bg-slate-50/70 hover:bg-slate-100 focus:bg-white border ${
                        hasError ? "border-red-500 bg-red-50 text-red-900" : "border-slate-200"
                      } focus:ring-1 focus:ring-slate-300 rounded text-xs mx-auto block outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500`}
                    />
                  </td>
                  <td className="p-1 text-left align-middle px-2">
                    <div className="relative flex items-center w-full bg-slate-50/70 hover:bg-slate-100 focus-within:bg-white rounded border border-slate-200 transition-all">
                      <input
                        type="text"
                        placeholder="Bunk Address..."
                        disabled={isSubmitted || isFetching}
                        value={bunkVal}
                        title={bunkVal}
                        onChange={(e) => handleFieldChange(`dieselBunk${num}`, num, e.target.value)}
                        className="w-full pl-2.5 pr-16 py-1 bg-transparent border-0 outline-none text-xs text-slate-700 disabled:text-slate-500 truncate"
                      />
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleGetLocation(num)}
                          disabled={isFetching}
                          className="absolute right-1 px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 border border-slate-200 shadow-sm transition-all disabled:opacity-70 disabled:cursor-wait"
                          title="Get Precise GPS Location"
                        >
                          {isFetching ? (
                            <Loader2 size={11} className="text-blue-500 shrink-0 animate-spin" />
                          ) : (
                            <MapPin size={11} className="text-red-500 shrink-0" />
                          )}
                          <span>{isFetching ? "..." : "GPS"}</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-1 text-center align-middle">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => {
                        fileInputRefs.current[num] = el;
                      }}
                      onChange={(e) => handleImageUpload(num, e)}
                    />
                    {imageVal ? (
                      <div className="w-full px-2 flex justify-center">
                        <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 flex items-center justify-between gap-2 max-w-[150px] w-full">
                          <a
                            href={imageVal}
                            download={imageNameVal}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium truncate w-full cursor-pointer text-left transition-colors"
                            title={`Download ${imageNameVal}`}
                          >
                            {imageNameVal}
                          </a>
                          {!isSubmitted && (
                            <button
                              type="button"
                              onClick={() => {
                                const updates: Record<string, any> = {
                                  [`dieselImage${num}`]: "",
                                  [`dieselImageName${num}`]: "",
                                };
                                applyBatchUpdates(updates);
                                if (fileInputRefs.current[num]) fileInputRefs.current[num]!.value = "";
                              }}
                              className="text-slate-400 hover:text-red-600 transition-colors shrink-0"
                              title="Remove File"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      !isSubmitted && (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[num]?.click()}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 mx-auto transition-all shadow-sm"
                        >
                          <Upload size={13} className="text-slate-500" />
                          <span>Upload Bill</span>
                        </button>
                      )
                    )}
                  </td>
                  <td className="p-1 text-center align-middle">
                    <div className="flex items-center justify-center gap-2">
                      {isSubmitted ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRowEdit(num)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-full transition-all shadow-xs"
                            title="Edit Row"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(num)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-full transition-all shadow-xs"
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleClearRow(num)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-full transition-all shadow-xs"
                            title="Clear Row"
                          >
                            <CircleX size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowSubmit(num)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-full transition-all shadow-xs"
                            title="Submit Row"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
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