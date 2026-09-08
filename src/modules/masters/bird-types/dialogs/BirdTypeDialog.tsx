import MasterDialog from "../../components/MasterDialog";
import { useState } from "react";
import BirdTypeForm from "../forms/BirdTypeForm";
import type { BirdType } from "../types/birdType";

type BirdTypeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (birdType: any) => void | boolean | Promise<void | boolean>;
  birdType?: BirdType | null;
};

function BirdTypeDialog({
  open,
  onClose,
  onSave,
  birdType,
}: BirdTypeDialogProps) {
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
      label={birdType ? "Edit Bird Type" : "Add Bird Type"}
      onClose={onClose}
      isSaving={isSaving}
    >
      <BirdTypeForm
        birdType={birdType}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default BirdTypeDialog;
