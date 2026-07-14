import React, { useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import EmployeeToolbar from "../components/EmployeeToolbar";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeDialog from "../dialogs/EmployeeDialog";
import { useEmployees } from "../hooks/useEmployees";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type EmployeesPageProps = { embedded?: boolean };

function EmployeesPage({ embedded = false }: EmployeesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { showNotification } = useSafeNotification();
  const { employees, saveEmployees } = useEmployees();

  const filteredEmployees = employees.filter((emp) => {
    const keyword = search.toLowerCase();
    return (
      emp.employeeName.toLowerCase().includes(keyword) ||
      emp.department.toLowerCase().includes(keyword) ||
      emp.role.toLowerCase().includes(keyword) ||
      emp.phoneNumber.includes(keyword) ||
      emp.email.toLowerCase().includes(keyword)
    );
  });

  const handleExportPDF = () => {
    if (filteredEmployees.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Emp No", "Employee Name", "Department", "Role", "Phone", "Salary", "Status"];
    const rows = filteredEmployees.map((emp) => [
      emp.employeeNo.toString(),
      emp.employeeName,
      emp.department,
      emp.role,
      emp.phoneNumber,
      emp.salary?.toString() || "0",
      emp.status,
    ]);
    const filename = `Employees_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Employees - Master List", headers, rows, filename);
  };

  const handleExportExcel = () => {
    if (filteredEmployees.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Emp No", "Employee Name", "Department", "Role", "Phone", "Salary", "Status"];
    const rows = filteredEmployees.map((emp) => [
      emp.employeeNo.toString(),
      emp.employeeName,
      emp.department,
      emp.role,
      emp.phoneNumber,
      emp.salary?.toString() || "0",
      emp.status,
    ]);
    const filename = `Employees_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Employees - Master List", headers, rows, filename);
  };

  const handleSaveEmployee = (employee: any) => {
    const duplicate = employees.some(
      (e) =>
        e.employeeName.trim().toLowerCase() === employee.employeeName.trim().toLowerCase() &&
        e.id !== editingEmployee?.id
    );
    if (duplicate) {
      showNotification("Employee Name already exists.", "error");
      return;
    }

    const duplicatePhone = employees.some(
      (e) =>
        e.phoneNumber === employee.phoneNumber &&
        e.id !== editingEmployee?.id
    );
    if (duplicatePhone) {
      showNotification("Phone Number already exists.", "error");
      return;
    }

    const duplicateEmail = employees.some(
      (e) =>
        e.email.trim().toLowerCase() === employee.email.trim().toLowerCase() &&
        e.id !== editingEmployee?.id
    );
    if (duplicateEmail) {
      showNotification("Email already exists.", "error");
      return;
    }

    if (editingEmployee) {
      saveEmployees(
        employees.map((e) =>
          e.id === editingEmployee.id ? { ...e, ...employee } : e
        )
      );
      showNotification("Employee updated successfully!", "success");
    } else {
      const newEmployee = {
        id: Date.now(),
        employeeNo: employees.length + 1,
        ...employee,
      };
      saveEmployees([...employees, newEmployee]);
      showNotification("Employee added successfully!", "success");
    }

    setEditingEmployee(null);
    setShowDialog(false);
  };

  const handleEditEmployee = (employee: any) => {
    setEditingEmployee(employee);
    setShowDialog(true);
  };

  const handleDeleteEmployee = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    saveEmployees(employees.filter((e) => e.id !== id));
    showNotification("Employee deleted successfully!", "success");
  };

  const content = (
    <div className="space-y-6 pt-6">
      <EmployeeToolbar
        search={search}
        onSearchChange={setSearch}
        onAddEmployee={() => {
          setEditingEmployee(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
      <p className="text-sm text-slate-500">
        Showing {filteredEmployees.length} of {employees.length} Employees
      </p>
      <EmployeeTable
        employees={filteredEmployees}
        onEdit={handleEditEmployee}
        onDelete={handleDeleteEmployee}
      />
      <EmployeeDialog
        open={showDialog}
        onClose={() => {
          setEditingEmployee(null);
          setShowDialog(false);
        }}
        onSave={handleSaveEmployee}
        employee={editingEmployee}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {content}
      </div>
    </DashboardLayout>
  );
}

export default React.memo(EmployeesPage);