import VehicleForm from "../forms/VehicleForm";
import type { Vehicle } from "../types/vehicle";

type VehicleDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (vehicle: any) => void;
  vehicle?: Vehicle | null;
};

function VehicleDialog({ open, onClose, onSave, vehicle }: VehicleDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          {vehicle ? "Edit Vehicle" : "Add Vehicle"}
        </h2>
        <VehicleForm vehicle={vehicle} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default VehicleDialog;