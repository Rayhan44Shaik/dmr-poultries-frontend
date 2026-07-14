import { useEffect, useState } from "react";
import type { Employee } from "../types/employee";
import { useNotification } from "../../../../context/NotificationContext";

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

  const handleSubmit = () => {
    // Required fields
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

    // License validation: required for Driver and Collection
    if ((department === "Driver" || department === "Collection") && !licenseNumber?.trim()) {
      showNotification("License Number is required for Driver and Collection departments.", "error");
      return;
    }

    // Aadhar: optional, but if provided, must be 12 digits
    if (aadharNumber && !/^[0-9]{12}$/.test(aadharNumber)) {
      showNotification("Aadhar Number must be exactly 12 digits.", "error");
      return;
    }
    // License: if provided, allow any non-empty string (flexible)
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Employee Name <span className="text-red-500">*</span>
          </label>
          <input
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Full name"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border rounded-lg p-2.5"
          >
            <option value="">Select Department</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Role <span className="text-red-500">*</span>
          </label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Manager, Staff, Collector"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            value={phoneNumber}
            maxLength={10}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="10-digit mobile number"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Joining Date
          </label>
          <input
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Salary <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Monthly salary"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Aadhar Number
          </label>
          <input
            value={aadharNumber}
            maxLength={12}
            onChange={(e) => setAadharNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="12-digit Aadhar"
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            License Number
            <span className="text-xs text-slate-400 ml-1">
              {department === "Driver" || department === "Collection" ? "(Required)" : "(Optional)"}
            </span>
          </label>
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="License number"
            className={`w-full border rounded-lg p-2.5 ${
              (department === "Driver" || department === "Collection") && !licenseNumber
                ? "border-red-300 focus:border-red-500"
                : ""
            }`}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter address"
            rows={2}
            className="w-full border rounded-lg p-2.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Status <span className="text-red-500">*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
            className="w-full border rounded-lg p-2.5"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          {employee ? "Update Employee" : "Save Employee"}
        </button>
      </div>
    </div>
  );
}

export default EmployeeForm;