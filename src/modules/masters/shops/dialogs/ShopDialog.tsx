import MasterDialog from "../../components/MasterDialog";
import { useState } from "react";
import type { Shop } from "../types/shop";
import ShopForm from "../forms/ShopForm";

type ShopDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (shop: any) => void | boolean | Promise<void | boolean>;
  shop?: Shop | null;
};

function ShopDialog({ open, onClose, onSave, shop }: ShopDialogProps) {
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
      label={shop ? "Edit Shop" : "Add Shop"}
      onClose={onClose}
      isSaving={isSaving}
      width="wide"
    >
      <ShopForm
        shop={shop}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default ShopDialog;
