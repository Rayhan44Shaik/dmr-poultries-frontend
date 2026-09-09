import MasterDialog from "../../components/MasterDialog";
// VehicleDialog.tsx
import { useState } from "react";
import VehicleForm from "../forms/VehicleForm";
import type { Vehicle } from "../types/vehicle";

type VehicleDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (vehicle: Partial<Vehicle>) => void | boolean | Promise<void | boolean>;
  vehicle?: Vehicle | null;
};

function VehicleDialog({ open, onClose, onSave, vehicle }: VehicleDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (formData: Partial<Vehicle>) => {
    setIsSaving(true);
    try {
      const result = await Promise.resolve(onSave(formData));
      if (result === false) return;
      onClose();
    } catch {
      // The page-level mutation handler retains the form and surfaces the API error.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterDialog
      label={vehicle ? "Edit Vehicle" : "Add Vehicle"}
      onClose={onClose}
      isSaving={isSaving}
      width="wide"
    >
      <VehicleForm
        key={vehicle?.id ?? "new"}
        vehicle={vehicle}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default VehicleDialog;
