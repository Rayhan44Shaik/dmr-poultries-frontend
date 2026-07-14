import type { Shop } from "../types/shop";
import ShopForm from "../forms/ShopForm";

type ShopDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (shop: any) => void;
  shop?: Shop | null;
};

function ShopDialog({ open, onClose, onSave, shop }: ShopDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          {shop ? "Edit Shop" : "Add Shop"}
        </h2>
        <ShopForm shop={shop} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default ShopDialog;