// src/modules/operations/fuel-expenses/components/FuelEntryForm.tsx

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { MapPin, Upload, X, Loader2, Fuel } from "lucide-react";
import type { FuelExpense, FuelExpenseDraft } from "../types/fuelExpense";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useI18n } from "../../../../i18n";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { formatVehicleNumber } from "../../../../utils/format";
import { DatePicker } from "../../../../components/common/DatePicker";
import { amountInWords } from "../../collections/utils/amountInWords";
import SearchableSelect from "../../../../components/common/SearchableSelect";
import { compressImageFile } from "../../../../utils/compressImage";

interface Props {
  onSave: (data: FuelExpenseDraft) => void;
  onUpdate: (id: string, updates: Partial<FuelExpense>) => void;
  editingId?: string | null;
  initialData?: FuelExpense | null;
  vehicles: Array<{ id: number; status?: string; vehicleNumber: string }>;
  drivers: Array<{ id: number; employeeName: string }>;
  onCancel?: () => void;
}

export interface FuelEntryFormRef {
  resetForm: () => void;
}

export const FuelEntryForm = forwardRef<FuelEntryFormRef, Props>(({
  onSave,
  onUpdate,
  editingId,
  initialData,
  vehicles,
  drivers,
  onCancel,
}, ref) => {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleId, setVehicleId] = useState<number>(0);
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverId, setDriverId] = useState<number>(0);
  const [driverName, setDriverName] = useState("");
  const [meterReading, setMeterReading] = useState<number>(0);
  const [minMeterReading, setMinMeterReading] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [litres, setLitres] = useState<number>(0);
  const [petrolBunk, setPetrolBunk] = useState("");
  const [gpsAddress, setGpsAddress] = useState("");
  const [image, setImage] = useState<string>("");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLon, setGpsLon] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsCapturedAt, setGpsCapturedAt] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const activeVehicles = vehicles.filter(v => (v.status?.toLowerCase() === "active"));

  useEffect(() => {
    if (initialData && editingId) {
      setDate(initialData.date);
      setVehicleId(initialData.vehicleId);
      setVehicleNo(initialData.vehicleNo);
      setDriverId(initialData.driverId);
      setDriverName(initialData.driverName);
      setMeterReading(initialData.meterReading);
      setMinMeterReading(initialData.meterReading);
      setAmount(initialData.amount);
      setRate(initialData.rate);
      setLitres(initialData.litres);
      setPetrolBunk(initialData.petrolBunk);
      setGpsAddress(initialData.gpsAddress || "");
      setImage(initialData.image || "");
      setImageName(initialData.imageName || "");
      setGpsLat(initialData.gpsLat ?? null);
      setGpsLon(initialData.gpsLon ?? null);
      setGpsAccuracy(initialData.gpsAccuracy ?? null);
      setGpsCapturedAt(initialData.gpsCapturedAt ?? null);
    }
  }, [initialData, editingId]);

  useEffect(() => {
    if (litres > 0 && rate > 0) {
      setAmount(Number((litres * rate).toFixed(2)));
    } else {
      setAmount(0);
    }
  }, [litres, rate]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setVehicleId(0);
    setVehicleNo("");
    setDriverId(0);
    setDriverName("");
    setMeterReading(0);
    setMinMeterReading(0);
    setAmount(0);
    setRate(0);
    setLitres(0);
    setPetrolBunk("");
    setGpsAddress("");
    setImage("");
    setImageName("");
    setGpsLat(null);
    setGpsLon(null);
    setGpsAccuracy(null);
    setGpsCapturedAt(null);
    setGpsError(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useImperativeHandle(ref, () => ({
    resetForm,
  }));

  const vehicleOptions = activeVehicles.map((v) => ({
    value: String(v.id),
    label: localizeTripViewText(formatVehicleNumber(v.vehicleNumber), language),
  }));

  const driverOptions = drivers.map((d) => ({
    value: String(d.id),
    label: localizeTripViewText(d.employeeName, language),
  }));

  const handleVehicleChange = (selectedValue: string) => {
    const v = activeVehicles.find((x) => String(x.id) === selectedValue);
    if (v) {
      setVehicleId(v.id);
      setVehicleNo(v.vehicleNumber);
      if (!editingId) {
        setMeterReading(0);
        setMinMeterReading(0);
      }
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) return;
    if (file.size === 0) {
      setFileError(language === "te" ? "బిల్లు ఫోటో ఖాళీగా ఉంది." : "Bill photo is empty.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(language === "te" ? "బిల్లు ఫోటో 10 MB కంటే ఎక్కువ ఉంది." : "Bill photo exceeds 10 MB.");
      return;
    }
    if (!/^image\/(jpeg|jpg|png)$/i.test(file.type)) {
      setFileError(language === "te" ? "బిల్లు ఫోటో JPEG లేదా PNG చిత్రంగా ఉండాలి." : "Bill photo must be a JPEG or PNG image.");
      return;
    }
    setIsCompressingImage(true);
    try {
      const compressed = await compressImageFile(file, { maxBytes: 100 * 1024, maxDimension: 1600, minDimension: 640 });
      setImage(compressed.dataUrl);
      setImageName(file.name);
    } catch {
      setFileError(language === "te" ? "బిల్లు ఫోటోను ప్రాసెస్ చేయడం విఫలమైంది." : "Failed to process the bill image.");
    } finally {
      setIsCompressingImage(false);
    }
  };

  const removeImage = () => {
    setImage("");
    setImageName("");
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fetchGPSLocation = () => {
    if (!navigator.geolocation) {
      const msg = language === "te" ? "జియోలొకేషన్ మద్దతు లేదు." : "Geolocation is not supported.";
      setGpsError(msg);
      showNotification(msg, "error");
      return;
    }
    setIsFetchingLocation(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsLat(latitude);
        setGpsLon(longitude);
        setGpsAccuracy(accuracy);
        setGpsCapturedAt(new Date().toISOString());
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          if (data && data.display_name) {
            setGpsAddress(data.display_name);
          }
        } catch {
          /* keep coordinates even if reverse geocode fails */
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? (language === "te" ? "GPS అనుమతి నిరాకరించబడింది." : "GPS permission denied.")
            : err.code === err.TIMEOUT
              ? (language === "te" ? "GPS సమయం ముగిసింది." : "GPS timed out.")
              : (language === "te" ? "GPS స్థానం అందుబాటులో లేదు." : "GPS location unavailable.");
        setGpsError(message);
        showNotification(message, "error");
        setIsFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = () => {
    if (!date || !vehicleId || !driverId || meterReading <= 0 || litres <= 0 || rate <= 0 || !petrolBunk.trim() || gpsLat == null || gpsLon == null || !gpsAddress.trim() || !image) {
      showNotification(
        language === "te" ? "దయచేసి అవసరమైన అన్ని ఇంధన బిల్లు వివరాలను పూరించండి." : "Please complete all required fuel bill details, GPS, and bill upload.",
        "error"
      );
      return;
    }
    if (fileError) {
      showNotification(fileError, "error");
      return;
    }

    const data: FuelExpenseDraft = {
      date,
      vehicleId,
      vehicleNo,
      driverId,
      driverName,
      meterReading,
      amount,
      rate,
      litres,
      petrolBunk,
      gpsAddress,
      image,
      imageName,
      gpsLat,
      gpsLon,
      gpsAccuracy,
      gpsCapturedAt,
    };
    if (editingId) {
      onUpdate(editingId, data);
    } else {
      onSave(data);
      resetForm();
    }
  };

  return (
    <>
      <style>{`
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-4 md:p-6 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Fuel size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {editingId ? t("ops.fuel.edit_bill") : t("ops.fuel.add_bill_manual")}
            </h3>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("common.date")} <span className="text-red-500">*</span>
            </label>
            <DatePicker
              id="manual-fuel-date"
              value={date}
              onChange={setDate}
              placeholder={t("placeholder.enter_date")}
              required
              hideClear
              language={language}
              className="w-full"
            />
          </div>

          {/* Vehicle */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("common.vehicle")} <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              label=""
              options={vehicleOptions}
              value={vehicleId ? String(vehicleId) : ""}
              onChange={handleVehicleChange}
              placeholder={t("ops.fuel.select_vehicle")}
              searchable
              allowClear={false}
              widthClass="w-full"
            />
          </div>

          {/* Driver */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("common.driver")} <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              label=""
              options={driverOptions}
              value={driverId ? String(driverId) : ""}
              onChange={(selectedValue) => {
                const d = drivers.find((x) => String(x.id) === selectedValue);
                if (d) {
                  setDriverId(d.id);
                  setDriverName(d.employeeName);
                }
              }}
              placeholder={t("ops.fuel.select_driver")}
              searchable
              allowClear={false}
              widthClass="w-full"
            />
          </div>

          {/* Meter Reading */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("ops.fuel.meter_km")} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={meterReading || ""}
              onChange={(e) => setMeterReading(Number(e.target.value))}
              className="no-spinner w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500"
              placeholder="0"
            />
            {minMeterReading > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                {t("ops.fuel.min_meter_hint", { min: minMeterReading })}
              </div>
            )}
          </div>

          {/* Litres */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("ops.fuel.litres")} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={litres || ""}
              onChange={(e) => setLitres(Number(e.target.value))}
              className="no-spinner w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>

          {/* Rate */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("ops.fuel.rate_per_l")} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={rate || ""}
              onChange={(e) => setRate(Number(e.target.value))}
              className="no-spinner w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>

          {/* Amount (preview) */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("ops.fuel.amount_formula")}
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              readOnly
              className="no-spinner w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <div className="mt-1 min-h-4 text-[11px] font-medium italic text-emerald-700">{amountInWords(amount, language)}</div>
          </div>

          {/* Bunk City */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">{t("ops.fuel.bunk_city")} <span className="text-red-500">*</span></label>
            <input type="text" value={petrolBunk} onChange={(e) => setPetrolBunk(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500" placeholder={t("ops.fuel.enter_bunk")} />
          </div>

          {/* GPS */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">GPS <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchGPSLocation}
                disabled={isFetchingLocation}
                className="flex w-full items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-200 transition disabled:opacity-60 cursor-pointer"
              >
                {isFetchingLocation ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="hidden sm:inline">GPS</span>
              </button>
            </div>
            {gpsLat != null && gpsLon != null ? (
              <div className="text-[10px] text-emerald-700 mt-1">
                {t("ops.fuel.gps_captured", { coords: `${gpsLat.toFixed(6)}, ${gpsLon.toFixed(6)}` })}
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 mt-1">
                {t("ops.fuel.gps_not_captured")}
              </div>
            )}
            {gpsError && <div className="text-[10px] text-red-600 mt-1">{gpsError}</div>}
            {gpsAddress && <div className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium leading-4 text-emerald-700">{gpsAddress}</div>}
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("ops.fuel.receipt_document")} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressingImage}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-200 transition cursor-pointer"
              >
                {isCompressingImage ? <Loader2 size={16} className="mr-1 inline animate-spin" /> : <Upload size={16} className="inline mr-1" />} {isCompressingImage ? "Compressing..." : t("ops.fuel.upload")}
              </button>
              {image && (
                <button type="button" onClick={removeImage} className="text-red-500 hover:text-red-700 cursor-pointer">
                  <X size={18} />
                </button>
              )}
            </div>
            {fileError && <div className="text-[10px] text-red-600 mt-1">{fileError}</div>}
            {image && (
              <div className="mt-1">
                <img src={image} alt="Bill" className="max-h-12 rounded border border-slate-200" />
              </div>
            )}
          </div>

        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-95 cursor-pointer"
          >
            {editingId ? t("ops.fuel.update_bill") : t("ops.fuel.save_bill")}
          </button>
        </div>
      </div>
    </>
  );
});

FuelEntryForm.displayName = "FuelEntryForm";
