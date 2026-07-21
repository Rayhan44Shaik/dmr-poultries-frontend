// src/modules/staff/pages/SalaryRegisterPage.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSalaryRegister } from '../hooks/useSalaryRegister';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { getEmployees } from '../../masters/employees/services/employeeService';
import { FileDown, Eye, Pencil, Trash2, Calendar, ChevronLeft, ChevronRight, LayoutGrid, Clock, CheckCircle, Sparkles } from 'lucide-react';
import { SalaryTable } from '../components/salary/salaryTable';
import { SalaryView } from '../components/salary/SalaryView';
import { SalaryEdit } from '../components/salary/SalaryEdit';

type SalaryRegisterPageProps = { embedded?: boolean };

function SalaryRegisterPage({ embedded = false }: SalaryRegisterPageProps) {
  const { showNotification } = useSafeNotification();

  const getCurrentYearMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [month, setMonth] = useState(getCurrentYearMonth());
  const [department, setDepartment] = useState('');
  const [selectedRecordForView, setSelectedRecordForView] = useState<any | null>(null);
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [masterEmployees, setMasterEmployees] = useState<any[]>([]);
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false);
  
  // Custom Month Picker state
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => {
    const [y] = getCurrentYearMonth().split('-');
    return Number(y);
  });

  const monthPickerRef = useRef<HTMLDivElement>(null);

  // Persist record edits and status changes in localStorage
  const [recordEdits, setRecordEdits] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('dmr_salary_register_edits');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('dmr_salary_register_edits', JSON.stringify(recordEdits));
    } catch (e) {
      console.error('Failed to save salary edits to localStorage', e);
    }
  }, [recordEdits]);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    records: hookRecords,
    filter,
    setFilter,
    loading,
    updateStatus,
    refresh,
  } = useSalaryRegister(month, department);

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSelectDropdownOpen(false);
      }
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [month, department, filter]);

  useEffect(() => {
    let isMounted = true;
    try {
      const result = getEmployees() as any;
      if (result && typeof result.then === 'function') {
        result.then((data: any) => {
          if (isMounted && Array.isArray(data)) setMasterEmployees(data);
        }).catch(() => {
          if (isMounted) setMasterEmployees([]);
        });
      } else if (Array.isArray(result)) {
        if (isMounted) setMasterEmployees(result);
      }
    } catch {
      if (isMounted) setMasterEmployees([]);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const getEmpDepartment = useCallback((emp: any): string => {
    return emp?.department || emp?.dept || emp?.departmentName || emp?.department_name || emp?.deptName || 'General';
  }, []);

  const getEmpRole = useCallback((emp: any): string => {
    return emp?.role || emp?.designation || emp?.jobTitle || 'Staff';
  }, []);

  const getEmpName = useCallback((emp: any): string => {
    return emp?.employeeName || emp?.name || emp?.fullName || emp?.firstName || 'Unnamed Employee';
  }, []);

  const getEmpId = useCallback((emp: any): number | string => {
    return emp?.id ?? emp?.employeeNo ?? emp?.empNo ?? `emp_${Math.random().toString(36).substr(2, 5)}`;
  }, []);

  const getEmpBaseSalary = useCallback((emp: any): number => {
    return Number(emp?.salary) || Number(emp?.baseSalary) || Number(emp?.grossSalary) || 0;
  }, []);

  const records = useMemo(() => {
    const existingRecords = Array.isArray(hookRecords) ? hookRecords : [];
    const employeesToSync = masterEmployees;

    const recordMap = new Map();
    existingRecords.forEach((r: any) => {
      const key = `${String(r.employeeId)}_${r.month || month}`;
      recordMap.set(key, r);
    });

    const synchronizedList = employeesToSync.map((emp) => {
      const empId = getEmpId(emp);
      const empName = getEmpName(emp);
      const empDept = getEmpDepartment(emp);
      const empRole = getEmpRole(emp);
      const baseSalary = getEmpBaseSalary(emp);
      const uniqueKey = `${String(empId)}_${month}`;

      const matchedRecord = recordMap.get(uniqueKey) || existingRecords.find((r: any) => 
        String(r.employeeId) === String(empId) && (r.month === month || !r.month)
      );

      const recordId = matchedRecord?.id || `sal_sync_${empId}_${month}`;
      const edits = recordEdits[recordId] || {};
      const hasEdits = Object.keys(edits).length > 0;

      if (matchedRecord || hasEdits) {
        const finalBase = edits.baseSalary !== undefined ? edits.baseSalary : (matchedRecord?.baseSalary || baseSalary);
        const deductions = edits.leaveDeduction !== undefined ? edits.leaveDeduction : (matchedRecord?.totalDeductions || matchedRecord?.leaveDeduction || 0);
        const penalty = edits.latePenalty !== undefined ? edits.latePenalty : (matchedRecord?.latePenalty || 0);
        const advance = edits.advanceRecovery !== undefined ? edits.advanceRecovery : (matchedRecord?.advanceRecovery || 0);
        const net = edits.netSalary !== undefined ? edits.netSalary : (finalBase - (deductions + penalty + advance));

        return {
          ...(matchedRecord || {}),
          id: recordId,
          employeeId: empId,
          employeeName: empName,
          department: empDept,
          role: empRole,
          month: month,
          baseSalary: finalBase,
          leaveDeduction: deductions,
          totalDeductions: deductions,
          latePenalty: penalty,
          advanceRecovery: advance,
          netSalary: net > 0 ? net : finalBase,
          status: edits.status || matchedRecord?.status || 'Pending',
        };
      } else {
        const defaultNet = baseSalary;
        return {
          id: recordId,
          employeeId: empId,
          employeeName: empName,
          department: empDept,
          role: empRole,
          month: month,
          baseSalary: baseSalary,
          netSalary: defaultNet,
          totalDeductions: 0,
          leaveDeduction: 0,
          latePenalty: 0,
          advanceRecovery: 0,
          workingDays: 26,
          tripsCompleted: 0,
          leavesCount: 0,
          status: 'Pending',
          sourceTripList: 'N/A',
          dutyPlannerRef: `DP-${month}`
        };
      }
    });

    return synchronizedList.filter((item: any) => {
      if (department && item.department !== department) return false;
      if (filter !== 'All' && item.status !== filter) return false;
      return true;
    });
  }, [hookRecords, masterEmployees, month, department, filter, recordEdits, getEmpDepartment, getEmpRole, getEmpName, getEmpId, getEmpBaseSalary]);

  const departments = useMemo(() => {
    const sourceList = masterEmployees.length > 0 ? masterEmployees : [];
    const depts = new Set(sourceList.map((e: any) => getEmpDepartment(e)).filter(Boolean));
    const deptArray = Array.from(depts) as string[];

    const priorityMap: Record<string, number> = {
      'supervisor': 1,
      'driver': 2,
      'helper': 3,
      'accounts': 99,
      'accountant': 99,
    };

    return deptArray.sort((a, b) => {
      const keyA = a.toLowerCase();
      const keyB = b.toLowerCase();
      const scoreA = priorityMap[keyA] ?? 50;
      const scoreB = priorityMap[keyB] ?? 50;

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return a.localeCompare(b);
    });
  }, [masterEmployees, getEmpDepartment]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, m] = monthStr.split('-');
    const date = new Date(Number(year), Number(m) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const totalNetSalary = useMemo(() => {
    return records.reduce((sum, r: any) => sum + Number(r.netSalary || 0), 0);
  }, [records]);

  const handleMarkPaid = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Payment Status',
      message: 'Mark this salary as paid?',
      onConfirm: () => {
        updateStatus(id, 'Paid');
        setRecordEdits(prev => ({
          ...prev,
          [id]: { ...(prev[id] || {}), status: 'Paid' }
        }));
        showNotification('Salary marked as paid successfully!', 'success');
        setConfirmConfig(null);
      }
    });
  };

  const handleDeleteSelected = () => {
    const selectedRecordsList = records.filter((r: any) => selectedIds.includes(r.id));
    const hasPaidRecord = selectedRecordsList.some((r: any) => r.status === 'Paid');

    if (hasPaidRecord) {
      showNotification('Cannot delete record(s) because one or more selected entries are already marked as Paid.', 'error');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Delete Salary Record',
      message: `Are you sure you want to delete ${selectedIds.length} selected salary record(s)?`,
      onConfirm: () => {
        showNotification('Salary record(s) deleted successfully.', 'success');
        setSelectedIds([]);
        refresh();
        setConfirmConfig(null);
      }
    });
  };

  const handleSaveEdit = (updatedRecord: any) => {
    setRecordEdits(prev => ({
      ...prev,
      [updatedRecord.id]: updatedRecord
    }));
    showNotification('Salary record updated successfully!', 'success');
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification('Please allow popups to export PDF', 'error');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salary Sheet - ${formatMonthName(month)}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 11px;
              background-color: #ffffff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 15px;
            }
            .company-title {
              font-size: 22px;
              font-weight: bold;
              color: #0f172a;
              margin: 0;
            }
            .sheet-subtitle {
              font-size: 14px;
              font-weight: 600;
              color: #475569;
              margin-top: 4px;
            }
            .meta-info {
              text-align: right;
              font-size: 12px;
              color: #475569;
            }
            .meta-info div {
              margin-bottom: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              color: #334155;
              font-weight: bold;
            }
            td.right, th.right {
              text-align: right;
            }
            td.center, th.center {
              text-align: center;
            }
            .footer {
              margin-top: 25px;
              font-size: 10px;
              text-align: center;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company-title">DMR Poultries</div>
              <div class="sheet-subtitle">Salary Sheet</div>
            </div>
            <div class="meta-info">
              <div>Salary Month: <strong>${formatMonthName(month)}</strong> (${month})</div>
              <div>Generated on: <strong>${new Date().toLocaleDateString()}</strong></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="center" style="width: 30px;">#</th>
                <th>Employee Name</th>
                <th>Month</th>
                <th class="right">Base Salary</th>
                <th class="right">Deduction</th>
                <th class="right">Penalty</th>
                <th class="right">Advance Given</th>
                <th class="right">Net Salary</th>
              </tr>
            </thead>
            <tbody>
              ${records.map((r: any, idx: number) => `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td>
                    <strong>${r.employeeName}</strong><br>
                    <span style="font-size: 10px; color: #64748b;">${r.role}</span>
                  </td>
                  <td>${r.month || month}</td>
                  <td class="right">${formatCurrency(r.baseSalary)}</td>
                  <td class="right" style="color: #dc2626;">${formatCurrency(r.totalDeductions || r.leaveDeduction || 0)}</td>
                  <td class="right" style="color: #d97706;">${formatCurrency(r.latePenalty || 0)}</td>
                  <td class="right" style="color: #2563eb;">${formatCurrency(r.advanceRecovery || 0)}</td>
                  <td class="right" style="color: #059669; font-weight: bold;">${formatCurrency(r.netSalary)}</td>
                </tr>
              `).join('')}
              <tr style="background-color: #f8fafc; font-weight: bold; color: #0f172a;">
                <td colspan="7" class="right" style="padding-top: 10px; padding-bottom: 10px;">Total Net Salary:</td>
                <td class="right" style="color: #059669; font-size: 12px; padding-top: 10px; padding-bottom: 10px;">${formatCurrency(totalNetSalary)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">Confidential - DMR Poultries ERP Payroll Management System</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleBulkStatusChange = (newStatus: "Pending" | "Paid") => {
    if (selectedIds.length === 0) {
      showNotification('Please select at least one record.', 'info');
      return;
    }
    
    setConfirmConfig({
      isOpen: true,
      title: 'Batch Status Update',
      message: `Mark ${selectedIds.length} selected record(s) as ${newStatus}?`,
      onConfirm: () => {
        const newEdits = { ...recordEdits };
        selectedIds.forEach(id => {
          updateStatus(id, newStatus);
          newEdits[id] = { ...(newEdits[id] || {}), status: newStatus };
        });
        setRecordEdits(newEdits);
        showNotification(`Updated status to ${newStatus} for selected records.`, 'success');
        setSelectedIds([]);
        setConfirmConfig(null);
      }
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r: any) => r.id));
    }
  };

  const selectedRecordsList = records.filter((r: any) => selectedIds.includes(r.id));
  const hasPaidSelected = selectedRecordsList.some((r: any) => r.status === 'Paid');
  const allSelectedArePaid = selectedRecordsList.length > 0 && selectedRecordsList.every((r: any) => r.status === 'Paid');

  const monthsList = [
    { name: 'Jan', value: '01' },
    { name: 'Feb', value: '02' },
    { name: 'Mar', value: '03' },
    { name: 'Apr', value: '04' },
    { name: 'May', value: '05' },
    { name: 'Jun', value: '06' },
    { name: 'Jul', value: '07' },
    { name: 'Aug', value: '08' },
    { name: 'Sep', value: '09' },
    { name: 'Oct', value: '10' },
    { name: 'Nov', value: '11' },
    { name: 'Dec', value: '12' },
  ];

  const content = (
    <div className="pt-3 px-5 space-y-4 w-full bg-gradient-to-b from-slate-50/50 to-white min-h-screen">
      <div className="bg-white rounded-2xl border border-slate-200/80 py-3 px-5 sm:py-4 sm:px-6 shadow-sm space-y-3 backdrop-blur-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Custom Modern Month & Year Picker Component */}
            <div className="relative" ref={monthPickerRef}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Month</label>
              <button
                type="button"
                onClick={() => {
                  const [y] = month.split('-');
                  if (y) setPickerYear(Number(y));
                  const willOpen = !isMonthPickerOpen;
                  setIsMonthPickerOpen(willOpen);
                  if (willOpen) {
                    setIsSelectDropdownOpen(false);
                  }
                }}
                className="h-9 px-3 w-44 sm:w-48 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-all font-medium"
              >
                <span>{formatMonthName(month)}</span>
                <Calendar size={14} className="text-blue-500" />
              </button>

              {isMonthPickerOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4">
                  {/* Year Header Navigator */}
                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setPickerYear(prev => prev - 1)}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition shadow-2xs"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-bold text-slate-800">{pickerYear}</span>
                    <button
                      type="button"
                      onClick={() => setPickerYear(prev => prev + 1)}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition shadow-2xs"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Clean 4x3 Months Grid with Click Animation */}
                  <div className="grid grid-cols-4 gap-2">
                    {monthsList.map((mObj) => {
                      const isSelected = month === `${pickerYear}-${mObj.value}`;
                      return (
                        <button
                          key={mObj.value}
                          type="button"
                          onClick={() => {
                            setMonth(`${pickerYear}-${mObj.value}`);
                            setIsMonthPickerOpen(false);
                          }}
                          className={`py-2.5 rounded-xl text-xs font-semibold transition-all transform active:scale-95 duration-100 flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                          }`}
                        >
                          {mObj.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer Quick Action */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = getCurrentYearMonth();
                        setMonth(cur);
                        const [y] = cur.split('-');
                        setPickerYear(Number(y));
                        setIsMonthPickerOpen(false);
                      }}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMonthPickerOpen(false)}
                      className="text-slate-400 hover:text-slate-600 font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 shadow-2xs hover:border-slate-300 transition-all font-medium"
              >
                <option value="">All Departments ({masterEmployees.length} Total Employees)</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Modern Segmented Pill Status Control */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <div className="inline-flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs h-9 items-center">
                <button
                  type="button"
                  onClick={() => setFilter('All')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all transform active:scale-95 duration-150 ${
                    filter === 'All'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid size={12} className={filter === 'All' ? 'text-blue-600' : 'text-slate-400'} />
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('Pending')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all transform active:scale-95 duration-150 ${
                    filter === 'Pending'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={12} className={filter === 'Pending' ? 'text-blue-600' : 'text-slate-400'} />
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('Paid')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all transform active:scale-95 duration-150 ${
                    filter === 'Paid'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle size={12} className={filter === 'Paid' ? 'text-blue-600' : 'text-slate-400'} />
                  Paid
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons wrapped with an alignment spacer label */}
          <div>
            <div className="block text-xs font-semibold text-transparent uppercase tracking-wider mb-1 select-none pointer-events-none" aria-hidden="true">Action</div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5 mr-1 animate-in fade-in duration-150">
                  {selectedIds.length === 1 && !hasPaidSelected && (
                    <button
                      type="button"
                      onClick={() => {
                        const rec = records.find((r: any) => r.id === selectedIds[0]);
                        if (rec) setSelectedRecordForEdit(rec);
                      }}
                      className="h-9 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1 shadow-2xs"
                      title="Edit Selected Record"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}

                  {!hasPaidSelected && (
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="h-9 px-3 rounded-xl border border-rose-200/80 bg-rose-50/80 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition flex items-center gap-1 shadow-2xs"
                      title="Delete Selected Record"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}

                  {selectedIds.length === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const rec = records.find((r: any) => r.id === selectedIds[0]);
                        if (rec) setSelectedRecordForView(rec);
                      }}
                      className="h-9 px-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition flex items-center gap-1 shadow-2xs"
                      title="View Selected Record"
                    >
                      <Eye size={13} /> View
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleExportPDF}
                className="h-9 px-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition flex items-center gap-1.5 shadow-2xs group"
              >
                <FileDown size={14} className="group-hover:translate-y-0.5 transition-transform" /> Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 py-2 px-5 rounded-xl border border-slate-200/60 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-100/70 rounded-md text-blue-600">
              <Sparkles size={14} />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Net Salary for {formatMonthName(month)}:</span>
            <span className="text-xs font-extrabold text-emerald-600">{formatCurrency(totalNetSalary)}</span>
            {selectedIds.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full shadow-2xs">
                {selectedIds.length} selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Batch Action:</span>
              {!allSelectedArePaid && (
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange('Paid')}
                  className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                >
                  Mark Paid
                </button>
              )}
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Pending')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                Mark Pending
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs font-medium hover:bg-slate-200/50 rounded-lg transition"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center space-y-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Syncing master employee records...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center text-slate-500 shadow-sm text-xs">
          No employee records found matching current filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <SalaryTable
            records={records}
            selectedIds={selectedIds}
            toggleSelectOne={toggleSelectOne}
            toggleSelectAll={toggleSelectAll}
            isSelectDropdownOpen={isSelectDropdownOpen}
            setIsSelectDropdownOpen={(val: boolean | ((prev: boolean) => boolean)) => {
              const nextVal = typeof val === 'function' ? val(isSelectDropdownOpen) : val;
              setIsSelectDropdownOpen(nextVal);
              if (nextVal) {
                setIsMonthPickerOpen(false);
              }
            }}
            dropdownRef={dropdownRef}
            formatCurrency={formatCurrency}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            currentMonth={month}
            onClearSelection={() => setSelectedIds([])}
          />
        </div>
      )}

      {selectedRecordForView && (
        <SalaryView
          record={selectedRecordForView}
          month={month}
          onClose={() => setSelectedRecordForView(null)}
          onMarkPaid={handleMarkPaid}
          formatCurrency={formatCurrency}
        />
      )}

      {selectedRecordForEdit && (
        <SalaryEdit
          record={selectedRecordForEdit}
          isOpen={!!selectedRecordForEdit}
          onClose={() => setSelectedRecordForEdit(null)}
          onSave={handleSaveEdit}
          formatCurrency={formatCurrency}
        />
      )}

      {confirmConfig?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800">{confirmConfig.title}</h3>
            <p className="text-xs text-slate-600">{confirmConfig.message}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmConfig.onConfirm}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return content;
}

export default SalaryRegisterPage;