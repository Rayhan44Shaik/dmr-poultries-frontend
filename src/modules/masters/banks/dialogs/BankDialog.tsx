import MasterDialog from "../../components/MasterDialog";
import { useState } from "react";
import BankForm from "../forms/BankForm";
import type { Bank } from "../types/bank";

type BankDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (bank: any) => void | boolean | Promise<void | boolean>;
  bank?: Bank | null;
};

function BankDialog({ open, onClose, onSave, bank }: BankDialogProps) {
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
      label={bank ? "Edit Bank" : "Add Bank"}
      onClose={onClose}
      isSaving={isSaving}
    >
      <BankForm
        bank={bank}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default BankDialog;
