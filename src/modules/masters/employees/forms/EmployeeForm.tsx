// src/modules/masters/employees/forms/EmployeeForm.tsx
import { useEffect, useState } from "react";
import type { Employee } from "../types/employee";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import {
  User,
  Building2,
  Briefcase,
  Phone,
  Mail,
  IndianRupee,
  CreditCard,
  Key,
  Home,
  Users,
  ChevronDown,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";

type EmployeeFormProps = {
  employee?: Employee | null;
  onSave: (employee: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

// Departments sorted alphabetically
const DEPARTMENTS = [
  "Accountant",
  "Collection",
  "Driver",
  "Helper",
  "Loader",
  "Office Staff",
  "Operations",
  "Other",
  "Sales",
  "Supervisor",
].sort();

// Helper: format salary with commas
const formatSalary = (value: number | ""): string => {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (isNaN(num) || num < 0) return "";
  return num.toLocaleString("en-IN");
};

// Helper: parse formatted string to number
const parseSalary = (display: string): number | "" => {
  const cleaned = display.replace(/,/g, "").trim();
  if (cleaned === "") return "";
  const num = Number(cleaned);
  return isNaN(num) ? "" : num;
};

function EmployeeForm({ employee, onSave, onCancel, isSaving = false }: EmployeeFormProps) {
  const { showNotification } = useSafeNotification();

  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [salaryDisplay, setSalaryDisplay] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const isEditing = !!employee;

  useEffect(() => {
    if (employee) {
      setEmployeeName(employee.employeeName);
      setDepartment(employee.department);
      setRole(employee.role);
      setPhoneNumber(employee.phoneNumber);
      setEmail(employee.email);
      setAddress(employee.address ?? "");
      setJoiningDate(employee.joiningDate ?? "");
      setAadharNumber(employee.aadharNumber ?? "");
      setLicenseNumber(employee.licenseNumber ?? "");
      setSalaryDisplay(formatSalary(employee.salary ?? ""));
      setStatus(employee.status);
    } else {
      setEmployeeName("");
      setDepartment("");
      setRole("");
      setPhoneNumber("");
      setEmail("");
      setAddress("");
      setJoiningDate("");
      setAadharNumber("");
      setLicenseNumber("");
      setSalaryDisplay("");
      setStatus("Active");
    }
  }, [employee]);

  const formatAadhar = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const parts = digits.match(/.{1,4}/g);
    if (parts) return parts.join(" ");
    return digits;
  };

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9,]/g, "").replace(/,/g, "");
    if (digits === "") {
      setSalaryDisplay("");
      return;
    }
    const num = Number(digits);
    if (!isNaN(num)) setSalaryDisplay(num.toLocaleString("en-IN"));
  };

  const handleSalaryBlur = () => {
    if (salaryDisplay === "") return;
    const num = parseSalary(salaryDisplay);
    if (num === "" || isNaN(Number(num))) setSalaryDisplay("");
    else setSalaryDisplay(Number(num).toLocaleString("en-IN"));
  };

  const handleSubmit = () => {
    const salaryNumber = parseSalary(salaryDisplay);

    if (!employeeName || !department || !phoneNumber || salaryDisplay === "") {
      showNotification("Please fill all required fields (marked with *).", "error");
      return;
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      showNotification("Mobile Number must be exactly 10 digits.", "error");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showNotification("Please enter a valid email address.", "error");
      return;
    }
    if (salaryNumber === "" || Number(salaryNumber) < 0) {
      showNotification("Salary must be a positive number.", "error");
      return;
    }

    if ((department === "Driver" || department === "Collection") && !licenseNumber?.trim()) {
      showNotification("License Number is required for Driver and Collection departments.", "error");
      return;
    }

    if (aadharNumber && !/^[0-9]{12}$/.test(aadharNumber)) {
      showNotification("Aadhar Number must be exactly 12 digits.", "error");
      return;
    }

    if (licenseNumber && licenseNumber.trim().length < 3) {
      showNotification("License Number must be at least 3 characters.", "error");
      return;
    }

    onSave({
      employeeName,
      department,
      role,
      phoneNumber,
      email,
      address,
      joiningDate,
      aadharNumber,
      licenseNumber,
      salary: Number(salaryNumber),
      status,
    });
  };

  // Form-local design shared with the Vehicle master form: compact 40px
  // fields, slate border, soft background, emerald focus ring.
  const inputClass = (hasError = false) =>
    `w-full h-10 pl-9 pr-3 text-sm rounded-lg border bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white ${
      hasError
        ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100"
        : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
    } appearance-none`;

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const fieldLabel = (text: string, hint?: string, required = false) => (
    <label className="block mb-1.5 text-xs font-semibold text-slate-600">
      {text}
      {required && <span className="text-red-500"> *</span>}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </h3>
      <div className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
    </div>
  );

  /**
   * Same form-local treatment as the Vehicle form: the DatePicker wrapper only
   * sets width, the side calendar icon stays the shared DatePicker's default
   * emerald green, and `popupClassName` shrinks the calendar popup here only —
   * the shared DatePicker component is untouched. Placement is "bottom" so the
   * popup opens below the field; `origin-top-left` keeps it anchored there.
   */
  const datePickerWrapperClass = "w-full";
  const datePickerPopupClass = "w-72! scale-80 origin-top-left";

  const title = isEditing ? "Edit Employee" : "Add Employee";
  const subtitle = isEditing ? "Update details" : "Fill in the details";

  const toggleStatus = () => {
    if (!isSaving) setStatus(status === "Active" ? "Inactive" : "Active");
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200">
      {/* Header — rounded on its own corners: the card must NOT clip
          (overflow-hidden) or the date picker's popup gets cut off at the
          card edge and the dialog cannot scroll to reveal it. */}
      <div className="rounded-t-2xl px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/70 via-white to-white">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={isSaving}
            aria-label={`Status: ${status}. Toggle status.`}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status === "Active" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold ${
              status === "Active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-8 space-y-7">
        {/* Section 1: Personal details */}
        <section className="space-y-3">
          {sectionHeading("Personal Details")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              {fieldLabel("Employee Name", undefined, true)}
              <div className="relative">
                <User className={iconWrapperClass} size={16} />
                <input
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Full name"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Phone Number", undefined, true)}
              <div className="relative">
                <Phone className={iconWrapperClass} size={16} />
                <input
                  value={phoneNumber}
                  maxLength={10}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit mobile number"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Email", "(Optional)")}
              <div className="relative">
                <Mail className={iconWrapperClass} size={16} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Address")}
              <div className="relative">
                <Home className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter address"
                  rows={2}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-y"
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Work details */}
        <section className="space-y-3">
          {sectionHeading("Work Details")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              {fieldLabel("Department", undefined, true)}
              <div className="relative">
                <Building2 className={iconWrapperClass} size={16} />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={`${inputClass()} pr-8 cursor-pointer`}
                  disabled={isSaving}
                >
                  <option value="" disabled>Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Departments are listed alphabetically
              </p>
            </div>

            <div className="relative">
              {fieldLabel("Role", "(Optional)")}
              <div className="relative">
                <Briefcase className={iconWrapperClass} size={16} />
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Manager, Staff, Collector"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Joining Date")}
              <div className="relative">
                <DatePicker
                  value={joiningDate}
                  onChange={setJoiningDate}
                  placeholder="Select joining date"
                  placement="bottom"
                  className={datePickerWrapperClass}
                  popupClassName={datePickerPopupClass}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Salary", undefined, true)}
              <div className="relative">
                <IndianRupee className={iconWrapperClass} size={16} />
                <input
                  type="text"
                  value={salaryDisplay}
                  onChange={handleSalaryChange}
                  onBlur={handleSalaryBlur}
                  placeholder="e.g., 20,000"
                  className={`${inputClass()} [appearance:textfield]`}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Documents */}
        <section className="space-y-3">
          {sectionHeading("Documents")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              {fieldLabel("Aadhar Number")}
              <div className="relative">
                <CreditCard className={iconWrapperClass} size={16} />
                <input
                  value={formatAadhar(aadharNumber)}
                  maxLength={14}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, "");
                    setAadharNumber(raw);
                  }}
                  placeholder="3044 6064 2044"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel(
                "License Number",
                (department === "Driver" || department === "Collection") ? "(Required)" : "(Optional)"
              )}
              <div className="relative">
                <Key className={iconWrapperClass} size={16} />
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="License number"
                  className={inputClass(
                    (department === "Driver" || department === "Collection") && !licenseNumber
                  )}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-5 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm hover:shadow font-semibold text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSaving && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSaving ? "Saving..." : isEditing ? "Update Employee" : "Save Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmployeeForm;
