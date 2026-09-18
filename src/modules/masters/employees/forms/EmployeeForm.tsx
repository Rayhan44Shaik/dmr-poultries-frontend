import MasterDropdown from "../../components/MasterDropdown";
import { useI18n } from "../../../../i18n";
import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import {
  masterInputClass,
  masterIconClass,
  masterLabelClass,
  masterTextareaClass,
} from "../../components/masterFormStyles";
// src/modules/masters/employees/forms/EmployeeForm.tsx
import { useId, useState } from "react";
import type { Employee } from "../types/employee";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import {
  User,
  Briefcase,
  Phone,
  Mail,
  IndianRupee,
  CreditCard,
  Key,
  Home,
  Users,
} from "lucide-react";
import DatePicker from "../../components/MasterDatePicker";

type EmployeeFormProps = {
  employee?: Employee | null;
  onSave: (employee: Partial<Employee>) => void;
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

function EmployeeForm({
  employee,
  onSave,
  onCancel,
  isSaving = false,
}: EmployeeFormProps) {
  const { t } = useI18n();
  const formId = useId();
  const fieldId = (text: string) => `${formId}-${text.replace(/\s+/g, "-")}`;
  const { showNotification } = useSafeNotification();

  const [employeeName, setEmployeeName] = useState(employee?.employeeName ?? "");
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [role, setRole] = useState(employee?.role ?? "");
  const [phoneNumber, setPhoneNumber] = useState(employee?.phoneNumber ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [address, setAddress] = useState(employee?.address ?? "");
  const [joiningDate, setJoiningDate] = useState(employee?.joiningDate ?? "");
  const [aadharNumber, setAadharNumber] = useState(employee?.aadharNumber ?? "");
  const [licenseNumber, setLicenseNumber] = useState(employee?.licenseNumber ?? "");
  const [salaryDisplay, setSalaryDisplay] = useState(formatSalary(employee?.salary ?? ""));
  const [status, setStatus] = useState<"Active" | "Inactive" | "Suspended">(employee?.status ?? "Active");

  const isEditing = !!employee;

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
      showNotification(
        "Please fill all required fields (marked with *).",
        "error",
      );
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

    if (
      (department === "Driver" || department === "Collection") &&
      !licenseNumber?.trim()
    ) {
      showNotification(
        "License Number is required for Driver and Collection departments.",
        "error",
      );
      return;
    }

    if (aadharNumber && !/^[0-9]{12}$/.test(aadharNumber)) {
      showNotification("Aadhar Number must be exactly 12 digits.", "error");
      return;
    }

    if (licenseNumber && licenseNumber.trim().length < 3) {
      showNotification(
        "License Number must be at least 3 characters.",
        "error",
      );
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

  const inputClass = masterInputClass;
  const iconWrapperClass = masterIconClass;

  const fieldLabel = (text: string, hint?: string, required = false) => (
    <label htmlFor={fieldId(text)} className={masterLabelClass}>
      {text}
      {required && <span className="text-red-500"> *</span>}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <MasterSectionHeading>{label}</MasterSectionHeading>
  );

  const title = isEditing ? "Edit Employee" : "Add Employee";
  const subtitle = isEditing ? "Update details" : "Fill in the details";

  return (
    <MasterForm
      title={title}
      subtitle={subtitle}
      icon={<Users size={20} />}
      status={status}
      onStatusChange={setStatus}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSaving={isSaving}
      submitLabel={isEditing ? "Update Employee" : "Save Employee"}
    >
      {/* Section 1: Personal details */}
      <section className="space-y-3">
        {sectionHeading("Personal Details")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            {fieldLabel("Employee Name", undefined, true)}
            <div className="relative">
              <User className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Employee Name")}
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
                id={fieldId("Phone Number")}
                value={phoneNumber}
                maxLength={10}
                onChange={(e) =>
                  setPhoneNumber(e.target.value.replace(/\D/g, ""))
                }
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
                id={fieldId("Email")}
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
              <Home
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <textarea
                id={fieldId("Address")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address"
                rows={2}
                className={masterTextareaClass}
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
          <MasterDropdown
            label={t("masters.ui.department")}
            labelStyle="field"
            required
            value={department}
            onChange={setDepartment}
            options={DEPARTMENTS}
            placeholder={t("masters.ui.select_department")}
            disabled={isSaving}
          />

          <div className="relative">
            {fieldLabel("Role", "(Optional)")}
            <div className="relative">
              <Briefcase className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Role")}
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
                id={fieldId("Joining Date")}
                value={joiningDate}
                onChange={setJoiningDate}
                placeholder="Select joining date"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="relative">
            {fieldLabel("Salary", undefined, true)}
            <div className="relative">
              <IndianRupee className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Salary")}
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
                id={fieldId("Aadhar Number")}
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
              department === "Driver" || department === "Collection"
                ? "(Required)"
                : "(Optional)",
            )}
            <div className="relative">
              <Key className={iconWrapperClass} size={16} />
              <input
                id={fieldId("License Number")}
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="License number"
                className={inputClass(
                  (department === "Driver" || department === "Collection") &&
                    !licenseNumber,
                )}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>
      </section>
    </MasterForm>
  );
}

export default EmployeeForm;
