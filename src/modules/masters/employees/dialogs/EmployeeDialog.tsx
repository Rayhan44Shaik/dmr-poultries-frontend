import MasterDialog from "../../components/MasterDialog";
// src/modules/masters/employees/dialogs/EmployeeDialog.tsx
import { useState } from "react";
import EmployeeForm from "../forms/EmployeeForm";
import type { Employee } from "../types/employee";

type EmployeeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (employee: Partial<Employee>) => void | boolean | Promise<void | boolean>;
  employee?: Employee | null;
};

function EmployeeDialog({
  open,
  onClose,
  onSave,
  employee,
}: EmployeeDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (formData: Partial<Employee>) => {
    setIsSaving(true);
    try {
      const result = await Promise.resolve(onSave(formData));
      // Keep dialog open when parent signals validation/API failure (false)
      if (result === false) return;
      onClose();
    } catch {
      // The page-level mutation handler retains the form and surfaces the API error.
      // Keep dialog open so the user can fix and retry
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterDialog
      label={employee ? "Edit Employee" : "Add Employee"}
      onClose={onClose}
      isSaving={isSaving}
    >
      <EmployeeForm
        key={employee?.id ?? "new"}
        employee={employee}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default EmployeeDialog;
