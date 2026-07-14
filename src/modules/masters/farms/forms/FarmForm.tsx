import { useEffect, useState } from "react";
import type { Farm } from "../types/farm";
import { useNotification } from "../../../../context/NotificationContext";

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
  const { showNotification } = useNotification();

  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

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
  }, [farm]);

  const handleSubmit = () => {
    if (!farmName || !ownerName || !supervisorName || !phoneNumber || !village || capacity === "") {
      showNotification("Please fill all mandatory fields.", "error");
      return;
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      showNotification("Mobile Number must be exactly 10 digits.", "error");
      return;
    }
    onSave({
      farmName,
      ownerName,
      supervisorName,
      phoneNumber,
      village,
      address,
      capacity: Number(capacity),
      status,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Farm Name <span className="text-red-500">*</span>
        </label>
        <input
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
          placeholder="Enter Farm Name"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Owner Name <span className="text-red-500">*</span>
        </label>
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Enter Owner Name"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Supervisor Name <span className="text-red-500">*</span>
        </label>
        <input
          value={supervisorName}
          onChange={(e) => setSupervisorName(e.target.value)}
          placeholder="Enter Supervisor Name"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Mobile Number <span className="text-red-500">*</span>
        </label>
        <input
          value={phoneNumber}
          maxLength={10}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter Mobile Number"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Village <span className="text-red-500">*</span>
        </label>
        <input
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          placeholder="Enter Village"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Address"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Bird Capacity <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Enter Bird Capacity"
          className="w-full border rounded-lg p-3"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-700">
          Farm Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
          className="w-full border rounded-lg p-3"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-3">
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
          {farm ? "Update Farm" : "Save Farm"}
        </button>
      </div>
    </div>
  );
}

export default FarmForm;