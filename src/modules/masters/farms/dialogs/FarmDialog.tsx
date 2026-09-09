import MasterDialog from "../../components/MasterDialog";
import { useState } from "react";
import FarmForm from "../forms/FarmForm";
import type { Farm } from "../types/farm";

type FarmDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (farm: Partial<Farm>) => void | boolean | Promise<void | boolean>;
  farm?: Farm | null;
};

function FarmDialog({ open, onClose, onSave, farm }: FarmDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (formData: Partial<Farm>) => {
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
      label={farm ? "Edit Farm" : "Add Farm"}
      onClose={onClose}
      isSaving={isSaving}
    >
      <FarmForm
        key={farm?.id ?? "new"}
        farm={farm}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default FarmDialog;
