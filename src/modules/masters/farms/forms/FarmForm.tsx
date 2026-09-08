import {
  Warehouse,
  User,
  Users,
  Phone,
  MapPin,
  Bird,
  Home,
} from "lucide-react";
import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import {
  masterInputClass,
  masterTextareaClass,
  masterIconClass,
  masterLabelClass,
} from "../../components/masterFormStyles";
import { useId, useEffect, useState } from "react";
import type { Farm } from "../types/farm";

type FarmFormProps = {
  farm?: Farm | null;
  onSave: (farm: {
    farmName: string;
    ownerName: string;
    supervisorName: string;
    phoneNumber: string;
    village: string;
    address: string;
    capacity: number;
    status: "Active" | "Inactive";
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function FarmForm({ farm, onSave, onCancel, isSaving = false }: FarmFormProps) {
  const formId = useId();
  const fieldId = (field: string) => `${formId}-${field}`;
  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState({
    farmName: "",
    ownerName: "",
    supervisorName: "",
    phoneNumber: "",
    village: "",
    capacity: "",
  });

  useEffect(() => {
    if (farm) {
      setFarmName(farm.farmName);
      setOwnerName(farm.ownerName);
      setSupervisorName(farm.supervisorName);
      setPhoneNumber(farm.phoneNumber);
      setVillage(farm.village);
      setAddress(farm.address ?? "");
      setCapacity(farm.capacity ?? "");
      setStatus(farm.status);
    } else {
      setFarmName("");
      setOwnerName("");
      setSupervisorName("");
      setPhoneNumber("");
      setVillage("");
      setAddress("");
      setCapacity("");
      setStatus("Active");
    }
    setErrors({
      farmName: "",
      ownerName: "",
      supervisorName: "",
      phoneNumber: "",
      village: "",
      capacity: "",
    });
  }, [farm]);

  const clearFieldError = (field: keyof typeof errors) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = () => {
    if (isSaving) return;
    let hasError = false;
    const newErrors = { ...errors };

    if (!farmName.trim()) {
      newErrors.farmName = "Farm Name is required.";
      hasError = true;
    } else {
      newErrors.farmName = "";
    }

    if (!ownerName.trim()) {
      newErrors.ownerName = "Owner Name is required.";
      hasError = true;
    } else if (ownerName.trim().length < 3) {
      newErrors.ownerName = "Owner Name must contain at least 3 characters.";
      hasError = true;
    } else {
      newErrors.ownerName = "";
    }

    if (!supervisorName.trim()) {
      newErrors.supervisorName = "Supervisor Name is required.";
      hasError = true;
    } else {
      newErrors.supervisorName = "";
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Mobile Number is required.";
      hasError = true;
    } else if (!/^[0-9]{10}$/.test(phoneNumber)) {
      newErrors.phoneNumber = "Mobile Number must be exactly 10 digits.";
      hasError = true;
    } else {
      newErrors.phoneNumber = "";
    }

    if (!village.trim()) {
      newErrors.village = "Village is required.";
      hasError = true;
    } else {
      newErrors.village = "";
    }

    if (capacity === "" || capacity === null || capacity === undefined) {
      newErrors.capacity = "Bird Capacity is required.";
      hasError = true;
    } else if (Number(capacity) <= 0) {
      newErrors.capacity = "Bird Capacity must be a positive number.";
      hasError = true;
    } else {
      newErrors.capacity = "";
    }

    setErrors(newErrors);
    if (hasError) return;

    onSave({
      farmName: farmName.trim(),
      ownerName: ownerName.trim(),
      supervisorName: supervisorName.trim(),
      phoneNumber: phoneNumber.trim(),
      village: village.trim(),
      address: address.trim(),
      capacity: Number(capacity),
      status,
    });
  };

  const label = (text: string, field: string, required = true) => (
    <label htmlFor={fieldId(field)} className={masterLabelClass}>
      {text}
      {required && (
        <span className="text-red-500" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
  const errorMessage = (field: keyof typeof errors) =>
    errors[field] && (
      <p
        id={`${fieldId(field)}-error`}
        role="alert"
        className="mt-1 text-xs text-red-600"
      >
        {errors[field]}
      </p>
    );
  const errorProps = (field: keyof typeof errors) => ({
    "aria-invalid": !!errors[field],
    "aria-describedby": errors[field] ? `${fieldId(field)}-error` : undefined,
  });

  return (
    <MasterForm
      title={farm ? "Edit Farm" : "Add Farm"}
      subtitle={farm ? "Update details" : "Fill in the details"}
      icon={<Warehouse size={20} />}
      status={status}
      onStatusChange={setStatus}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSaving={isSaving}
      submitLabel={farm ? "Update Farm" : "Save Farm"}
    >
      <section className="space-y-3">
        <MasterSectionHeading>Farm Details</MasterSectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            {label("Farm Name", "farmName")}
            <div className="relative">
              <Warehouse
                size={16}
                aria-hidden="true"
                className={masterIconClass}
              />
              <input
                id={fieldId("farmName")}
                required
                value={farmName}
                {...errorProps("farmName")}
                onChange={(event) => {
                  setFarmName(event.target.value);
                  clearFieldError("farmName");
                }}
                placeholder="e.g., Green Valley Farm"
                className={masterInputClass(!!errors.farmName)}
              />
            </div>
            {errorMessage("farmName")}
          </div>
          <div>
            {label("Owner Name", "ownerName")}
            <div className="relative">
              <User size={16} aria-hidden="true" className={masterIconClass} />
              <input
                id={fieldId("ownerName")}
                required
                value={ownerName}
                {...errorProps("ownerName")}
                onChange={(event) => {
                  setOwnerName(event.target.value);
                  clearFieldError("ownerName");
                }}
                placeholder="Full name"
                className={masterInputClass(!!errors.ownerName)}
              />
            </div>
            {errorMessage("ownerName")}
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <MasterSectionHeading>Contact Details</MasterSectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            {label("Supervisor Name", "supervisorName")}
            <div className="relative">
              <Users size={16} aria-hidden="true" className={masterIconClass} />
              <input
                id={fieldId("supervisorName")}
                required
                value={supervisorName}
                {...errorProps("supervisorName")}
                onChange={(event) => {
                  setSupervisorName(event.target.value);
                  clearFieldError("supervisorName");
                }}
                placeholder="Full name"
                className={masterInputClass(!!errors.supervisorName)}
              />
            </div>
            {errorMessage("supervisorName")}
          </div>
          <div>
            {label("Mobile Number", "phoneNumber")}
            <div className="relative">
              <Phone size={16} aria-hidden="true" className={masterIconClass} />
              <input
                id={fieldId("phoneNumber")}
                type="tel"
                inputMode="numeric"
                required
                value={phoneNumber}
                maxLength={10}
                {...errorProps("phoneNumber")}
                onChange={(event) => {
                  setPhoneNumber(event.target.value.replace(/\D/g, ""));
                  clearFieldError("phoneNumber");
                }}
                placeholder="10-digit mobile number"
                className={masterInputClass(!!errors.phoneNumber)}
              />
            </div>
            {errorMessage("phoneNumber")}
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <MasterSectionHeading>Location & Capacity</MasterSectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            {label("Village", "village")}
            <div className="relative">
              <MapPin
                size={16}
                aria-hidden="true"
                className={masterIconClass}
              />
              <input
                id={fieldId("village")}
                required
                value={village}
                {...errorProps("village")}
                onChange={(event) => {
                  setVillage(event.target.value);
                  clearFieldError("village");
                }}
                placeholder="Village name"
                className={masterInputClass(!!errors.village)}
              />
            </div>
            {errorMessage("village")}
          </div>
          <div>
            {label("Bird Capacity", "capacity")}
            <div className="relative">
              <Bird size={16} aria-hidden="true" className={masterIconClass} />
              <input
                id={fieldId("capacity")}
                type="number"
                required
                value={capacity}
                {...errorProps("capacity")}
                onChange={(event) => {
                  setCapacity(
                    event.target.value === "" ? "" : Number(event.target.value),
                  );
                  clearFieldError("capacity");
                }}
                placeholder="e.g., 500"
                className={masterInputClass(!!errors.capacity)}
              />
            </div>
            {errorMessage("capacity")}
          </div>
          <div className="sm:col-span-2">
            {label("Address", "address", false)}
            <div className="relative">
              <Home
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
              />
              <textarea
                id={fieldId("address")}
                value={address}
                rows={2}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Street, landmark, etc."
                className={masterTextareaClass}
              />
            </div>
          </div>
        </div>
      </section>
    </MasterForm>
  );
}

export default FarmForm;
