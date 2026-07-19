import { useEffect, useState } from "react";
import type { Employee } from "../types/employee";
import { useNotification } from "../../../../context/NotificationContext";
import {
  User,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  IndianRupee,
  CreditCard,
  Key,
  Home,
  Users,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker"; // ✅ added import

type EmployeeFormProps = {
  employee?: Employee | null;
  onSave: (employee: any) => void;
  onCancel: () => void;
};

const DEPARTMENTS = [
  "Driver",
  "Supervisor",
  "Loader",
  "Accountant",
  "Collection",
  "Office Staff",
  "Other",
  "Operations",
  "Sales",
];

function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { showNotification } = useNotification();

  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [salary, setSalary] = useState<number | "">("");
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
      setSalary(employee.salary ?? "");
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
      setSalary("");
      setStatus("Active");
    }
  }, [employee]);

  // Format Aadhar with spaces every 4 digits
  const formatAadhar = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const parts = digits.match(/.{1,4}/g);
    if (parts) {
      return parts.join(" ");
    }
    return digits;
  };

  const handleSubmit = () => {
    if (!employeeName || !department || !role || !phoneNumber || !email || salary === "") {
      showNotification("Please fill all required fields.", "error");
      return;
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      showNotification("Mobile Number must be exactly 10 digits.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showNotification("Please enter a valid email address.", "error");
      return;
    }
    if (Number(salary) < 0) {
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
      salary: Number(salary),
      status,
    });
  };

  const inputClass = (hasError = false) =>
    `w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition ${
      hasError ? "border-red-300 focus:border-red-500" : "border-slate-200"
    } bg-white`;

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const title = isEditing ? "Edit Employee" : "Add Employee";
  const subtitle = isEditing ? "Update details" : "Fill in the details";

  const toggleStatus = () => {
    setStatus(status === "Active" ? "Inactive" : "Active");
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header with icon, title, and status toggle */}
      <div className="bg-gradient-to-r from-slate-100 to-slate-200/80 px-6 py-5 flex items-center justify-between border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>

        {/* Status toggle switch */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <button
            type="button"
            onClick={toggleStatus}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status === "Active" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${
              status === "Active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Form Body – 2 columns */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Employee Name */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Employee Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className={iconWrapperClass} size={18} />
              <input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Full name"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Department */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Department <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className={iconWrapperClass} size={18} />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition border-slate-200 bg-white appearance-none"
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Briefcase className={iconWrapperClass} size={18} />
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Manager, Staff, Collector"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className={iconWrapperClass} size={18} />
              <input
                value={phoneNumber}
                maxLength={10}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile number"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Email */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className={iconWrapperClass} size={18} />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={inputClass()}
              />
            </div>
          </div>

          {/* ✅ Joining Date – now using DatePicker */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Joining Date
            </label>
            <div className="relative">
              <Calendar className={iconWrapperClass} size={18} />
              <DatePicker
                value={joiningDate}
                onChange={setJoiningDate}
                placeholder="Select joining date"
                className="w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition border-slate-200 bg-white"
              />
            </div>
          </div>

          {/* Salary – with Rupee symbol */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Salary <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <IndianRupee className={iconWrapperClass} size={18} />
              <input
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Monthly salary"
                className={`${inputClass()} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              />
            </div>
          </div>

          {/* Aadhar Number – with space formatting */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Aadhar Number
            </label>
            <div className="relative">
              <CreditCard className={iconWrapperClass} size={18} />
              <input
                value={formatAadhar(aadharNumber)}
                maxLength={14} // 12 digits + 2 spaces
                onChange={(e) => {
                  const raw = e.target.value.replace(/\s/g, "");
                  setAadharNumber(raw);
                }}
                placeholder="3044 6064 2044"
                className={inputClass()}
              />
            </div>
          </div>

          {/* License Number */}
          <div className="relative">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              License Number
              <span className="text-xs text-slate-400 ml-1">
                {(department === "Driver" || department === "Collection") ? "(Required)" : "(Optional)"}
              </span>
            </label>
            <div className="relative">
              <Key className={iconWrapperClass} size={18} />
              <input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="License number"
                className={inputClass(
                  (department === "Driver" || department === "Collection") && !licenseNumber
                )}
              />
            </div>
          </div>

          {/* Address – full width */}
          <div className="relative md:col-span-2">
            <label className="block mb-1.5 text-sm font-medium text-slate-700">
              Address
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-3 text-slate-400" size={18} />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address"
                rows={2}
                className="w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition border-slate-200 bg-white resize-y"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-6 pt-5 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm hover:shadow font-medium text-sm"
          >
            {isEditing ? "Update Employee" : "Save Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmployeeForm;