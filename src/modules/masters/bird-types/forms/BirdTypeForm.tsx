import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import {
  masterInputClass,
  masterIconClass,
  masterLabelClass,
  masterTextareaClass,
} from "../../components/masterFormStyles";
import { useId, useEffect, useState } from "react";
import type { BirdType } from "../types/birdType";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { Bird, Weight, FileText } from "lucide-react";

type BirdTypeFormProps = {
  birdType?: BirdType | null;
  onSave: (birdType: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function BirdTypeForm({
  birdType,
  onSave,
  onCancel,
  isSaving = false,
}: BirdTypeFormProps) {
  const formId = useId();
  const fieldId = (text: string) => `${formId}-${text.replace(/\s+/g, "-")}`;
  const { showNotification } = useSafeNotification();
  const [birdTypeName, setBirdTypeName] = useState("");
  const [averageWeight, setAverageWeight] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const isEditing = !!birdType;

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
    if (isSaving) return;

    if (!birdTypeName || averageWeight === "" || averageWeight <= 0) {
      showNotification(
        "Please fill all required fields with valid values.",
        "error",
      );
      return;
    }

    onSave({
      birdType: birdTypeName,
      averageWeight: Number(averageWeight),
      description,
      status,
    });
  };

  const inputClass = masterInputClass;
  const iconWrapperClass = masterIconClass;

  const fieldLabel = (text: string, required = false) => (
    <label htmlFor={fieldId(text)} className={masterLabelClass}>
      {text}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <MasterSectionHeading>{label}</MasterSectionHeading>
  );

  const title = isEditing ? "Edit Bird Type" : "Add Bird Type";
  const subtitle = isEditing ? "Update details" : "Fill in the details";

  return (
    <MasterForm
      title={title}
      subtitle={subtitle}
      icon={<Bird size={20} />}
      status={status}
      onStatusChange={setStatus}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSaving={isSaving}
      submitLabel={isEditing ? "Update Bird Type" : "Save Bird Type"}
    >
      <section className="space-y-3">
        {sectionHeading("Bird Type Details")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            {fieldLabel("Bird Type", true)}
            <div className="relative">
              <Bird className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Bird Type")}
                value={birdTypeName}
                onChange={(e) => setBirdTypeName(e.target.value)}
                placeholder="e.g., Broiler, Layer"
                className={inputClass()}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="relative">
            {fieldLabel("Average Weight (kg)", true)}
            <div className="relative">
              <Weight className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Average Weight (kg)")}
                type="number"
                step="0.01"
                min="0.01"
                value={averageWeight}
                onChange={(e) =>
                  setAverageWeight(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="e.g., 1.5"
                className={inputClass()}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="relative sm:col-span-2">
            {fieldLabel("Description")}
            <div className="relative">
              <FileText
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <textarea
                id={fieldId("Description")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                rows={2}
                className={masterTextareaClass}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>
      </section>
    </MasterForm>
  );
}

export default BirdTypeForm;
