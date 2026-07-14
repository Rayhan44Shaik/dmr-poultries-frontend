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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          {bank ? "Edit Bank" : "Add Bank"}
        </h2>
        <BankForm bank={bank} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default BankDialog;