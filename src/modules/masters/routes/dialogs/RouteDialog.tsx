import { useState } from "react";
import RouteForm from "../forms/RouteForm";
import type { Route } from "../types/route";

type RouteDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (route: any) => void | boolean | Promise<void | boolean>;
  route?: Route | null;
};

function RouteDialog({ open, onClose, onSave, route }: RouteDialogProps) {
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        <RouteForm
          route={route}
          onSave={handleSave}
          onCancel={onClose}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}

export default RouteDialog;
