import MasterDialog from "../../components/MasterDialog";
// src/modules/masters/employees/dialogs/EmployeeDialog.tsx
import { useState } from "react";
import EmployeeForm from "../forms/EmployeeForm";
import type { Employee } from "../types/employee";

type EmployeeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (employee: any) => void | boolean | Promise<void | boolean>;
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

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const result = await Promise.resolve(onSave(formData));
      // Keep dialog open when parent signals validation/API failure (false)
      if (result === false) return;
      onClose();
    } catch (error) {
      console.error("Save failed", error);
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
        employee={employee}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </MasterDialog>
  );
}

export default EmployeeDialog;
