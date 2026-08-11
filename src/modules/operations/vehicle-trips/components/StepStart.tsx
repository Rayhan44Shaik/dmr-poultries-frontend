// src/modules/operations/vehicle-trips/components/StepStart.tsx

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Clock, User, Truck, Gauge, Wallet, Pencil } from "lucide-react";
import Select from "react-select";
import type { Trip } from "../types/trip";
import { validateStartStep } from "../services/tripFormService";
import { WizardActionBar, WizardStepNotice, type WizardNoticeState } from "./WizardStepUI";
import ConfirmDialog from "./ConfirmDialog";

type VehicleOption = { id: number; vehicleNumber: string };
type EmployeeOption = { id: number; employeeName: string; department: string };
type SaveStatus = "idle" | "saving" | "saved";

interface Props {
  tripId: number;
  startTime: string;
  startStepSubmitted: boolean;
  loadSnapshot: Trip;
  updateTrip: (updates: Partial<Trip>) => void;
  submitStartStep: (data: Partial<Trip>) => Promise<boolean>;
  saveStartProgress?: (data: Partial<Trip>) => Promise<boolean>;
  hasUnsavedChanges?: boolean;
  vehicleOptions: VehicleOption[];
  employeeOptions: EmployeeOption[];
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
  headerLoading?: boolean;
  subscribeHeaderSaveStatus: (listener: () => void) => () => void;
  getHeaderSaveStatus: () => SaveStatus;
}

type Step1FormState = {
  vehicleId: number;
  vehicleNo: string;
  driverId: number;
  driverName: string;
  supervisorId: number;
  supervisorName: string;
  helpers: string[];
  loaders: string[];
  openingMeterText: string;
  advanceText: string;
};

const MENU_PORTAL_TARGET = typeof document !== "undefined" ? document.body : null;

const EMPTY_FORM: Step1FormState = {
  vehicleId: 0,
  vehicleNo: "",
  driverId: 0,
  driverName: "",
  supervisorId: 0,
  supervisorName: "",
  helpers: [],
  loaders: [],
  openingMeterText: "",
  advanceText: "",
};

function formatNumericField(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) return "";
  return String(value);
}

function parseNumericField(text: string): number {
  if (text.trim() === "") return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tripToForm(trip: Trip): Step1FormState {
  return {
    vehicleId: trip.vehicleId,
    vehicleNo: trip.vehicleNo,
    driverId: trip.driverId,
    driverName: trip.driverName,
    supervisorId: trip.supervisorId,
    supervisorName: trip.supervisorName,
    helpers: trip.helpers ? [...trip.helpers] : [],
    loaders: trip.loaders ? [...trip.loaders] : [],
    openingMeterText: formatNumericField(trip.openingMeter),
    advanceText: formatNumericField(trip.advanceAmount),
  };
}

function formHasEdits(form: Step1FormState): boolean {
  return Boolean(
    form.vehicleId ||
    form.driverId ||
    form.supervisorId ||
    form.openingMeterText.trim() ||
    form.advanceText.trim() ||
    form.helpers.length ||
    form.loaders.length
  );
}

function formToTripPatch(form: Step1FormState): Partial<Trip> {
  return {
    vehicleId: form.vehicleId,
    vehicleNo: form.vehicleNo,
    driverId: form.driverId,
    driverName: form.driverName,
    supervisorId: form.supervisorId,
    supervisorName: form.supervisorName,
    helpers: form.helpers,
    loaders: form.loaders,
    openingMeter: parseNumericField(form.openingMeterText),
    advanceAmount: parseNumericField(form.advanceText),
  };
}

const getVehicleLabel = (option: VehicleOption) => option.vehicleNumber || "";
const getVehicleValue = (option: VehicleOption) => String(option.id ?? "");
const getEmployeeLabel = (option: EmployeeOption) => option.employeeName || "";
const getEmployeeValue = (option: EmployeeOption) => option.employeeName || "";

const selectStyles: any = {
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 42,
    borderRadius: "0.75rem",
    borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
    backgroundColor: "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(37, 99, 235, 0.15)" : "none",
    "&:hover": { borderColor: "#cbd5e1" },
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: "#0f172a",
    fontWeight: "500",
    fontSize: "14px",
  }),
  multiValue: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#f1f5f9",
    borderRadius: "0.375rem",
  }),
  multiValueLabel: (base: Record<string, unknown>) => ({
    ...base,
    color: "#0f172a",
    fontSize: "13px",
    paddingLeft: "6px",
    paddingRight: "6px",
  }),
  multiValueRemove: (base: Record<string, unknown>) => ({
    ...base,
    color: "#64748b",
    "&:hover": { backgroundColor: "#e2e8f0", color: "#0f172a" },
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: "#94a3b8",
    fontSize: "14px",
  }),
  option: (base: any, { isFocused, isSelected }: any) => ({
    ...base,
    backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f8fafc" : "#ffffff",
    color: isSelected ? "#ffffff" : "#1e293b",
    fontSize: "13px",
    cursor: "pointer",
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    maxHeight: 180,
    overflowY: "auto",
    scrollbarWidth: "none",
  }),
};

