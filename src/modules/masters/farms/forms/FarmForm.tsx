import { useEffect, useState } from "react";
import type { Farm } from "../types/farm";

type FarmFormProps = {
  farm?: Farm | null;
  onSave: (farm: {
    farmName: string;
    ownerName: string;
    supervisorName: string;
    phoneNumber: string;
    village: string;
    address: string;
    capacity: number;
    status: "Active" | "Inactive";
  }) => void;
  onCancel: () => void;
};

function FarmForm({ farm, onSave, onCancel }: FarmFormProps) {
  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Error state
  const [errors, setErrors] = useState({
    farmName: "",
    ownerName: "",
    supervisorName: "",
    phoneNumber: "",
    village: "",
    capacity: "",
  });

  useEffect(() => {
    if (farm) {
      setFarmName(farm.farmName);
      setOwnerName(farm.ownerName);
      setSupervisorName(farm.supervisorName);
      setPhoneNumber(farm.phoneNumber);
      setVillage(farm.village);
      setAddress(farm.address ?? "");
      setCapacity(farm.capacity ?? "");
      setStatus(farm.status);
    } else {
      setFarmName("");
      setOwnerName("");
      setSupervisorName("");
      setPhoneNumber("");
      setVillage("");
      setAddress("");
      setCapacity("");
      setStatus("Active");
    }
    // Clear errors when switching between edit/create
    setErrors({
      farmName: "",
      ownerName: "",
      supervisorName: "",
      phoneNumber: "",
      village: "",
      capacity: "",
    });
  }, [farm]);

  // Clear a specific error when the user types
  const clearFieldError = (field: keyof typeof errors) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = () => {
    // Validate all fields and set errors
    let hasError = false;
    const newErrors = { ...errors };

    // Farm Name
    if (!farmName.trim()) {
      newErrors.farmName = "Farm Name is required.";
      hasError = true;
    } else {
      newErrors.farmName = "";
    }

    // Owner Name (required, min 3 chars)
    if (!ownerName.trim()) {
      newErrors.ownerName = "Owner Name is required.";
      hasError = true;
    } else if (ownerName.trim().length < 3) {
      newErrors.ownerName = "Owner Name must contain at least 3 characters.";
      hasError = true;
    } else {
      newErrors.ownerName = "";
    }

    // Supervisor Name
    if (!supervisorName.trim()) {
      newErrors.supervisorName = "Supervisor Name is required.";
      hasError = true;
    } else {
      newErrors.supervisorName = "";
    }

    // Mobile Number
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Mobile Number is required.";
      hasError = true;
    } else if (!/^[0-9]{10}$/.test(phoneNumber)) {
      newErrors.phoneNumber = "Mobile Number must be exactly 10 digits.";
      hasError = true;
    } else {
      newErrors.phoneNumber = "";
    }

    // Village
    if (!village.trim()) {
      newErrors.village = "Village is required.";
      hasError = true;
    } else {
      newErrors.village = "";
    }

    // Bird Capacity
    if (capacity === "" || capacity === null || capacity === undefined) {
      newErrors.capacity = "Bird Capacity is required.";
      hasError = true;
    } else if (Number(capacity) <= 0) {
      newErrors.capacity = "Bird Capacity must be a positive number.";
      hasError = true;
    } else {
      newErrors.capacity = "";
    }

    setErrors(newErrors);

    if (hasError) {
      return; // stop submission
    }

    // All valid → call onSave
    onSave({
      farmName: farmName.trim(),
      ownerName: ownerName.trim(),
      supervisorName: supervisorName.trim(),
      phoneNumber: phoneNumber.trim(),
      village: village.trim(),
      address: address.trim(),
      capacity: Number(capacity),
      status,
    });
  };

  // Helper to get error‑prone input classes
  const inputClass = (field: keyof typeof errors) =>
    `w-full border rounded-lg p-3 ${
      errors[field] ? "border-red-500" : "border-slate-300"
    }`;

  return (
    <div className="space-y-5">
      {/* Farm Name */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Farm Name <span className="text-red-500">*</span>
        </label>
        <input
          value={farmName}
          onChange={(e) => {
            setFarmName(e.target.value);
            clearFieldError("farmName");
          }}
          placeholder="Enter Farm Name"
          className={inputClass("farmName")}
        />
        {errors.farmName && (
          <p className="mt-1 text-sm text-red-500">{errors.farmName}</p>
        )}
      </div>

      {/* Owner Name */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Owner Name <span className="text-red-500">*</span>
        </label>
        <input
          value={ownerName}
          onChange={(e) => {
            setOwnerName(e.target.value);
            clearFieldError("ownerName");
          }}
          placeholder="Enter Owner Name"
          className={inputClass("ownerName")}
        />
        {errors.ownerName && (
          <p className="mt-1 text-sm text-red-500">{errors.ownerName}</p>
        )}
      </div>

      {/* Supervisor Name */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Supervisor Name <span className="text-red-500">*</span>
        </label>
        <input
          value={supervisorName}
          onChange={(e) => {
            setSupervisorName(e.target.value);
            clearFieldError("supervisorName");
          }}
          placeholder="Enter Supervisor Name"
          className={inputClass("supervisorName")}
        />
        {errors.supervisorName && (
          <p className="mt-1 text-sm text-red-500">{errors.supervisorName}</p>
        )}
      </div>

      {/* Mobile Number */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Mobile Number <span className="text-red-500">*</span>
        </label>
        <input
          value={phoneNumber}
          maxLength={10}
          onChange={(e) => {
            setPhoneNumber(e.target.value.replace(/\D/g, ""));
            clearFieldError("phoneNumber");
          }}
          placeholder="Enter Mobile Number"
          className={inputClass("phoneNumber")}
        />
        {errors.phoneNumber && (
          <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
        )}
      </div>

      {/* Village */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Village <span className="text-red-500">*</span>
        </label>
        <input
          value={village}
          onChange={(e) => {
            setVillage(e.target.value);
            clearFieldError("village");
          }}
          placeholder="Enter Village"
          className={inputClass("village")}
        />
        {errors.village && (
          <p className="mt-1 text-sm text-red-500">{errors.village}</p>
        )}
      </div>

      {/* Address */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Address"
          className="w-full border border-slate-300 rounded-lg p-3"
          rows={2}
        />
      </div>

      {/* Bird Capacity */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Bird Capacity <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          value={capacity}
          onChange={(e) => {
            setCapacity(e.target.value === "" ? "" : Number(e.target.value));
            clearFieldError("capacity");
          }}
          placeholder="Enter Bird Capacity"
          className={inputClass("capacity")}
        />
        {errors.capacity && (
          <p className="mt-1 text-sm text-red-500">{errors.capacity}</p>
        )}
      </div>

      {/* Farm Status */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Farm Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
          className="w-full border border-slate-300 rounded-lg p-3"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          {farm ? "Update Farm" : "Save Farm"}
        </button>
      </div>
    </div>
  );
}

export default FarmForm;