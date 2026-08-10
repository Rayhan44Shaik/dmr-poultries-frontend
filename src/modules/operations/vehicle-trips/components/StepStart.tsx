// src/modules/operations/vehicle-trips/components/StepStart.tsx

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import { Clock, User, Truck, Gauge, Wallet, Pencil, X, AlertCircle } from "lucide-react";
import Select from "react-select";
import type { Trip } from "../types/trip";

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

const FIELD_SYNC_DELAY_MS = 400;
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

const SaveStatusIndicator = React.memo(function SaveStatusIndicator({
  subscribe,
  getSnapshot,
}: {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SaveStatus;
}) {
  const status = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (status === "saving") {
    return <span className="text-[11px] text-slate-400">Saving...</span>;
  }
  if (status === "saved") {
    return <span className="text-[11px] text-emerald-600">Saved</span>;
  }
  return null;
});

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

const VehicleField = React.memo(function VehicleField({
  vehicleId,
  options,
  disabled,
  onSelect,
}: {
  vehicleId: number;
  options: VehicleOption[];
  disabled: boolean;
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
        styles={selectStyles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const SupervisorField = React.memo(function SupervisorField({
  supervisorName,
  options,
  disabled,
  onSelect,
}: {
  supervisorName: string;
  options: EmployeeOption[];
  disabled: boolean;
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
        styles={selectStyles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const DriverField = React.memo(function DriverField({
  driverName,
  options,
  disabled,
  onSelect,
}: {
  driverName: string;
  options: EmployeeOption[];
  disabled: boolean;
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
        styles={selectStyles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const OpeningMeterField = React.memo(function OpeningMeterField({
  value,
  disabled,
  onChange,
  onValidationChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onValidationChange: (error: string | null) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const error = useMemo(() => {
    if (text.trim() === "") return "Opening KM is required";
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return "Valid Opening KM is required";
    return null;
  }, [text]);
  useEffect(() => onValidationChange(error), [error, onValidationChange]);
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setText(next);
      onChange(next);
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
        value={text}
        onChange={handleChange}
        onWheel={handleWheel}
        disabled={disabled}
        className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
          error
            ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
            : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
        }`}
        placeholder="0.00"
      />
      {error && (
        <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
});

const AdvanceField = React.memo(function AdvanceField({
  value,
  disabled,
  onChange,
  onValidationChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onValidationChange: (error: string | null) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const error = useMemo(() => {
    if (text.trim() === "") return "Advance amount is required";
    const amount = Number(text);
    if (!Number.isFinite(amount)) return "Valid Advance amount is required";
    if (amount < 0) return "Advance amount cannot be negative";
    return null;
  }, [text]);
  useEffect(() => onValidationChange(error), [error, onValidationChange]);
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setText(next);
      onChange(next);
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
        value={text}
        onChange={handleChange}
        onWheel={handleWheel}
        disabled={disabled}
        className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
          error
            ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
            : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
        }`}
        placeholder="0.00"
      />
      {error && (
        <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
});

const HelpersField = React.memo(function HelpersField({
  helpers,
  options,
  disabled,
  onChange,
}: {
  helpers: string[];
  options: EmployeeOption[];
  disabled: boolean;
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

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <User size={14} className="text-slate-400" /> Helpers
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
        styles={selectStyles}
        menuPortalTarget={MENU_PORTAL_TARGET}
      />
    </div>
  );
});

const LoadersField = React.memo(function LoadersField({
  loaders,
  options,
  disabled,
  onChange,
}: {
  loaders: string[];
  options: EmployeeOption[];
  disabled: boolean;
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

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <User size={14} className="text-amber-500" /> Loaders
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
        styles={selectStyles}
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

  const loadedTripIdRef = useRef(tripId);
  const formRef = useRef(form);
  const openingErrorRef = useRef<string | null>("Opening KM is required");
  const advanceErrorRef = useRef<string | null>("Advance amount is required");
  const numericSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const timer = setTimeout(() => {
      updateTrip(formToTripPatch(formRef.current));
    }, FIELD_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form, updateTrip]);

  const patchForm = useCallback((updates: Partial<Step1FormState>) => {
    const next = { ...formRef.current, ...updates };
    formRef.current = next;
    setForm(next);
  }, []);

  const patchNumericField = useCallback(
    (updates: Partial<Step1FormState>) => {
      formRef.current = { ...formRef.current, ...updates };
      if (numericSyncTimerRef.current) clearTimeout(numericSyncTimerRef.current);
      numericSyncTimerRef.current = setTimeout(() => {
        updateTrip(formToTripPatch(formRef.current));
        numericSyncTimerRef.current = null;
      }, FIELD_SYNC_DELAY_MS);
    },
    [updateTrip]
  );

  useEffect(
    () => () => {
      if (numericSyncTimerRef.current) clearTimeout(numericSyncTimerRef.current);
    },
    []
  );

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
    patchNumericField({ openingMeterText });
  }, [patchNumericField]);

  const handleAdvanceChange = useCallback((advanceText: string) => {
    patchNumericField({ advanceText });
  }, [patchNumericField]);

  const handleOpeningValidation = useCallback((error: string | null) => {
    openingErrorRef.current = error;
  }, []);

  const handleAdvanceValidation = useCallback((error: string | null) => {
    advanceErrorRef.current = error;
  }, []);

  const handleFormKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (!startStepSubmitted && clearForm) {
      clearForm();
    } else if (editable && onCancel) {
      onCancel();
    } else {
      setIsLocalEditing(false);
    }
  }, [startStepSubmitted, clearForm, editable, onCancel]);

  const inputsLocked = headerLoading || isSubmitting;
  const submitLabel = isSubmitting
    ? "Saving..."
    : startStepSubmitted
    ? "Update Start Details"
    : "Submit Start Details";

  const handleSubmit = useCallback(async () => {
    if (openingErrorRef.current || advanceErrorRef.current) return;
    if (numericSyncTimerRef.current) {
      clearTimeout(numericSyncTimerRef.current);
      numericSyncTimerRef.current = null;
    }
    setIsSubmitting(true);
    updateTrip(formToTripPatch(formRef.current));
    const success = await submitStartStep({});
    if (success) setIsLocalEditing(false);
    setIsSubmitting(false);
  }, [submitStartStep, updateTrip]);

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
            <SaveStatusIndicator
              subscribe={subscribeHeaderSaveStatus}
              getSnapshot={getHeaderSaveStatus}
            />
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
            onSelect={handleVehicleSelect}
          />
          <SupervisorField
            supervisorName={form.supervisorName}
            options={supervisorOptions}
            disabled={inputsLocked}
            onSelect={handleSupervisorSelect}
          />
          <DriverField
            driverName={form.driverName}
            options={driverOptions}
            disabled={inputsLocked}
            onSelect={handleDriverSelect}
          />
          <OpeningMeterField
            value={form.openingMeterText}
            disabled={inputsLocked}
            onChange={handleOpeningMeterChange}
            onValidationChange={handleOpeningValidation}
          />
          <AdvanceField
            value={form.advanceText}
            disabled={inputsLocked}
            onChange={handleAdvanceChange}
            onValidationChange={handleAdvanceValidation}
          />
          <div className="col-span-1 sm:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <HelpersField
                helpers={form.helpers}
                options={helperOptions}
                disabled={inputsLocked}
                onChange={handleHelpersChange}
              />
              <LoadersField
                loaders={form.loaders}
                options={loaderOptions}
                disabled={inputsLocked}
                onChange={handleLoadersChange}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
          {!startStepSubmitted && !editable && (
            <button
              type="button"
              onClick={clearForm}
              disabled={inputsLocked}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
            >
              Clear Form
            </button>
          )}

          {(editable || isLocalEditing) && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <X size={14} /> Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={inputsLocked}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
          >
            {submitLabel}
          </button>
        </div>
      </div>
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
    prev.onCancel === next.onCancel &&
    prev.clearForm === next.clearForm &&
    prev.subscribeHeaderSaveStatus === next.subscribeHeaderSaveStatus &&
    prev.getHeaderSaveStatus === next.getHeaderSaveStatus &&
    prev.loadSnapshot === next.loadSnapshot
  );
}

export default React.memo(StepStart, areStepStartPropsEqual);