const StartTimeField = React.memo(function StartTimeField({ startTime }: { startTime: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <Clock size={14} className="text-slate-400" /> Start Time <span className="text-red-500">*</span>
      </label>
      <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
        {startTime ? (
          startTime
        ) : (
          <span className="text-slate-400 font-normal text-xs">Will be captured when trip starts</span>
        )}
      </div>
    </div>
  );
});

function buildSelectStyles(invalid: boolean): any {
  return {
    ...selectStyles,
    control: (base: any, state: any) => ({
      ...selectStyles.control(base, state),
      borderColor: invalid
        ? "#ef4444"
        : state.isFocused
          ? "#2563eb"
          : "#e2e8f0",
      boxShadow: invalid
        ? "0 0 0 2px rgba(239, 68, 68, 0.1)"
        : state.isFocused
          ? "0 0 0 2px rgba(37, 99, 235, 0.15)"
          : "none",
    }),
  };
}

const VehicleField = React.memo(function VehicleField({
  vehicleId,
  options,
  disabled,
  invalid,
  onSelect,
}: {
  vehicleId: number;
  options: VehicleOption[];
  disabled: boolean;
  invalid?: boolean;
  onSelect: (vehicleId: number, vehicleNo: string) => void;
}) {
  const value = useMemo(
    () => options.find((option) => option.id === vehicleId) || null,
    [options, vehicleId]
  );
  const handleChange = useCallback(
    (option: VehicleOption | null) => {
      onSelect(option?.id || 0, option?.vehicleNumber || "");
    },
    [onSelect]
  );
  const styles = useMemo(() => buildSelectStyles(Boolean(invalid)), [invalid]);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <Truck size={14} className="text-slate-400" /> Vehicle No. <span className="text-red-500">*</span>
      </label>
      <Select<VehicleOption, false>
        options={options}
        getOptionLabel={getVehicleLabel}
        getOptionValue={getVehicleValue}
        value={value}
        onChange={handleChange}
        className="mt-1 text-sm"
        placeholder="Search Vehicle..."
        isSearchable
        isDisabled={disabled}
        styles={styles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const SupervisorField = React.memo(function SupervisorField({
  supervisorName,
  options,
  disabled,
  invalid,
  onSelect,
}: {
  supervisorName: string;
  options: EmployeeOption[];
  disabled: boolean;
  invalid?: boolean;
  onSelect: (supervisorId: number, supervisorName: string) => void;
}) {
  const value = useMemo(
    () => options.find((option) => option.employeeName === supervisorName) || null,
    [options, supervisorName]
  );
  const handleChange = useCallback(
    (option: EmployeeOption | null) => {
      onSelect(option?.id || 0, option?.employeeName || "");
    },
    [onSelect]
  );
  const styles = useMemo(() => buildSelectStyles(Boolean(invalid)), [invalid]);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <User size={14} className="text-slate-400" /> Supervisor <span className="text-red-500">*</span>
      </label>
      <Select<EmployeeOption, false>
        options={options}
        getOptionLabel={getEmployeeLabel}
        getOptionValue={getEmployeeValue}
        value={value}
        onChange={handleChange}
        className="mt-1 text-sm"
        placeholder="Search Supervisor..."
        isSearchable
        isDisabled={disabled}
        styles={styles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const DriverField = React.memo(function DriverField({
  driverName,
  options,
  disabled,
  invalid,
  onSelect,
}: {
  driverName: string;
  options: EmployeeOption[];
  disabled: boolean;
  invalid?: boolean;
  onSelect: (driverId: number, driverName: string) => void;
}) {
  const value = useMemo(
    () => options.find((option) => option.employeeName === driverName) || null,
    [options, driverName]
  );
  const handleChange = useCallback(
    (option: EmployeeOption | null) => {
      onSelect(option?.id || 0, option?.employeeName || "");
    },
    [onSelect]
  );
  const styles = useMemo(() => buildSelectStyles(Boolean(invalid)), [invalid]);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <User size={14} className="text-slate-400" /> Driver <span className="text-red-500">*</span>
      </label>
      <Select<EmployeeOption, false>
        options={options}
        getOptionLabel={getEmployeeLabel}
        getOptionValue={getEmployeeValue}
        value={value}
        onChange={handleChange}
        className="mt-1 text-sm"
        placeholder="Search Driver..."
        isSearchable
        isDisabled={disabled}
        styles={styles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const OpeningMeterField = React.memo(function OpeningMeterField({
  value,
  disabled,
  invalid,
  onChange,
}: {
  value: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );
  const handleWheel = useCallback((event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  }, []);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <Gauge size={14} className="text-slate-400" /> Starting Meter (KM) <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onWheel={handleWheel}
        disabled={disabled}
        className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
          invalid
            ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
            : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
        }`}
        placeholder="0.00"
      />
    </div>
  );
});

const AdvanceField = React.memo(function AdvanceField({
  value,
  disabled,
  invalid,
  onChange,
}: {
  value: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );
  const handleWheel = useCallback((event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  }, []);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <Wallet size={14} className="text-slate-400" /> Advance / Expenses <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onWheel={handleWheel}
        disabled={disabled}
        className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
          invalid
            ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
            : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
        }`}
        placeholder="0.00"
      />
    </div>
  );
});

const HelpersField = React.memo(function HelpersField({
  helpers,
  options,
  disabled,
  invalid,
  onChange,
}: {
  helpers: string[];
  options: EmployeeOption[];
  disabled: boolean;
  invalid?: boolean;
  onChange: (helpers: string[]) => void;
}) {
  const value = useMemo(
    () => options.filter((option) => helpers.includes(option.employeeName)),
    [options, helpers]
  );
  const handleChange = useCallback(
    (selected: readonly EmployeeOption[] | null) => {
      onChange(selected ? selected.map((option) => option.employeeName) : []);
    },
    [onChange]
  );
  const styles = useMemo(() => buildSelectStyles(Boolean(invalid)), [invalid]);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <User size={14} className="text-slate-400" /> Helpers <span className="text-red-500">*</span>
      </label>
      <Select<EmployeeOption, true>
        options={options}
        getOptionLabel={getEmployeeLabel}
        getOptionValue={getEmployeeValue}
        value={value}
        onChange={handleChange}
        className="mt-1 text-sm"
        placeholder="Select helpers..."
        isMulti
        isSearchable
        isDisabled={disabled}
        styles={styles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const LoadersField = React.memo(function LoadersField({
  loaders,
  options,
  disabled,
  invalid,
  onChange,
}: {
  loaders: string[];
  options: EmployeeOption[];
  disabled: boolean;
  invalid?: boolean;
  onChange: (loaders: string[]) => void;
}) {
  const value = useMemo(
    () => options.filter((option) => loaders.includes(option.employeeName)),
    [options, loaders]
  );
  const handleChange = useCallback(
    (selected: readonly EmployeeOption[] | null) => {
      onChange(selected ? selected.map((option) => option.employeeName) : []);
    },
    [onChange]
  );
  const styles = useMemo(() => buildSelectStyles(Boolean(invalid)), [invalid]);

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <User size={14} className="text-amber-500" /> Loaders <span className="text-red-500">*</span>
      </label>
      <Select<EmployeeOption, true>
        options={options}
        getOptionLabel={getEmployeeLabel}
        getOptionValue={getEmployeeValue}
        value={value}
        onChange={handleChange}
        className="mt-1 text-sm"
        placeholder="Select loaders..."
        isMulti
        isSearchable
        isDisabled={disabled}
        styles={styles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

function StepStart({
  tripId,
  startTime,
  startStepSubmitted,
  loadSnapshot,
  updateTrip,
  submitStartStep,
  saveStartProgress,
  hasUnsavedChanges = false,
  vehicleOptions,
  employeeOptions,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
  headerLoading = false,
  subscribeHeaderSaveStatus,
  getHeaderSaveStatus,
}: Props) {
  const [form, setForm] = useState<Step1FormState>(() => tripToForm(loadSnapshot));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<WizardNoticeState>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadedTripIdRef = useRef(tripId);
  const formRef = useRef(form);
  formRef.current = form;

  const driverOptions = useMemo(
    () => employeeOptions.filter((employee) => employee.department === "Driver"),
    [employeeOptions]
  );
  const supervisorOptions = useMemo(
    () => employeeOptions.filter((employee) => employee.department === "Supervisor"),
    [employeeOptions]
  );
  const helperOptions = useMemo(
    () => employeeOptions.filter((employee) => employee.department === "Helper" || employee.department === "Labor"),
    [employeeOptions]
  );
  const loaderOptions = useMemo(
    () => employeeOptions.filter((employee) => employee.department === "Loader"),
    [employeeOptions]
  );

  useEffect(() => {
    if (loadedTripIdRef.current === tripId) return;
    const previousId = loadedTripIdRef.current;
    loadedTripIdRef.current = tripId;

    if (tripId === 0 && previousId !== 0) {
      formRef.current = EMPTY_FORM;
      setForm(EMPTY_FORM);
      return;
    }

    if (previousId === 0 && tripId !== 0 && formHasEdits(formRef.current)) {
      return;
    }

    if (previousId !== tripId) {
      const loadedForm = tripToForm(loadSnapshot);
      formRef.current = loadedForm;
      setForm(loadedForm);
    }
  }, [tripId, loadSnapshot]);

  useEffect(() => {
    updateTrip(formToTripPatch(form));
  }, [form, updateTrip]);

  const patchForm = useCallback((updates: Partial<Step1FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...updates };
      formRef.current = next;
      return next;
    });
  }, []);

  const handleVehicleSelect = useCallback((vehicleId: number, vehicleNo: string) => {
    patchForm({ vehicleId, vehicleNo });
  }, [patchForm]);

  const handleSupervisorSelect = useCallback((supervisorId: number, supervisorName: string) => {
    patchForm({ supervisorId, supervisorName });
  }, [patchForm]);

  const handleDriverSelect = useCallback((driverId: number, driverName: string) => {
    patchForm({ driverId, driverName });
  }, [patchForm]);

  const handleHelpersChange = useCallback((helpers: string[]) => {
    patchForm({ helpers });
  }, [patchForm]);

  const handleLoadersChange = useCallback((loaders: string[]) => {
    patchForm({ loaders });
  }, [patchForm]);

  const handleOpeningMeterChange = useCallback((openingMeterText: string) => {
    patchForm({ openingMeterText });
  }, [patchForm]);

  const handleAdvanceChange = useCallback((advanceText: string) => {
    patchForm({ advanceText });
  }, [patchForm]);

  const fieldInvalid = useMemo(() => {
    if (!showErrors) {
      return {
        vehicle: false,
        supervisor: false,
        driver: false,
        openingMeter: false,
        advance: false,
        helpers: false,
        loaders: false,
      };
    }
    const patch = formToTripPatch(form);
    return {
      vehicle: !patch.vehicleId || !patch.vehicleNo,
      supervisor: !patch.supervisorId || !patch.supervisorName,
      driver: !patch.driverId || !patch.driverName,
      openingMeter: form.openingMeterText.trim() === "" || !Number.isFinite(Number(form.openingMeterText)),
      advance:
        form.advanceText.trim() === "" ||
        !Number.isFinite(Number(form.advanceText)) ||
        Number(form.advanceText) < 0,
      helpers: !patch.helpers || patch.helpers.length === 0,
      loaders: !patch.loaders || patch.loaders.length === 0,
    };
  }, [form, showErrors]);

  const handleFormKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
  }, []);

  const handleCancelEdit = useCallback(() => {
    const isDestructive = (!startStepSubmitted && clearForm) || (editable && onCancel);
    if (isDestructive && hasUnsavedChanges) {
      setShowCancelConfirm(true);
      return;
    }
    if (!startStepSubmitted && clearForm) {
      clearForm();
    } else if (editable && onCancel) {
      onCancel();
    } else {
      setIsLocalEditing(false);
    }
  }, [startStepSubmitted, clearForm, editable, onCancel, hasUnsavedChanges]);

  const handleCancelConfirm = useCallback(() => {
    setShowCancelConfirm(false);
    if (!startStepSubmitted && clearForm) {
      clearForm();
    } else if (editable && onCancel) {
      onCancel();
    } else {
      setIsLocalEditing(false);
    }
  }, [startStepSubmitted, clearForm, editable, onCancel]);

  const inputsLocked = headerLoading || isSubmitting;
  const submitLabel = startStepSubmitted
    ? "Update Start Details"
    : "Submit Start Details";

  const handleSubmit = useCallback(async () => {
    const patch = formToTripPatch(formRef.current);
    const candidate = {
      ...loadSnapshot,
      ...patch,
      tripDate: loadSnapshot.tripDate,
      startStepSubmitted: false,
    } as Trip;
    const validation = validateStartStep(candidate);
    if (!validation.valid) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
    setIsSubmitting(true);
    updateTrip(patch);
    const success = tripId > 0 && startStepSubmitted && saveStartProgress
      ? await saveStartProgress(patch)
      : await submitStartStep(patch);
    if (success) {
      // Keep form values so the form→trip sync effect cannot wipe the submitted trip
      // while the parent advances to Step 2.
      setIsLocalEditing(false);
      setNotice({ type: "success", message: "Start details submitted successfully." });
    } else {
      setNotice({ type: "error", message: "Unable to save start details. Please try again." });
    }
    setIsSubmitting(false);
  }, [loadSnapshot, saveStartProgress, startStepSubmitted, submitStartStep, tripId, updateTrip]);

  const handleSaveProgress = useCallback(async () => {
    if (!saveStartProgress || !tripId) return;
    const patch = formToTripPatch(formRef.current);
    const candidate = { ...loadSnapshot, ...patch } as Trip;
    const validation = validateStartStep(candidate);
    if (!validation.valid) {
      setShowErrors(true);
      setNotice({ type: "error", message: validation.errors[0] || "Please complete required fields." });
      return;
    }
    setIsSubmitting(true);
    const success = await saveStartProgress(patch);
    setNotice(success
      ? { type: "success", message: "Start details saved successfully." }
      : { type: "error", message: "Unable to save. Please try again." });
    setIsSubmitting(false);
  }, [loadSnapshot, saveStartProgress, tripId]);

  if (startStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">TRIP START (AT OFFICE)</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title="Edit Step"
              >
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              Submitted & Locked
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Clock size={12} className="text-slate-500" /> Start Time
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{startTime || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Truck size={12} className="text-blue-500" /> Vehicle No.
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.vehicleNo || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-indigo-500" /> Supervisor
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.supervisorName || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-emerald-500" /> Driver
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.driverName || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Gauge size={12} className="text-purple-500" /> Opening Meter
            </span>
            <span className="text-xs font-bold text-slate-800">
              {loadSnapshot.openingMeter ? `${loadSnapshot.openingMeter} KM` : "--"}
            </span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Wallet size={12} className="text-amber-500" /> Advance / Expenses
            </span>
            <span className="text-xs font-bold text-slate-800">
              ₹{(loadSnapshot.advanceAmount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-slate-500" /> Helpers
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.helpers?.join(", ") || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-amber-500" /> Loaders
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">
              {loadSnapshot.loaders?.join(", ") || "--"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
          <p className="text-xs text-slate-600 font-normal">Start details submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-spinner { -moz-appearance: textfield; appearance: none; }
      `}</style>
      <div
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm"
        onKeyDown={handleFormKeyDown}
      >
        {headerLoading && <p className="text-xs text-slate-500">Loading trip header...</p>}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">TRIP START (AT OFFICE)</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {((editable && startStepSubmitted) || isLocalEditing) && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                Editable View
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-4 sm:gap-y-5">
          <StartTimeField startTime={startTime} />
          <VehicleField
            vehicleId={form.vehicleId}
            options={vehicleOptions}
            disabled={inputsLocked}
            invalid={fieldInvalid.vehicle}
            onSelect={handleVehicleSelect}
          />
          <SupervisorField
            supervisorName={form.supervisorName}
            options={supervisorOptions}
            disabled={inputsLocked}
            invalid={fieldInvalid.supervisor}
            onSelect={handleSupervisorSelect}
          />
          <DriverField
            driverName={form.driverName}
            options={driverOptions}
            disabled={inputsLocked}
            invalid={fieldInvalid.driver}
            onSelect={handleDriverSelect}
          />
          <OpeningMeterField
            value={form.openingMeterText}
            disabled={inputsLocked}
            invalid={fieldInvalid.openingMeter}
            onChange={handleOpeningMeterChange}
          />
          <AdvanceField
            value={form.advanceText}
            disabled={inputsLocked}
            invalid={fieldInvalid.advance}
            onChange={handleAdvanceChange}
          />
          <div className="col-span-1 sm:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <HelpersField
                helpers={form.helpers}
                options={helperOptions}
                disabled={inputsLocked}
                invalid={fieldInvalid.helpers}
                onChange={handleHelpersChange}
              />
              <LoadersField
                loaders={form.loaders}
                options={loaderOptions}
                disabled={inputsLocked}
                invalid={fieldInvalid.loaders}
                onChange={handleLoadersChange}
              />
            </div>
          </div>
        </div>

        <WizardStepNotice notice={notice} dirty={hasUnsavedChanges} />
        <WizardActionBar
          onCancel={handleCancelEdit}
          onSave={tripId > 0 && saveStartProgress ? handleSaveProgress : undefined}
          onSubmit={handleSubmit}
          busy={inputsLocked}
          saveDisabled={!hasUnsavedChanges}
          submitLabel={submitLabel}
        />
      </div>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Discard unsaved changes?"
        message="You have unsaved start details. Leaving will discard them."
        confirmLabel="Yes, Discard"
        cancelLabel="Keep Editing"
        type="warning"
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </>
  );
}

function areStepStartPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.tripId === next.tripId &&
    prev.startTime === next.startTime &&
    prev.startStepSubmitted === next.startStepSubmitted &&
    prev.editable === next.editable &&
    prev.canEdit === next.canEdit &&
    prev.headerLoading === next.headerLoading &&
    prev.vehicleOptions === next.vehicleOptions &&
    prev.employeeOptions === next.employeeOptions &&
    prev.updateTrip === next.updateTrip &&
    prev.submitStartStep === next.submitStartStep &&
    prev.saveStartProgress === next.saveStartProgress &&
    prev.hasUnsavedChanges === next.hasUnsavedChanges &&
    prev.onCancel === next.onCancel &&
    prev.clearForm === next.clearForm &&
    prev.subscribeHeaderSaveStatus === next.subscribeHeaderSaveStatus &&
    prev.getHeaderSaveStatus === next.getHeaderSaveStatus &&
    prev.loadSnapshot === next.loadSnapshot
  );
}

export default React.memo(StepStart, areStepStartPropsEqual);