import FarmForm from "../forms/FarmForm";
import type { Farm } from "../types/farm";

type FarmDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (farm: any) => void;
  farm?: Farm | null;
};

function FarmDialog({ open, onClose, onSave, farm }: FarmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          {farm ? "Edit Farm" : "Add Farm"}
        </h2>
        <FarmForm farm={farm} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default FarmDialog;