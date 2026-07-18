import BirdTypeForm from "../forms/BirdTypeForm";
import type { BirdType } from "../types/birdType";

type BirdTypeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (birdType: any) => void;
  birdType?: BirdType | null;
};

function BirdTypeDialog({ open, onClose, onSave, birdType }: BirdTypeDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      {/* Increased width to max-w-4xl – same as other dialogs */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        {/* No duplicate title – BirdTypeForm provides its own header */}
        <BirdTypeForm birdType={birdType} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default BirdTypeDialog;