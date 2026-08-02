import React, { useRef, useState, useEffect } from "react";
import { Upload, X, MapPin, AlertTriangle, CheckCircle2, Plus, CircleX } from "lucide-react";

interface DieselExpensesTableProps {
  sheetData: any;
  handleChange: (field: string, value: any) => void;
  dieselAmounts: number[];
  totalDieselAmount: number;
  showNotification?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  farmDestinationMeter?: number;
}

export default function DieselExpensesTable({
  sheetData,
  handleChange,
  dieselAmounts,
  totalDieselAmount,
  showNotification,
  farmDestinationMeter,
}: DieselExpensesTableProps) {
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [toastMessage, setToastMessage] = useState<{ message: string; type: "warning" | "error" | "success" } | null>(null);
  const [meterErrors, setMeterErrors] = useState<{ [key: number]: string }>({});
  const [rowSubmitted, setRowSubmitted] = useState<{ [key: number]: boolean }>({});
  const [clearedRows, setClearedRows] = useState<{ [key: number]: boolean }>({});
  
  const [rowIndices, setRowIndices] = useState<number[]>([1]);

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

  const handleAddRow = () => {
    const lastRow = rowIndices[rowIndices.length - 1];
    if (!rowSubmitted[lastRow]) {
      notifyUser("Please submit the current diesel entry before adding a new one.", "warning");
      return;
    }
    const nextId = lastRow + 1;
    setRowIndices((prev) => [...prev, nextId]);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (clearedRows[index]) {
        setClearedRows((prev) => ({ ...prev, [index]: false }));
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange(`dieselImage${index}`, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFieldChange = (field: string, num: number, value: any) => {
    if (clearedRows[num]) {
      setClearedRows((prev) => ({ ...prev, [num]: false }));
    }
    handleChange(field, value);
  };

  const handleClearRow = (num: number) => {
    // Force immediate visual clearing via local state override
    setClearedRows((prev) => ({ ...prev, [num]: true }));

    // Clear all corresponding sheet data fields
    handleChange(`dieselLtr${num}`, "");
    handleChange(`dieselRate${num}`, "");
    handleChange(`dieselMeter${num}`, "");
    handleChange(`dieselBunk${num}`, "");
    handleChange(`dieselImage${num}`, "");

    // Reset file input element reference if present
    if (fileInputRefs.current[num]) {
      fileInputRefs.current[num]!.value = "";
    }

    // Reset submission state and errors for this row
    setRowSubmitted((prev) => ({ ...prev, [num]: false }));
    setMeterErrors((prev) => {
      const copy = { ...prev };
      delete copy[num];
      return copy;
    });

    notifyUser(`Row ${num} data cleared completely.`, "info" as any);
  };

  const handleGetLocation = (index: number) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
            );
            const data = await response.json();
            
            if (clearedRows[index]) {
              setClearedRows((prev) => ({ ...prev, [index]: false }));
            }

            if (data && data.address) {
              const addr = data.address;
              const houseNumber = addr.house_number ? `${addr.house_number}, ` : "";
              const road = addr.road ? `${addr.road}, ` : "";
              const suburb = addr.suburb || addr.neighborhood || addr.village || addr.town || "";
              const city = addr.city || addr.county || "";
              
              const formattedAddress = `${houseNumber}${road}${suburb}, ${city}`.trim();
              const finalVal = formattedAddress !== "," ? formattedAddress : data.display_name;
              
              handleChange(`dieselBunk${index}`, finalVal);
            } else if (data && data.display_name) {
              handleChange(`dieselBunk${index}`, data.display_name);
            } else {
              handleChange(`dieselBunk${index}`, `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
          } catch (error) {
            console.error("Error fetching address", error);
            if (clearedRows[index]) {
              setClearedRows((prev) => ({ ...prev, [index]: false }));
            }
            handleChange(`dieselBunk${index}`, `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        },
        (error) => {
          console.error("Error getting location", error);
          notifyUser("Unable to retrieve your location. Please check permissions.", "error");
        }
      );
    } else {
      notifyUser("Geolocation is not supported by your browser", "error");
    }
  };

  const handleMeterChange = (num: number, valStr: string) => {
    const currentMeter = valStr === "" ? "" : Number(valStr);
    handleFieldChange(`dieselMeter${num}`, num, currentMeter);

    if (currentMeter === "" || isNaN(Number(currentMeter))) {
      setMeterErrors((prev) => {
        const copy = { ...prev };
        delete copy[num];
        return copy;
      });
      return;
    }

    let minAllowed = 0;
    let referenceLabel = "";

    const destMeterVal = 
      farmDestinationMeter ?? 
      sheetData.destMeter ?? 
      sheetData.endMeter ?? 
      sheetData.farmMeter;

    if (num === 1) {
      minAllowed = Number(destMeterVal) || 0;
      referenceLabel = `Farm Destination Reading (${minAllowed} KM)`;
    } else {
      for (let i = num - 1; i >= 1; i--) {
        const prevVal = sheetData[`dieselMeter${i}`];
        if (prevVal !== undefined && prevVal !== "" && !isNaN(Number(prevVal))) {
          minAllowed = Number(prevVal);
          referenceLabel = `Row ${i} Reading (${minAllowed} KM)`;
          break;
        }
      }
      if (minAllowed === 0 && destMeterVal) {
        minAllowed = Number(destMeterVal) || 0;
        referenceLabel = `Farm Destination Reading (${minAllowed} KM)`;
      }
    }

    if (minAllowed > 0 && Number(currentMeter) < minAllowed) {
      const errorMsg = `Row ${num} reading (${currentMeter} KM) cannot be less than ${referenceLabel}.`;
      setMeterErrors((prev) => ({ ...prev, [num]: errorMsg }));
      notifyUser(errorMsg, "warning");
    } else {
      setMeterErrors((prev) => {
        const copy = { ...prev };
        delete copy[num];
        return copy;
      });
    }
  };

  const handleRowSubmit = (num: number) => {
    const ltr = clearedRows[num] ? "" : sheetData[`dieselLtr${num}`];
    const rate = clearedRows[num] ? "" : sheetData[`dieselRate${num}`];
    const reading = clearedRows[num] ? "" : sheetData[`dieselMeter${num}`];
    const bunk = clearedRows[num] ? "" : sheetData[`dieselBunk${num}`];
    const image = clearedRows[num] ? "" : sheetData[`dieselImage${num}`];

    if (!ltr || !rate || reading === undefined || reading === "" || !bunk || !image) {
      notifyUser(`Please fill all mandatory fields (Ltr, Rate, Reading, Bunk Address, and Bill Image) for Row ${num}.`, "error");
      return;
    }

    if (meterErrors[num]) {
      notifyUser(`Please resolve the reading error in Row ${num} before submitting.`, "error");
      return;
    }

    setRowSubmitted((prev) => ({ ...prev, [num]: true }));
    notifyUser(`Row ${num} details submitted successfully!`, "success");
  };

  const lastRowIndex = rowIndices[rowIndices.length - 1];
  const isLastRowSubmitted = !!rowSubmitted[lastRowIndex];

  return (
    <div className="space-y-3">
      {/* Top Bar with Status and Add Button */}
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-medium text-slate-500">
          {!isLastRowSubmitted ? "Submit current entry to enable adding more rows" : "Ready to add next entry"}
        </span>
        <button
          type="button"
          onClick={handleAddRow}
          disabled={!isLastRowSubmitted}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
            isLastRowSubmitted
              ? "bg-slate-800 hover:bg-slate-900 text-white active:scale-95 cursor-pointer"
              : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
          }`}
          title={!isLastRowSubmitted ? "Submit the current entry first to add another" : "Add new diesel entry"}
        >
          <Plus size={14} />
          <span>Add Diesel Entry</span>
        </button>
      </div>

      <div className="relative rounded-lg border border-slate-200 overflow-x-auto shadow-sm">
        {toastMessage && (
          <div className={`absolute top-2 right-2 z-50 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "error" ? "bg-red-600" : toastMessage.type === "success" ? "bg-emerald-600" : "bg-amber-600"
          }`}>
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
              <th className="py-2.5 px-2 text-center w-28">Reading <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-3 text-left">Bunk Address <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-2 text-center w-36">Bill Image / Slip <span className="text-red-500">*</span></th>
              <th className="py-2.5 px-3 text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {rowIndices.map((num, idx) => {
              const isCleared = !!clearedRows[num];
              const imageVal = isCleared ? "" : sheetData[`dieselImage${num}`];
              const bunkVal = isCleared ? "" : sheetData[`dieselBunk${num}`];
              const ltrVal = isCleared ? "" : (sheetData[`dieselLtr${num}`] ?? "");
              const rateVal = isCleared ? "" : (sheetData[`dieselRate${num}`] ?? "");
              const meterVal = isCleared ? "" : (sheetData[`dieselMeter${num}`] ?? "");
              const amountVal = isCleared ? 0 : (dieselAmounts[num - 1] !== undefined ? dieselAmounts[num - 1] : 0);
              const hasError = !isCleared && !!meterErrors[num];
              const isSubmitted = !isCleared && !!rowSubmitted[num];

              return (
                <tr key={num} className={`border-b border-slate-100 transition-colors ${isSubmitted ? "bg-emerald-50/30" : "hover:bg-slate-50/50"}`}>
                  
                  {/* S.NO */}
                  <td className="text-slate-700 text-xs py-2 px-3 text-center bg-slate-50/85">
                    {idx + 1}
                  </td>

                  {/* DIESEL (LTR) */}
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      disabled={isSubmitted}
                      value={ltrVal}
                      onChange={(e) =>
                        handleFieldChange(
                          `dieselLtr${num}`,
                          num,
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-24 text-center p-1 bg-slate-50/70 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-slate-300 rounded text-xs mx-auto block outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </td>

                  {/* RATE (₹ / LTR) */}
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      disabled={isSubmitted}
                      value={rateVal}
                      onChange={(e) =>
                        handleFieldChange(
                          `dieselRate${num}`,
                          num,
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-32 text-center p-1 bg-slate-50/70 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-slate-300 rounded text-xs mx-auto block outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </td>

                  {/* AMOUNT (₹) */}
                  <td className="p-1 text-center text-slate-800 text-xs bg-slate-50/40">
                    {amountVal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* READING */}
                  <td className="p-1 text-center relative">
                    <input
                      type="number"
                      placeholder="Reading"
                      disabled={isSubmitted}
                      value={meterVal}
                      onChange={(e) => handleMeterChange(num, e.target.value)}
                      className={`w-24 text-center p-1 bg-slate-50/70 hover:bg-slate-100 focus:bg-white border ${
                        hasError ? "border-red-500 bg-red-50 text-red-900" : "border-slate-200"
                      } focus:ring-1 focus:ring-slate-300 rounded text-xs mx-auto block outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500`}
                      title={hasError ? meterErrors[num] : ""}
                    />
                    {hasError && (
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-18px] text-[9px] text-red-600 font-semibold whitespace-nowrap z-10">
                        Invalid Reading
                      </div>
                    )}
                  </td>

                  {/* BUNK ADDRESS */}
                  <td className="p-1 text-left align-middle px-2">
                    <div className="relative flex items-center w-full bg-slate-50/70 hover:bg-slate-100 focus-within:bg-white rounded border border-slate-200 transition-all">
                      <input
                        type="text"
                        placeholder="Bunk Address (with house/street info)"
                        disabled={isSubmitted}
                        value={bunkVal}
                        onChange={(e) => handleFieldChange(`dieselBunk${num}`, num, e.target.value)}
                        className="w-full pl-2.5 pr-20 py-1 bg-transparent border-0 outline-none text-xs text-slate-700 disabled:text-slate-500"
                      />
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleGetLocation(num)}
                          className="absolute right-1 px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 border border-slate-200 shadow-sm transition-all"
                          title="Get Precise GPS Location"
                        >
                          <MapPin size={11} className="text-red-500 shrink-0" />
                          <span>GPS</span>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* BILL IMAGE / SLIP */}
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
                      <div className="relative inline-flex items-center justify-center group">
                        <a
                          href={imageVal}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-10 rounded-lg overflow-hidden border border-slate-200 block hover:opacity-90 shadow-sm bg-slate-50"
                          title="View Bill Image"
                        >
                          <img
                            src={imageVal}
                            alt={`Bill ${num}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                        {!isSubmitted && (
                          <button
                            type="button"
                            onClick={() => {
                              handleChange(`dieselImage${num}`, "");
                              if (fileInputRefs.current[num]) fileInputRefs.current[num]!.value = "";
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 shadow-md hover:bg-red-700 transition-all"
                            title="Remove Image"
                          >
                            <X size={12} />
                          </button>
                        )}
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

                  {/* STATUS (Clear X button in circle and Submit Green Tick Mark) */}
                  <td className="p-1 text-center align-middle">
                    <div className="flex items-center justify-center gap-2">
                      {/* Clear Button (Circled X) - Completely wipes out all row data */}
                      <button
                        type="button"
                        onClick={() => handleClearRow(num)}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-full transition-all shadow-xs"
                        title="Clear all data, GPS, and image completely"
                      >
                        <CircleX size={16} />
                      </button>

                      {/* Submit / Submitted Tick Mark */}
                      {isSubmitted ? (
                        <div className="w-7 h-7 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-full border border-emerald-200" title="Submitted">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRowSubmit(num)}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-full transition-all shadow-xs"
                          title="Submit Row"
                        >
                          <CheckCircle2 size={16} />
                        </button>
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