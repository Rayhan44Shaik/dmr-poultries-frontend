import BankForm from "../forms/BankForm";
import type { Bank } from "../types/bank";

type BankDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (bank: any) => void;
  bank?: Bank | null;
};

function BankDialog({ open, onClose, onSave, bank }: BankDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      {/* Increased width to max-w-4xl – same as other forms */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        {/* No duplicate title – BankForm provides its own header */}
        <BankForm bank={bank} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default BankDialog;