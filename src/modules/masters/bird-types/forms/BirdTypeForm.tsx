import { useEffect, useState } from "react";
import type { BirdType } from "../types/birdType";
import { useNotification } from "../../../../context/NotificationContext";

type BirdTypeFormProps = {
  birdType?: BirdType | null;
  onSave: (birdType: any) => void;
  onCancel: () => void;
};

function BirdTypeForm({ birdType, onSave, onCancel }: BirdTypeFormProps) {
  const { showNotification } = useNotification();

  const [birdTypeName, setBirdTypeName] = useState("");
  const [averageWeight, setAverageWeight] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  useEffect(() => {
    if (birdType) {
      setBirdTypeName(birdType.birdType);
      setAverageWeight(birdType.averageWeight);
      setDescription(birdType.description ?? "");
      setStatus(birdType.status);
    } else {
      setBirdTypeName("");
      setAverageWeight("");
      setDescription("");
      setStatus("Active");
    }
  }, [birdType]);

  const handleSubmit = () => {
    if (!birdTypeName || averageWeight === "" || averageWeight <= 0) {
      showNotification("Please fill all required fields with valid values.", "error");
      return;
    }

    onSave({
      birdType: birdTypeName,
      averageWeight: Number(averageWeight),
      description,
      status,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Bird Type <span className="text-red-500">*</span>
          </label>
          <input
            value={birdTypeName}
            onChange={(e) => setBirdTypeName(e.target.value)}
            placeholder="e.g., Broiler, Layer"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Average Weight (kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={averageWeight}
            onChange={(e) => setAverageWeight(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g., 1.5"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description"
            rows={2}
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
          {birdType ? "Update Bird Type" : "Save Bird Type"}
        </button>
      </div>
    </div>
  );
}

export default BirdTypeForm;