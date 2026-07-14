import EmployeeForm from "../forms/EmployeeForm";
import type { Employee } from "../types/employee";

type EmployeeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (employee: any) => void;
  employee?: Employee | null;
};

function EmployeeDialog({ open, onClose, onSave, employee }: EmployeeDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          {employee ? "Edit Employee" : "Add Employee"}
        </h2>
        <EmployeeForm employee={employee} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default EmployeeDialog;