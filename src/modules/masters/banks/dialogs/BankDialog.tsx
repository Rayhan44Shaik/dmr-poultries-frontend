import MasterDialog from "../../components/MasterDialog";
import { useState } from "react";
import BankForm from "../forms/BankForm";
import type { Bank } from "../types/bank";

type BankDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (bank: Partial<Bank>) => void | boolean | Promise<void | boolean>;
  bank?: Bank | null;
};

function BankDialog({ open, onClose, onSave, bank }: BankDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (formData: Partial<Bank>) => {
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
      label={bank ? "Edit Bank" : "Add Bank"}
      onClose={onClose}
      isSaving={isSaving}
    >
      <BankForm
        key={bank?.id ?? "new"}
        bank={bank}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default BankDialog;
