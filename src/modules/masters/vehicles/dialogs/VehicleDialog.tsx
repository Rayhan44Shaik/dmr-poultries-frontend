import MasterDialog from "../../components/MasterDialog";
// VehicleDialog.tsx
import { useState } from "react";
import VehicleForm from "../forms/VehicleForm";
import type { Vehicle } from "../types/vehicle";

type VehicleDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (vehicle: any) => void | boolean | Promise<void | boolean>;
  vehicle?: Vehicle | null;
};

function VehicleDialog({ open, onClose, onSave, vehicle }: VehicleDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const result = await Promise.resolve(onSave(formData));
      if (result === false) return;
      onClose();
    } catch (error) {
      console.error("Save failed", error);
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
        vehicle={vehicle}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default VehicleDialog;
