import MasterListToolbar from "../../components/MasterListToolbar";
import MasterListSummary from "../../components/MasterListSummary";
import MasterPagination from "../../components/MasterPagination";
import "../../styles/masters.css";
import MasterDropdown from "../../components/MasterDropdown";
import { useI18n } from "../../../../i18n";
// src/modules/masters/employees/pages/EmployeesPage.tsx
import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeDialog from "../dialogs/EmployeeDialog";
import { useEmployees } from "../hooks/useEmployees";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/employeeService";
import type { Employee } from "../types/employee";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildEmployeeBulkImportConfig } from "../bulkImportConfig";

type EmployeesPageProps = { embedded?: boolean };

const DEFAULT_PAGE_SIZE = 10;

function EmployeesPage({ embedded = false }: EmployeesPageProps) {
  const { t } = useI18n();
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("number");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const {
    employees,
    loading,
    saving,
    error,
    reload,
    addEmployee,
    addEmployeesBulk,
    editEmployee,
    removeEmployee,
    total, page: serverPage, exportRows, facets,
  } = useEmployees({ page: currentPage, pageSize: pageSize, search, status: statusFilter, sort: sortOrder, department: selectedDepartment });

  const employeeBulkImportConfig = useMemo(
    () => buildEmployeeBulkImportConfig({ addEmployeesBulk, reload }),
    [addEmployeesBulk, reload],
  );

  // Get unique departments for filter dropdown
  const departments = facets.department ?? [];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = serverPage;
  const paginatedEmployees = employees;

  const handleExportPDF = async () => {
    try {
      const filteredEmployees = await exportRows();

    if (filteredEmployees.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Emp No",
      "Employee Name",
      "Department",
      "Role",
      "Phone",
      "Salary",
      "Status",
    ];
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
    logAuditEvent("EXPORT_PDF", "Employees", undefined, {
      count: filteredEmployees.length,
    });
    showNotification("PDF exported successfully!", "success");
  
    } catch (err) { showNotification(handleApiError(err), "error"); }
  };

  const handleExportExcel = async () => {
    try {
      const filteredEmployees = await exportRows();

    if (filteredEmployees.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Emp No",
      "Employee Name",
      "Department",
      "Role",
      "Phone",
      "Salary",
      "Status",
    ];
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
    logAuditEvent("EXPORT_EXCEL", "Employees", undefined, {
      count: filteredEmployees.length,
    });
    showNotification("Excel exported successfully!", "success");
  
    } catch (err) { showNotification(handleApiError(err), "error"); }
  };

  const validateEmployee = (employee: Partial<Employee>): string | null => {
    const name = employee.employeeName?.trim() ?? "";
    const department = employee.department?.trim() ?? "";
    const phone = employee.phoneNumber?.trim() ?? "";
    const email = employee.email?.trim() ?? "";
    const salary = Number(employee.salary);

    if (
      !name ||
      !department ||
      !phone ||
      employee.salary === undefined ||
      employee.salary === null
    ) {
      return "Please fill all required fields (marked with *).";
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      return "Mobile Number must be exactly 10 digits.";
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address.";
    }
    if (Number.isNaN(salary) || salary < 0) {
      return "Salary must be a positive number.";
    }
    if (
      (department === "Driver" || department === "Collection") &&
      !employee.licenseNumber?.trim()
    ) {
      return "License Number is required for Driver and Collection departments.";
    }
    if (
      employee.aadharNumber &&
      !/^[0-9]{12}$/.test(employee.aadharNumber.replace(/\s/g, ""))
    ) {
      return "Aadhar Number must be exactly 12 digits.";
    }

    const duplicateName = employees.some(
      (e) =>
        e.department === department &&
        e.employeeName.trim().toLowerCase() === name.toLowerCase() &&
        e.id !== editingEmployee?.id,
    );
    if (duplicateName) {
      return `An employee with the name "${name}" already exists in the ${department} department.`;
    }

    const duplicatePhone = employees.some(
      (e) => e.phoneNumber === phone && e.id !== editingEmployee?.id,
    );
    if (duplicatePhone) {
      return "Phone Number already exists.";
    }

    if (email) {
      const duplicateEmail = employees.some(
        (e) =>
          e.email.trim().toLowerCase() === email.toLowerCase() &&
          e.id !== editingEmployee?.id,
      );
      if (duplicateEmail) {
        return "Email already exists.";
      }
    }

    return null;
  };

  const handleSaveEmployee = async (
    employee: Partial<Employee>,
  ): Promise<boolean> => {
    const validationError = validateEmployee(employee);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    const payload = {
      employeeName: employee.employeeName!.trim(),
      department: employee.department!,
      role: employee.role?.trim() ?? "",
      phoneNumber: employee.phoneNumber!.trim(),
      email: employee.email?.trim() ?? "",
      address: employee.address?.trim() ?? "",
      joiningDate: employee.joiningDate ?? "",
      aadharNumber: employee.aadharNumber?.replace(/\s/g, "") || undefined,
      licenseNumber: employee.licenseNumber?.trim() || undefined,
      salary: Number(employee.salary),
      status: (employee.status === "Inactive" ? "Inactive" : "Active") as
        | "Active"
        | "Inactive",
    };

    try {
      if (editingEmployee) {
        // PUT must send the complete employee object, including id + employeeNo.
        await editEmployee(editingEmployee.id, {
          ...payload,
          id: editingEmployee.id,
          employeeNo: editingEmployee.employeeNo,
        });
        logAuditEvent("UPDATE_EMPLOYEE", "Employees", editingEmployee.id);
        showNotification("Employee updated successfully!", "success");
      } else {
        const created = await addEmployee(payload);
        const newId = created.find(
          (e) =>
            e.employeeName === payload.employeeName &&
            e.phoneNumber === payload.phoneNumber,
        )?.id;
        logAuditEvent("CREATE_EMPLOYEE", "Employees", newId);
        showNotification("Employee added successfully!", "success");
      }
      setEditingEmployee(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowDialog(true);
  };

  const handleDeleteEmployee = async (id: number) => {
    setDeletingId(id);
    try {
      await removeEmployee(id);
      logAuditEvent("DELETE_EMPLOYEE", "Employees", id);
      showNotification("Employee deleted successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const content = (
    <div className="master-page w-full min-w-0 space-y-3 font-sans text-slate-700">
      {/* Main Container - Removed overflow-hidden so dropdowns overlay properly */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm">
        {/* Toolbar */}
        <MasterListToolbar
          onRefresh={() => { void reload().catch(() => {}); }}
          status={statusFilter}
          onStatusChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
          sort={sortOrder}
          onSortChange={(value) => { setSortOrder(value); setCurrentPage(1); }}
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search Employee..."
          addLabel="Add Employee"
          onAdd={() => {
            setEditingEmployee(null);
            setShowDialog(true);
          }}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          loading={loading}
          saving={saving}
          onImport={() => setShowBulkImport(true)}
        >
          <MasterDropdown
            label={t("masters.ui.department")}
            value={selectedDepartment}
            placeholder={t("masters.ui.all_departments")}
            options={departments}
            onChange={handleDepartmentChange}
            allowClear
            disabled={loading}
            className="w-full sm:w-56"
          />
        </MasterListToolbar>

        {/* Status Counter */}
        <MasterListSummary
          title="Employees Directory"
          total={total}
          shown={paginatedEmployees.length}
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          saving={saving}
          deleting={deletingId !== null}
        />

        {error && !loading && (
          <div className="mx-4 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                void reload().catch(() => undefined);
              }}
              className="shrink-0 text-xs font-semibold text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="p-0 relative min-h-[120px]">
          {loading && employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm font-medium">Loading employees...</p>
            </div>
          ) : !loading && employees.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">
                No employees found.
              </p>
              <p className="text-xs text-slate-500">
                Add an employee to get started.
              </p>
            </div>
          ) : (
            <EmployeeTable
              employees={paginatedEmployees}
              onEdit={handleEditEmployee}
              onDelete={handleDeleteEmployee}
              emptyMessage={
                search.trim() || selectedDepartment
                  ? "No employees matching your filters."
                  : undefined
              }
            />
          )}
        </div>

        {shouldShowPagination(total) && (
          <MasterPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1); // a new page size invalidates the current page
            }}
          />
        )}
      </div>

      <EmployeeDialog
        open={showDialog}
        onClose={() => {
          setEditingEmployee(null);
          setShowDialog(false);
        }}
        onSave={handleSaveEmployee}
        employee={editingEmployee}
      />
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        config={employeeBulkImportConfig}
        existing={employees}
        onImported={(result) => {
          logAuditEvent("BULK_IMPORT", "Employees", undefined, {
            count: result.imported,
          });
          showNotification(
            `Imported ${result.imported} of ${result.total} employees.`,
            result.failed === 0 ? "success" : "error",
          );
        }}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(EmployeesPage);
