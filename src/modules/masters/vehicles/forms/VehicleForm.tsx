import { useEffect, useState } from "react";
import type { Vehicle } from "../types/vehicle";
import { useNotification } from "../../../../context/NotificationContext";
import {
  Truck,
  Package,
  Weight,
  Bird,
  MapPin,
  Landmark,
  Gauge,
  Cpu,
  Calendar,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
} from "lucide-react";

type VehicleFormProps = {
  vehicle?: Vehicle | null;
  onSave: (vehicle: any) => void;
  onCancel: () => void;
};

function VehicleForm({ vehicle, onSave, onCancel }: VehicleFormProps) {
  const { showNotification } = useNotification();

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [noOfBoxes, setNoOfBoxes] = useState<number | "">("");
  const [birdCapacity, setBirdCapacity] = useState<number | "">("");
  const [capacityKg, setCapacityKg] = useState<number | "">("");
  const [trackingId, setTrackingId] = useState("");
  const [fastagBank, setFastagBank] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [permitExpiry, setPermitExpiry] = useState("");
  const [fitnessExpiry, setFitnessExpiry] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const isEditing = !!vehicle;

  useEffect(() => {
    if (vehicle) {
      setVehicleNumber(vehicle.vehicleNumber);
      setVehicleType(vehicle.vehicleType);
      setNoOfBoxes(vehicle.noOfBoxes);
      setBirdCapacity(vehicle.birdCapacity);
      setCapacityKg(vehicle.capacityKg);
      setTrackingId(vehicle.trackingId ?? "");
      setFastagBank(vehicle.fastagBank ?? "");
      setEngineNumber(vehicle.engineNumber ?? "");
      setChassisNumber(vehicle.chassisNumber ?? "");
      setInsuranceExpiry(vehicle.insuranceExpiry ?? "");
      setPermitExpiry(vehicle.permitExpiry ?? "");
      setFitnessExpiry(vehicle.fitnessExpiry ?? "");
      setStatus(vehicle.status);
    } else {
      setVehicleNumber("");
      setVehicleType("");
      setNoOfBoxes("");
      setBirdCapacity("");
      setCapacityKg("");
      setTrackingId("");
      setFastagBank("");
      setEngineNumber("");
      setChassisNumber("");
      setInsuranceExpiry("");
      setPermitExpiry("");
      setFitnessExpiry("");
      setStatus("Active");
    }
  }, [vehicle]);

  const handleSubmit = () => {
    if (!vehicleNumber || !vehicleType || noOfBoxes === "" || birdCapacity === "" || capacityKg === "") {
      showNotification("Please fill all required fields.", "error");
      return;
    }
    onSave({
      vehicleNumber,
      vehicleType,
      noOfBoxes: Number(noOfBoxes),
      birdCapacity: Number(birdCapacity),
      capacityKg: Number(capacityKg),
      trackingId,
      fastagBank,
      engineNumber,
      chassisNumber,
      insuranceExpiry,
      permitExpiry,
      fitnessExpiry,
      status,
    });
  };

  // Clean input styling – no spinner arrows
  const inputClass = () =>
    "w-full pl-12 pr-4 py-4 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition border-slate-200 bg-white appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  const numberInputClass = () =>
    inputClass() + " [&::-moz-inner-spin-button]:appearance-none";

  const iconWrapperClass = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400";

  // Dynamic title & subtitle
  const title = isEditing ? "Update Vehicle" : "Add Vehicle";
  const subtitle = isEditing ? "Update information" : "Fill in the information";

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header – clean, no extra decorations */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Truck className="h-8 w-8 text-white" />
          <div>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <div className="text-sm text-blue-100">{subtitle}</div>
          </div>
        </div>

        {/* Status dropdown – on the right */}
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
          {status === "Active" ? (
            <CheckCircle size={20} className="text-green-400" />
          ) : (
            <XCircle size={20} className="text-red-400" />
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
            className="bg-transparent border-none text-white font-medium text-base focus:ring-0 cursor-pointer outline-none"
          >
            <option value="Active" className="text-slate-800">Active</option>
            <option value="Inactive" className="text-slate-800">Inactive</option>
          </select>
        </div>
      </div>

      {/* Form Body – 3 columns */}
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vehicle Number */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Vehicle Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Truck className={iconWrapperClass} size={20} />
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g., AP-01-AB-1234"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Vehicle Type */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Package className={iconWrapperClass} size={20} />
              <input
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder="e.g., LCV, Truck, Trailer"
                className={inputClass()}
              />
            </div>
          </div>

          {/* No. of Boxes – no spinner */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              No. of Boxes <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Package className={iconWrapperClass} size={20} />
              <input
                type="number"
                value={noOfBoxes}
                onChange={(e) => setNoOfBoxes(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g., 12"
                className={numberInputClass()}
              />
            </div>
          </div>

          {/* Bird Capacity – no spinner */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Bird Capacity <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Bird className={iconWrapperClass} size={20} />
              <input
                type="number"
                value={birdCapacity}
                onChange={(e) => setBirdCapacity(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g., 2000"
                className={numberInputClass()}
              />
            </div>
          </div>

          {/* Capacity (Kg) – no spinner */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Capacity (Kg) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Weight className={iconWrapperClass} size={20} />
              <input
                type="number"
                value={capacityKg}
                onChange={(e) => setCapacityKg(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g., 5000"
                className={numberInputClass()}
              />
            </div>
          </div>

          {/* Tracking ID */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Tracking ID
            </label>
            <div className="relative">
              <MapPin className={iconWrapperClass} size={20} />
              <input
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="GPS tracking ID"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Fastag Bank */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Fastag Bank
            </label>
            <div className="relative">
              <Landmark className={iconWrapperClass} size={20} />
              <input
                value={fastagBank}
                onChange={(e) => setFastagBank(e.target.value)}
                placeholder="e.g., HDFC, Axis"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Engine Number */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Engine Number
            </label>
            <div className="relative">
              <Gauge className={iconWrapperClass} size={20} />
              <input
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                placeholder="Engine number"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Chassis Number */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Chassis Number
            </label>
            <div className="relative">
              <Cpu className={iconWrapperClass} size={20} />
              <input
                value={chassisNumber}
                onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                placeholder="Chassis number"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Insurance Expiry */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Insurance Expiry
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={20} />
              <input
                type="date"
                value={insuranceExpiry}
                onChange={(e) => setInsuranceExpiry(e.target.value)}
                className={`${inputClass()} [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
              />
            </div>
          </div>

          {/* Permit Expiry */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Permit Expiry
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={20} />
              <input
                type="date"
                value={permitExpiry}
                onChange={(e) => setPermitExpiry(e.target.value)}
                className={`${inputClass()} [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
              />
            </div>
          </div>

          {/* Fitness Expiry */}
          <div className="relative">
            <label className="block mb-2 text-sm font-medium text-slate-700">
              Fitness Expiry
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={20} />
              <input
                type="date"
                value={fitnessExpiry}
                onChange={(e) => setFitnessExpiry(e.target.value)}
                className={`${inputClass()} [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition hover:scale-105 active:scale-95 font-medium text-base text-slate-700 flex items-center gap-2"
          >
            <XCircle size={20} />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition hover:scale-105 active:scale-95 shadow-md hover:shadow-lg font-medium text-base flex items-center gap-2"
          >
            {isEditing ? <Edit size={20} /> : <Plus size={20} />}
            {isEditing ? "Update Vehicle" : "Save Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VehicleForm;