import { useEffect, useState } from "react";
import type { Vehicle } from "../types/vehicle";
import { useNotification } from "../../../../context/NotificationContext";

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
    // Required fields
    if (!vehicleNumber || !vehicleType || noOfBoxes === "" || birdCapacity === "" || capacityKg === "") {
      showNotification("Please fill all required fields.", "error");
      return;
    }
    // No duplicate check here – it's done in the parent page

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Vehicle Number <span className="text-red-500">*</span>
          </label>
          <input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            placeholder="e.g., AP-01-AB-1234"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Vehicle Type <span className="text-red-500">*</span>
          </label>
          <input
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            placeholder="e.g., LCV, Truck, Trailer"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            No. of Boxes <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={noOfBoxes}
            onChange={(e) => setNoOfBoxes(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g., 12"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Bird Capacity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={birdCapacity}
            onChange={(e) => setBirdCapacity(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g., 2000"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Capacity (Kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={capacityKg}
            onChange={(e) => setCapacityKg(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g., 5000"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Tracking ID
          </label>
          <input
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="GPS tracking ID"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Fastag Bank
          </label>
          <input
            value={fastagBank}
            onChange={(e) => setFastagBank(e.target.value)}
            placeholder="e.g., HDFC, Axis"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Engine Number
          </label>
          <input
            value={engineNumber}
            onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
            placeholder="Engine number"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Chassis Number
          </label>
          <input
            value={chassisNumber}
            onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
            placeholder="Chassis number"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Insurance Expiry
          </label>
          <input
            type="date"
            value={insuranceExpiry}
            onChange={(e) => setInsuranceExpiry(e.target.value)}
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Permit Expiry
          </label>
          <input
            type="date"
            value={permitExpiry}
            onChange={(e) => setPermitExpiry(e.target.value)}
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Fitness Expiry
          </label>
          <input
            type="date"
            value={fitnessExpiry}
            onChange={(e) => setFitnessExpiry(e.target.value)}
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Status <span className="text-red-500">*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
            className="w-full border rounded-lg p-2.5"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          {vehicle ? "Update Vehicle" : "Save Vehicle"}
        </button>
      </div>
    </div>
  );
}

export default VehicleForm;