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
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker"; // adjust path

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

  const inputClass = () =>
    "w-full pl-12 pr-4 py-4 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition border-slate-200 bg-white appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  const numberInputClass = () =>
    inputClass() + " [&::-moz-inner-spin-button]:appearance-none";

  const iconWrapperClass = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400";

  const title = isEditing ? "Edit Vehicle" : "Add Vehicle";
  const subtitle = isEditing ? "Update information" : "Fill in the information";

  const toggleStatus = () => {
    setStatus(status === "Active" ? "Inactive" : "Active");
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-100 to-slate-200/80 px-8 py-5 flex items-center justify-between border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-2xl">
            <Truck className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>

        {/* Status toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <button
            type="button"
            onClick={toggleStatus}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status === "Active" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${
              status === "Active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Form Body – 3 columns */}
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vehicle Number */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
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
            <label className="block mb-2 text-base font-medium text-slate-700">
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

          {/* No. of Boxes */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
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

          {/* Bird Capacity */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
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

          {/* Capacity (Kg) */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
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
            <label className="block mb-2 text-base font-medium text-slate-700">
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
            <label className="block mb-2 text-base font-medium text-slate-700">
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
            <label className="block mb-2 text-base font-medium text-slate-700">
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
            <label className="block mb-2 text-base font-medium text-slate-700">
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

          {/* Insurance Expiry – with placement="top" */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
              Insurance Expiry
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={20} />
              <DatePicker
                value={insuranceExpiry}
                onChange={setInsuranceExpiry}
                placeholder="Select date"
                placement="top"
                className="w-full pl-12 pr-4 py-4 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition border-slate-200 bg-white appearance-none"
              />
            </div>
          </div>

          {/* Permit Expiry – with placement="top" */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
              Permit Expiry
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={20} />
              <DatePicker
                value={permitExpiry}
                onChange={setPermitExpiry}
                placeholder="Select date"
                placement="top"
                className="w-full pl-12 pr-4 py-4 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition border-slate-200 bg-white appearance-none"
              />
            </div>
          </div>

          {/* Fitness Expiry – with placement="top" */}
          <div className="relative">
            <label className="block mb-2 text-base font-medium text-slate-700">
              Fitness Expiry
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={20} />
              <DatePicker
                value={fitnessExpiry}
                onChange={setFitnessExpiry}
                placeholder="Select date"
                placement="top"
                className="w-full pl-12 pr-4 py-4 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition border-slate-200 bg-white appearance-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition font-medium text-base text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm hover:shadow font-medium text-base"
          >
            {isEditing ? "Update Vehicle" : "Save Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VehicleForm;