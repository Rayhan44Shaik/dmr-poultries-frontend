// src/modules/staff/components/leave/LeaveRequestForm.tsx

import { memo, useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown, User, Briefcase, FileText, Layers, Hash, Search } from 'lucide-react';
import { useSafeNotification } from '../../../../hooks/useSafeNotification';
import { DatePicker } from '../../../../components/common/DatePicker';
import { getEmployees } from '../../../masters/employees/services/employeeService';
import type { Employee } from '../../../masters/employees/types/employee';

interface LeaveRequestFormProps {
  employees?: Employee[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

/** Compact custom dropdown with max 5 visible items + scroll. */
function FormDropdown({
  label,
  icon,
  value,
  options,
  searchable,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  searchable?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const displayLabel = options.find((o) => o.value === value)?.label || label;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-slate-50/50 hover:bg-slate-50 transition text-left flex items-center justify-between text-slate-700 font-medium"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={16} className="text-slate-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          {searchable && options.length > 5 && (
            <div className="p-1.5 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full h-8 pl-7 pr-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 text-slate-700 placeholder-slate-400"
                />
              </div>
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition ${
                    value === o.value
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveRequestForm({ employees: propEmployees, onSubmit, onCancel }: LeaveRequestFormProps) {
  const { showNotification } = useSafeNotification();

  // Fallback to service if props are empty
  const employees: any[] = propEmployees && propEmployees.length > 0 ? propEmployees : getEmployees();

  const getEmpDepartment = (emp: any): string => {
    return emp?.department || emp?.dept || emp?.departmentName || 'General';
  };

  const getEmpName = (emp: any): string => {
    return emp?.employeeName || emp?.name || emp?.fullName || emp?.firstName || 'Unnamed Employee';
  };

  const getEmpId = (emp: any): number | string => {
    return emp?.id ?? emp?.employeeId ?? emp?.employeeNo ?? 0;
  };

  const uniqueDepartments = Array.from(
    new Set(employees.map((emp) => getEmpDepartment(emp)))
  ).filter(Boolean) as string[];

  const initialDept = uniqueDepartments[0] || 'General';
  
  const initialDepartmentEmployees = employees.filter(
    (emp) => getEmpDepartment(emp) === initialDept
  );
  const initialEmp = initialDepartmentEmployees.length > 0 ? initialDepartmentEmployees[0] : (employees[0] || null);

  const [selectedDepartment, setSelectedDepartment] = useState<string>(initialDept);
  
  const [form, setForm] = useState({
    employeeId: initialEmp ? getEmpId(initialEmp) : 0,
    employeeName: initialEmp ? getEmpName(initialEmp) : '',
    department: initialDept,
    type: 'Casual' as const,
    fromDate: '',
    toDate: '',
    days: 0,
    reason: '',
  });

  const [employeeSearch, setEmployeeSearch] = useState(initialEmp ? getEmpName(initialEmp) : '');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  const departmentFilteredEmployees = employees.filter(
    (emp) => getEmpDepartment(emp) === selectedDepartment
  );

  const filteredEmployees = departmentFilteredEmployees.filter((emp) =>
    getEmpName(emp).toLowerCase().includes(employeeSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (form.fromDate && form.toDate) {
      const from = new Date(form.fromDate + 'T00:00:00');
      const to = new Date(form.toDate + 'T00:00:00');
      const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setForm((prev) => ({ ...prev, days: diff > 0 ? diff : 0 }));
    } else {
      setForm((prev) => ({ ...prev, days: 0 }));
    }
  }, [form.fromDate, form.toDate]);

  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    
    const matchingEmployees = employees.filter((emp) => getEmpDepartment(emp) === dept);
    const firstMatch = matchingEmployees.length > 0 ? matchingEmployees[0] : null;
    
    const newEmpId = firstMatch ? getEmpId(firstMatch) : 0;
    const newEmpName = firstMatch ? getEmpName(firstMatch) : '';

    setForm((prev) => ({
      ...prev,
      department: dept,
      employeeId: newEmpId,
      employeeName: newEmpName,
    }));
    setEmployeeSearch(newEmpName);
    setIsEmployeeDropdownOpen(false);
  };

  const handleFromDateChange = (date: string) => {
    setForm((prev) => {
      let updatedTo = prev.toDate;
      if (date && prev.toDate && date > prev.toDate) {
        updatedTo = '';
      }
      return { ...prev, fromDate: date, toDate: updatedTo };
    });
  };

  const handleToDateChange = (date: string) => {
    if (form.fromDate && date && date < form.fromDate) {
      showNotification('To date cannot be earlier than from date.', 'error');
      return;
    }
    setForm((prev) => ({ ...prev, toDate: date }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fromDate || !form.toDate) {
      showNotification('Please select both from and to dates.', 'error');
      return;
    }
    if (form.days <= 0 || form.toDate < form.fromDate) {
      showNotification('Invalid date range. To date cannot be earlier than from date.', 'error');
      return;
    }
    if (!form.employeeId) {
      showNotification('Please select a valid employee.', 'error');
      return;
    }
    onSubmit(form);
  };

  const departmentOptions = uniqueDepartments.map((d) => ({ value: d, label: d }));
  const leaveTypeOptions = [
    { value: 'Casual', label: 'Casual Leave' },
    { value: 'Sick', label: 'Sick Leave' },
    { value: 'Emergency', label: 'Emergency Leave' },
    { value: 'Annual', label: 'Annual Leave' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5 transition-all">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/60 shadow-2xs">
            <Plus size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">New Leave Request</h3>
            <p className="text-xs text-slate-500">Select department first to load respective staff members</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Line 1 - Department */}
        <FormDropdown
          label="Department"
          icon={<Briefcase size={13} className="text-blue-500" />}
          value={selectedDepartment}
          options={departmentOptions}
          searchable
          onChange={handleDepartmentChange}
        />

        {/* Line 1 - Employee */}
        <div className="relative" ref={employeeDropdownRef}>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <User size={13} className="text-blue-500" /> Respective Employee
          </label>
          <div className="relative">
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                setIsEmployeeDropdownOpen(true);
              }}
              onFocus={() => {
                setEmployeeSearch('');
                setIsEmployeeDropdownOpen(true);
              }}
              onBlur={() => {
                if (!employeeSearch) {
                  setEmployeeSearch(form.employeeName);
                }
              }}
              placeholder={`Search in ${selectedDepartment}...`}
              className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-slate-50 transition text-slate-700 font-medium"
            />
            <button
              type="button"
              onClick={() => {
                setEmployeeSearch('');
                setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {isEmployeeDropdownOpen && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-[200px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl text-slate-700">
              {(employeeSearch === '' ? departmentFilteredEmployees : filteredEmployees).length > 0 ? (
                (employeeSearch === '' ? departmentFilteredEmployees : filteredEmployees).map((emp) => {
                  const empName = getEmpName(emp);
                  const empId = getEmpId(emp);
                  return (
                    <button
                      key={empId}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, employeeId: empId, employeeName: empName }));
                        setEmployeeSearch(empName);
                        setIsEmployeeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg hover:bg-blue-50 hover:text-blue-700 transition flex items-center justify-between ${
                        form.employeeId === empId ? 'bg-blue-50 font-bold text-blue-700' : ''
                      }`}
                    >
                      <span>{empName}</span>
                      <span className="text-[10px] text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded-md">
                        ID: {empId}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-xs text-slate-400 text-center">
                  No employees found in &quot;{selectedDepartment}&quot;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line 2 - From Date */}
        <div>
          <DatePicker
            label="From Date"
            value={form.fromDate}
            onChange={handleFromDateChange}
            required
            className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:bg-slate-50/50"
          />
        </div>

        {/* Line 2 - To Date */}
        <div>
          <DatePicker
            label="To Date"
            value={form.toDate}
            onChange={handleToDateChange}
            required
            className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:bg-slate-50/50"
          />
        </div>

        {/* Line 3 - Leave Type */}
        <FormDropdown
          label="Leave Type"
          icon={<Layers size={13} className="text-blue-500" />}
          value={form.type}
          options={leaveTypeOptions}
          onChange={(val) => setForm((prev) => ({ ...prev, type: val as any }))}
        />

        {/* Line 3 - Days Counter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Hash size={13} className="text-blue-500" /> Calculated Days
          </label>
          <div className="relative">
            <input
              type="number"
              value={form.days}
              readOnly
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-blue-50/40 text-blue-900 font-bold cursor-not-allowed"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600">
              Days
            </span>
          </div>
        </div>

        {/* Line 4: Reason */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <FileText size={13} className="text-blue-500" /> Reason (Optional)
          </label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            rows={2.5}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-slate-50 transition text-slate-700 placeholder-slate-400 font-medium resize-none"
            placeholder="Provide a brief explanation for your leave request..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
        >
          <Plus size={15} />
          Submit Request
        </button>
      </div>
    </form>
  );
}

export default memo(LeaveRequestForm);
