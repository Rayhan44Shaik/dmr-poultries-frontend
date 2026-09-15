// src/modules/staff/components/leave/LeaveRequestForm.tsx

import { memo, useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown, User, Briefcase, FileText, Layers, Hash, Search } from 'lucide-react';
import { useSafeNotification } from '../../../../hooks/useSafeNotification';
import { DatePicker } from '../../../../components/common/DatePicker';
import type { Employee } from '../../../masters/employees/types/employee';
import { useI18n } from '../../../../i18n';
import { leaveTypeLabel } from '../../utils/leaveDisplay';

export interface LeaveRequestInput {
  employeeId: number;
  type: 'Casual' | 'Sick' | 'Emergency' | 'Annual';
  fromDate: string;
  toDate: string;
  reason?: string;
}
interface LeaveRequestFormProps {
  employees?: Employee[];
  onSubmit: (data: LeaveRequestInput) => Promise<void | boolean> | void;
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
  const { t } = useI18n();
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
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
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
                  placeholder={t('staff.leave.form_search_placeholder')}
                  aria-label={t('staff.leave.form_search_aria', { label })}
                  autoFocus
                  className="w-full h-8 pl-7 pr-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 text-slate-700 placeholder-slate-400"
                />
              </div>
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">{t('staff.leave.form_no_matches')}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
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
  const { t, language } = useI18n();

  const employees = propEmployees ?? [];

  const getEmpDepartment = (emp: Employee): string => {
    return emp.department || 'General';
  };

  const getEmpName = (emp: Employee): string => {
    return emp.employeeName || t('staff.leave.form_unnamed_employee');
  };

  const getEmpId = (emp: Employee): number => {
    return emp.id;
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
  
  const [form, setForm] = useState<LeaveRequestInput & { employeeName: string; department: string; reason: string }>({
    employeeId: initialEmp ? getEmpId(initialEmp) : 0,
    employeeName: initialEmp ? getEmpName(initialEmp) : '',
    department: initialDept,
    type: 'Casual',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const days = form.fromDate && form.toDate && form.toDate >= form.fromDate
    ? Math.floor((Date.parse(`${form.toDate}T00:00:00Z`) - Date.parse(`${form.fromDate}T00:00:00Z`)) / 86_400_000) + 1
    : 0;

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
      showNotification(t('staff.leave.err_to_before_from'), 'error');
      return;
    }
    setForm((prev) => ({ ...prev, toDate: date }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fromDate || !form.toDate) {
      showNotification(t('staff.leave.err_dates_required'), 'error');
      return;
    }
    if (days <= 0 || form.toDate < form.fromDate) {
      showNotification(t('staff.leave.err_invalid_range'), 'error');
      return;
    }
    if (!form.employeeId) {
      showNotification(t('staff.leave.err_employee_required'), 'error');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  const departmentOptions = uniqueDepartments.map((d) => ({ value: d, label: d }));
  /** Values stay the API's English leave types — only the labels translate. */
  const leaveTypeOptions: { value: LeaveRequestInput['type']; label: string }[] = [
    'Casual',
    'Sick',
    'Emergency',
    'Annual',
  ].map((type) => ({ value: type as LeaveRequestInput['type'], label: leaveTypeLabel(t, type) }));

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5 transition-all">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/60 shadow-2xs">
            <Plus size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{t('staff.leave.form_title')}</h3>
            <p className="text-xs text-slate-500">{t('staff.leave.form_subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label={t('staff.leave.form_close_aria')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Line 1 - Department */}
        <FormDropdown
          label={t('staff.department')}
          icon={<Briefcase size={13} className="text-blue-500" />}
          value={selectedDepartment}
          options={departmentOptions}
          searchable
          onChange={handleDepartmentChange}
        />

        {/* Line 1 - Employee */}
        <div className="relative" ref={employeeDropdownRef}>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <User size={13} className="text-blue-500" /> {t('staff.leave.form_employee')}
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
              placeholder={t('staff.leave.form_employee_search', { department: selectedDepartment })}
              aria-label={t('staff.leave.form_employee_aria')}
              className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-slate-50 transition text-slate-700 font-medium"
            />
            <button
              type="button"
              aria-label={t('staff.leave.form_show_employees')}
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
                        {t('staff.leave.form_id', { id: empId })}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-xs text-slate-400 text-center">
                  {t('staff.leave.form_no_employees', { department: selectedDepartment })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line 2 - From Date */}
        <div>
          <DatePicker
            label={t('staff.leave.form_from_date')}
            language={language}
            value={form.fromDate}
            onChange={handleFromDateChange}
            required
            className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:bg-slate-50/50"
          />
        </div>

        {/* Line 2 - To Date */}
        <div>
          <DatePicker
            label={t('staff.leave.form_to_date')}
            language={language}
            value={form.toDate}
            onChange={handleToDateChange}
            required
            className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:bg-slate-50/50"
          />
        </div>

        {/* Line 3 - Leave Type */}
        <FormDropdown
          label={t('staff.leave_type')}
          icon={<Layers size={13} className="text-blue-500" />}
          value={form.type}
          options={leaveTypeOptions}
          onChange={(val) => setForm((prev) => ({ ...prev, type: val as LeaveRequestInput['type'] }))}
        />

        {/* Line 3 - Days Counter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Hash size={13} className="text-blue-500" /> {t('staff.leave.form_calculated_days')}
          </label>
          <div className="relative">
            <input
              type="number"
              value={days}
              readOnly
              aria-label={t('staff.leave.form_calculated_days_aria')}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-blue-50/40 text-blue-900 font-bold cursor-not-allowed"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600">
              {t('staff.leave.form_days_suffix')}
            </span>
          </div>
        </div>

        {/* Line 4: Reason */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <FileText size={13} className="text-blue-500" /> {t('staff.leave.form_reason')}
          </label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            rows={2.5}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-slate-50 transition text-slate-700 placeholder-slate-400 font-medium resize-none"
            placeholder={t('staff.leave.form_reason_placeholder')}
            aria-label={t('staff.leave.form_reason_aria')}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
        >
          <Plus size={15} />
          {isSubmitting ? t('staff.leave.form_submitting') : t('staff.leave.form_submit')}
        </button>
      </div>
    </form>
  );
}

export default memo(LeaveRequestForm);
