// src/modules/operations/fuel-expenses/components/FuelEntryForm.tsx

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { CheckCircle2, ExternalLink, MapPin, Upload, X, Loader2, Fuel } from "lucide-react";
import type { FuelExpense, FuelExpenseDraft } from "../types/fuelExpense";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useI18n } from "../../../../i18n";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { formatVehicleNumber } from "../../../../utils/format";
import { DatePicker } from "../../../../components/common/DatePicker";
import { amountInWords } from "../../collections/utils/amountInWords";
import SearchableSelect from "../../../../components/common/SearchableSelect";
import { compressImageFile } from "../../../../utils/compressImage";
import { captureGpsQuiet } from "../../vehicle-trips/utils/captureGps";
import { reverseGeocode } from "../../vehicle-trips/utils/reverseGeocode";
import { GpsAddressText } from "../../vehicle-trips/components/GpsAddressText";
import { googleMapsUrl, isValidGps, resolveFuelGps } from "../utils/fuelGps";
import type { BirdType } from "../../../masters/bird-types/types/birdType";

interface Props {
  onSave: (data: FuelExpenseDraft) => void;
  onUpdate: (id: string, updates: Partial<FuelExpense>) => void;
  editingId?: string | null;
  initialData?: FuelExpense | null;
  vehicles: Array<{ id: number; status?: string; vehicleNumber: string }>;
  drivers: Array<{ id: number; employeeName: string }>;
  supervisors?: Array<{ id: number; employeeName: string }>;
  fuelBunks: BirdType[];
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
  supervisors = [],
  fuelBunks,
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
  const [supervisorId, setSupervisorId] = useState<number>(0);
  const [supervisorName, setSupervisorName] = useState("");
  const [meterReading, setMeterReading] = useState<number>(0);
  const [minMeterReading, setMinMeterReading] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [litres, setLitres] = useState<number>(0);
  const [petrolBunk, setPetrolBunk] = useState("");
  const [bunkSelection, setBunkSelection] = useState("");
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
      setSupervisorId(initialData.supervisorId ?? 0);
      setSupervisorName(initialData.supervisorName ?? "");
      setMeterReading(initialData.meterReading);
      setMinMeterReading(initialData.meterReading);
      setAmount(initialData.amount);
      setRate(initialData.rate);
      setLitres(initialData.litres);
      setPetrolBunk(initialData.petrolBunk);
      setBunkSelection(fuelBunks.some((bunk) => bunk.birdType === initialData.petrolBunk) ? initialData.petrolBunk : "__OTHER__");
      const initialGps = resolveFuelGps(initialData.gpsLat, initialData.gpsLon, initialData.gpsAddress);
      setGpsAddress(initialGps.placeName);
      setImage(initialData.image || "");
      setImageName(initialData.imageName || "");
      setGpsLat(initialGps.lat);
      setGpsLon(initialGps.lon);
      setGpsAccuracy(initialData.gpsAccuracy ?? null);
      setGpsCapturedAt(initialData.gpsCapturedAt ?? null);
    }
  }, [initialData, editingId, fuelBunks]);

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
    setSupervisorId(0);
    setSupervisorName("");
    setMeterReading(0);
    setMinMeterReading(0);
    setAmount(0);
    setRate(0);
    setLitres(0);
    setPetrolBunk("");
    setBunkSelection("");
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
  const supervisorOptions = supervisors.map((s) => ({
    value: String(s.id),
    label: localizeTripViewText(s.employeeName, language),
  }));

  const bunkOptions = [
    ...fuelBunks.map((bunk) => ({ value: bunk.birdType, label: bunk.birdType })),
    { value: "__OTHER__", label: t("common.other") },
  ];

  const handleBunkChange = (selectedValue: string) => {
    setBunkSelection(selectedValue);
    setGpsError(null);
    if (selectedValue === "__OTHER__") {
      setPetrolBunk("");
      setGpsAddress("");
      setGpsLat(null);
      setGpsLon(null);
      setGpsAccuracy(null);
      setGpsCapturedAt(null);
      void fetchGPSLocation();
      return;
    }
    const bunk = fuelBunks.find((item) => item.birdType === selectedValue);
    const bunkGps = resolveFuelGps(bunk?.latitude, bunk?.longitude, bunk?.address);
    setPetrolBunk(bunk?.birdType ?? "");
    setGpsAddress(bunkGps.placeName);
    setGpsLat(bunkGps.lat);
    setGpsLon(bunkGps.lon);
    setGpsAccuracy(bunkGps.lat != null && bunkGps.lon != null ? 0 : null);
    setGpsCapturedAt(bunkGps.lat != null && bunkGps.lon != null ? new Date().toISOString() : null);
    if (bunkGps.lat != null && bunkGps.lon != null && !bunkGps.placeName) {
      void reverseGeocode(bunkGps.lat, bunkGps.lon).then(({ address }) => {
        if (address) setGpsAddress(address);
      });
    }
  };

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
    setIsFetchingLocation(true);
    setGpsError(null);
    void captureGpsQuiet({ timeoutMs: 8000 }).then(async (gps) => {
      if (gps) {
        setGpsLat(gps.latitude);
        setGpsLon(gps.longitude);
        setGpsAccuracy(gps.accuracy);
        setGpsCapturedAt(gps.capturedAt);
        const { address } = await reverseGeocode(gps.latitude, gps.longitude);
        setGpsAddress(address || "");
      } else {
        const message = language === "te" ? "GPS స్థానం అందుబాటులో లేదు." : "GPS location unavailable.";
        setGpsError(message);
        showNotification(message, "info");
      }
      setIsFetchingLocation(false);
    });
  };

  const handleSubmit = async () => {
    let place = gpsAddress.trim();
    if (isValidGps(gpsLat, gpsLon) && !place) {
      const { address } = await reverseGeocode(Number(gpsLat), Number(gpsLon));
      place = address || "";
      if (place) setGpsAddress(place);
    }
    if (!date || !vehicleId || !driverId || meterReading <= 0 || litres <= 0 || rate <= 0 || !petrolBunk.trim() || !isValidGps(gpsLat, gpsLon) || !image) {
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
      supervisorId: supervisorId || undefined,
      supervisorName: supervisorName || undefined,
      meterReading,
      amount,
      rate,
      litres,
      petrolBunk,
      gpsAddress: place,
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
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="group inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                <X size={15} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" />
                {t("common.cancel")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="group inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <CheckCircle2 size={15} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {editingId ? t("ops.fuel.update_bill") : t("ops.fuel.save_bill")}
            </button>
          </div>
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

          {/* Supervisor — same crew identity as Step 5 diesel bills */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              {t("common.supervisor")}
            </label>
            <SearchableSelect
              label=""
              options={supervisorOptions}
              value={supervisorId ? String(supervisorId) : ""}
              onChange={(selectedValue) => {
                const person = supervisors.find((item) => String(item.id) === selectedValue);
                if (person) {
                  setSupervisorId(person.id);
                  setSupervisorName(person.employeeName);
                } else {
                  setSupervisorId(0);
                  setSupervisorName("");
                }
              }}
              placeholder={t("common.supervisor")}
              searchable
              allowClear
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

          {/* Fuel bunk master — identical source and Other behavior as Trip Step 5. */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">{t("ops.fuel.petrol_bunk")} <span className="text-red-500">*</span></label>
            <SearchableSelect label="" options={bunkOptions} value={bunkSelection} onChange={handleBunkChange} placeholder="Select bunk" searchable allowClear={false} widthClass="w-full" />
            {bunkSelection === "__OTHER__" && <input type="text" value={petrolBunk} maxLength={150} onChange={(e) => setPetrolBunk(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500" placeholder={t("ops.fuel.enter_bunk")} />}
          </div>

          {/* GPS — same reverse-geocoded place name as Trip Entry Step 2 */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">GPS <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <div className="flex h-[42px] min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">
                {isValidGps(gpsLat, gpsLon) ? (
                  <span className="min-w-0 truncate">
                    <GpsAddressText lat={gpsLat} lon={gpsLon} fallback="ops.trip.location_captured" />
                  </span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">GPS: {t("ops.trip.not_captured")}</span>
                )}
              </div>
              <button
                type="button"
                onClick={fetchGPSLocation}
                disabled={isFetchingLocation || (bunkSelection !== "__OTHER__" && Boolean(bunkSelection))}
                className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetchingLocation ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="hidden sm:inline">{bunkSelection && bunkSelection !== "__OTHER__" ? "Master GPS" : t("ops.trip.get_gps")}</span>
              </button>
            </div>
            {isValidGps(gpsLat, gpsLon) ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="font-mono font-semibold text-emerald-700">
                  {Number(gpsLat).toFixed(6)}°N, {Number(gpsLon).toFixed(6)}°E
                </span>
                <a
                  href={googleMapsUrl(Number(gpsLat), Number(gpsLon))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                >
                  <ExternalLink size={11} />
                  {t("masters.shops.location.open_maps")}
                </a>
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-slate-400">{t("ops.fuel.gps_not_captured")}</div>
            )}
            {gpsError && <div className="text-[10px] text-red-600 mt-1">{gpsError}</div>}
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
              className="group inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              <X size={15} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" />
              {t("common.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="group inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-[0.97]"
          >
            <CheckCircle2 size={15} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
            {editingId ? t("ops.fuel.update_bill") : t("ops.fuel.save_bill")}
          </button>
        </div>
      </div>
    </>
  );
});

FuelEntryForm.displayName = "FuelEntryForm";
