// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\employees\pages\EmployeesPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeDialog from "../dialogs/EmployeeDialog";
import { useEmployees } from "../hooks/useEmployees";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";

type EmployeesPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function EmployeesPage({ embedded = false }: EmployeesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { showNotification } = useSafeNotification();
  const { employees, saveEmployees } = useEmployees();

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredEmployees = useMemo(() => {
    const keyword = search.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.employeeName.toLowerCase().includes(keyword) ||
        emp.department.toLowerCase().includes(keyword) ||
        emp.role.toLowerCase().includes(keyword) ||
        emp.phoneNumber.includes(keyword) ||
        emp.email.toLowerCase().includes(keyword)
    );
  }, [employees, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE) || 1;
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

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
    logAuditEvent("EXPORT_PDF", "Employees", undefined, { count: filteredEmployees.length });
    showNotification("PDF exported successfully!", "success");
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
    logAuditEvent("EXPORT_EXCEL", "Employees", undefined, { count: filteredEmployees.length });
    showNotification("Excel exported successfully!", "success");
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
      logAuditEvent("UPDATE_EMPLOYEE", "Employees", editingEmployee.id);
      showNotification("Employee updated successfully!", "success");
    } else {
      const newEmployee = {
        id: Date.now(),
        employeeNo: employees.length + 1,
        ...employee,
      };
      saveEmployees([...employees, newEmployee]);
      logAuditEvent("CREATE_EMPLOYEE", "Employees", newEmployee.id);
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
    logAuditEvent("DELETE_EMPLOYEE", "Employees", id);
    showNotification("Employee deleted successfully!", "success");
  };

  const content = (
    <div className="w-full space-y-2 employee-page-container">
      <style>{`
        .employee-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .employee-page-container button:hover,
        [role="dialog"] button:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* Main Container */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Toolbar - Search on LEFT, Buttons on RIGHT in same line */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar - Left Side */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Employee..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Action Buttons - Right Side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                PDF
              </button>
              
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Excel
              </button>
              
              <button
                onClick={() => {
                  setEditingEmployee(null);
                  setShowDialog(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Employee
              </button>
            </div>
          </div>
        </div>

        {/* Status Counter Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              Employees Directory
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {filteredEmployees.length} records
            </span>
          </div>
          <p className="text-slate-500 font-medium">
            Showing {paginatedEmployees.length} of {filteredEmployees.length} Employees (Page {currentPage} of {totalPages})
          </p>
        </div>

        {/* Table Content */}
        <div className="p-0">
          <EmployeeTable
            employees={paginatedEmployees}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteEmployee}
          />
        </div>

        {/* Pagination Controls - Bottom Right Aligned */}
        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center ${
                  currentPage === pageNum
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal Dialog */}
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
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(EmployeesPage);