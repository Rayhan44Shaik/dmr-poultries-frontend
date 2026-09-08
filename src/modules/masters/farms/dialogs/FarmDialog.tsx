import MasterDialog from "../../components/MasterDialog";
import { useState } from "react";
import FarmForm from "../forms/FarmForm";
import type { Farm } from "../types/farm";

type FarmDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (farm: any) => void | boolean | Promise<void | boolean>;
  farm?: Farm | null;
};

function FarmDialog({ open, onClose, onSave, farm }: FarmDialogProps) {
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
      label={farm ? "Edit Farm" : "Add Farm"}
      onClose={onClose}
      isSaving={isSaving}
    >
      <FarmForm
        farm={farm}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default FarmDialog;
