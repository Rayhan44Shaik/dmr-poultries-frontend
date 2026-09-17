import "../../styles/masters.css";
import { Users, Briefcase } from "lucide-react";
import { countActiveFilters } from "../../../../ui";
import {
  MasterDirectoryFilters,
  MasterDirectoryField,
  MasterDirectoryCard,
} from "../../components/MasterDirectory";
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
    total,
    page: serverPage,
    exportRows,
    facets,
  } = useEmployees({
    page: currentPage,
    pageSize: pageSize,
    search,
    status: statusFilter,
    sort: sortOrder,
    department: selectedDepartment,
  });

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
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
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
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
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
        "Active" | "Inactive",
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

  const handleResetFilters = () => {
    setSearch("");
    setSelectedDepartment("");
    setStatusFilter("");
    setSortOrder("number");
    setCurrentPage(1);
  };
  const activeFilterCount = countActiveFilters(
    search.trim() !== "",
    selectedDepartment !== "",
    statusFilter !== "",
    sortOrder !== "number",
  );

  const content = (
    <div className="master-page w-full min-w-0 space-y-4 font-sans text-slate-700">
      <MasterDirectoryFilters
        ariaLabel={t("masters.dir.employees_title")}
        searchId="employees-search"
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t("masters.dir.search_employee")}
        extraActive={selectedDepartment !== ""}
        extraFilter={
          <MasterDirectoryField
            icon={Briefcase}
            iconClass="text-sky-500"
            label={t("masters.ui.department")}
          >
            <MasterDropdown
              label={t("masters.ui.department")}
              hideLabel
              value={selectedDepartment}
              placeholder={t("masters.ui.all_departments")}
              options={departments}
              onChange={handleDepartmentChange}
              allowClear
              disabled={loading}
              className="w-full"
            />
          </MasterDirectoryField>
        }
        status={statusFilter}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}
        sort={sortOrder}
        onSortChange={(value) => {
          setSortOrder(value);
          setCurrentPage(1);
        }}
        onReset={handleResetFilters}
        onRefresh={() => {
          void reload().catch(() => {});
        }}
        addLabel={t("masters.dir.add_employee")}
        onAdd={() => {
          setEditingEmployee(null);
          setShowDialog(true);
        }}
        onImport={() => setShowBulkImport(true)}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        hasRows={paginatedEmployees.length > 0}
        loading={loading}
        saving={saving}
      />

      <MasterDirectoryCard
        icon={Users}
        title={t("masters.dir.employees_title")}
        total={total}
        error={error}
        loading={loading}
        onRetry={() => {
          void reload().catch(() => undefined);
        }}
        retryLabel={t("masters.dir.retry")}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setCurrentPage(1); // a new page size invalidates the current page
        }}
      >
        <EmployeeTable
          employees={paginatedEmployees}
          onEdit={handleEditEmployee}
          onDelete={handleDeleteEmployee}
          loading={loading || deletingId !== null}
          emptyMessage={
            activeFilterCount > 0 ? t("masters.dir.no_records") : undefined
          }
        />
      </MasterDirectoryCard>

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
