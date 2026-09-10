// src/modules/operations/vehicle-trips/components/StepStart.tsx

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Gauge,
  Search,
  Truck,
  User,
  Users,
  Wallet,
  Pencil,
  X,
} from "lucide-react";
import type { Trip } from "../types/trip";
import { validateStartStep } from "../../../../shared/trip/validation";
import {
  fetchLastClosingMeter,
  formatStartTimeForDisplay,
} from "../services/tripHeaderApiService";
import { StepCloseButton, WizardActionBar, WizardStepNotice, type WizardNoticeState } from "./WizardStepUI";
import {
  TRIP_FIELD_DEFINITIONS,
} from "../../../../shared/trip/definitions";
import { useI18n } from "../../../../i18n";

type VehicleOption = { id: number; vehicleNumber: string };
type EmployeeOption = { id: number; employeeName: string; department: string };
type SaveStatus = "idle" | "saving" | "saved";

interface Props {
  tripId: number;
  tripNo?: string;
  startTime: string;
  startStepSubmitted: boolean;
  loadSnapshot: Trip;
  updateTrip: (updates: Partial<Trip>) => void;
  submitStartStep: (data: Partial<Trip>) => Promise<boolean>;
  updateStartStep?: (data: Partial<Trip>) => Promise<boolean>;
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
  if (value === undefined || value === null) return "";
  return String(value);
}

function parseNumericField(text: string): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
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

// ── Shared dropdown panel constants (Salary-Register-style control) ──────────
// Mirrors src/components/common/SearchableSelect.tsx: labelled trigger, an
// in-panel search box, a pinned "clear" row and a scrollable list that shows
// exactly VISIBLE_ITEMS rows at a time.
const VISIBLE_ITEMS = 5;
const ITEM_HEIGHT = 36; // h-9 rows, same as SearchableSelect
const LIST_MAX_HEIGHT = VISIBLE_ITEMS * ITEM_HEIGHT;

type DropdownOption = { value: string; label: string };

/** Soft-coloured icon chip ("logo") shown beside every field label. */
const FieldLabel = React.memo(function FieldLabel({
  icon: Icon,
  tone,
  label,
  required,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
      <span className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={12} />
      </span>
      <span className="truncate">{label}</span>
      {required && <span className="text-red-500">*</span>}
    </label>
  );
});

function dropdownTriggerClass(invalid: boolean, disabled: boolean): string {
  return [
    "mt-1 w-full rounded-xl border bg-white text-sm font-medium outline-none transition-all text-left",
    disabled
      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
      : invalid
        ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
        : "border-slate-200 hover:border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10",
  ].join(" ");
}

const SearchDropdown = React.memo(function SearchDropdown({
  value,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  invalid,
  onChange,
}: {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const pick = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) setQuery("");
          setOpen((o) => !o);
        }}
        className={`${dropdownTriggerClass(Boolean(invalid), disabled)} flex h-[42px] items-center justify-between gap-2 px-4`}
      >
        <span className={`truncate ${selected ? "text-slate-800" : "text-slate-400 font-normal"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[80] mt-1 w-full min-w-[230px] bg-white rounded-xl shadow-xl shadow-slate-200/70 border border-slate-200 overflow-hidden">
          <div className="p-1.5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white border border-slate-200">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Pinned "clear" row — same affordance as the Salary Register filter. */}
          <button
            type="button"
            onClick={() => pick("")}
            className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left border-b border-slate-100 hover:bg-slate-50 transition ${
              !value ? "text-emerald-600 bg-emerald-50/70" : "text-slate-600"
            }`}
          >
            <span className="w-3.5 shrink-0">{!value && <Check size={13} className="text-emerald-600" />}</span>
            <span className="truncate">{placeholder}</span>
          </button>

          <ul
            className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
            style={{ maxHeight: `${LIST_MAX_HEIGHT}px` }}
          >
            {filtered.map((option) => {
              const isSelected = value === option.value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => pick(option.value)}
                    className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left truncate hover:bg-slate-50 transition ${
                      isSelected ? "text-emerald-600 bg-emerald-50/70" : "text-slate-700"
                    }`}
                  >
                    <span className="w-3.5 shrink-0">
                      {isSelected && <Check size={13} className="text-emerald-600" />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 h-9 flex items-center text-xs text-slate-400">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

const MultiSearchDropdown = React.memo(function MultiSearchDropdown({
  selected: selectedValues,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  invalid,
  onChange,
}: {
  selected: string[];
  options: DropdownOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const toggle = useCallback(
    (value: string) => {
      const next = selectedSet.has(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      onChange(next);
    },
    [selectedSet, selectedValues, onChange]
  );

  return (
    <div className="relative" ref={ref}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) setQuery("");
          setOpen((o) => !o);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) setQuery("");
            setOpen((o) => !o);
          }
        }}
        className={`${dropdownTriggerClass(Boolean(invalid), disabled)} flex min-h-[42px] flex-wrap items-center gap-1.5 px-2.5 py-1.5`}
      >
        {selectedValues.length === 0 ? (
          <span className="px-1.5 text-slate-400 font-normal">{placeholder}</span>
        ) : (
          selectedValues.map((value) => {
            const label =
              options.find((option) => option.value === value)?.label || value;
            return (
              <span
                key={value}
                className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-slate-900"
              >
                <span className="max-w-[170px] truncate">{label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(event) => {
                      // Remove only this name — never toggle the dropdown.
                      event.stopPropagation();
                      onChange(selectedValues.filter((v) => v !== value));
                    }}
                    className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${label}`}
                    title={`Remove ${label}`}
                  >
                    <X size={11} strokeWidth={2.75} />
                  </button>
                )}
              </span>
            );
          })
        )}
        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-[80] mt-1 w-full min-w-[230px] bg-white rounded-xl shadow-xl shadow-slate-200/70 border border-slate-200 overflow-hidden">
          <div className="p-1.5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white border border-slate-200">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Pinned "clear all" row */}
          <button
            type="button"
            onClick={() => onChange([])}
            className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left border-b border-slate-100 hover:bg-slate-50 transition ${
              selectedValues.length === 0 ? "text-emerald-600 bg-emerald-50/70" : "text-slate-600"
            }`}
          >
            <span className="w-3.5 shrink-0">
              {selectedValues.length === 0 && <Check size={13} className="text-emerald-600" />}
            </span>
            <span className="truncate">{placeholder}</span>
          </button>

          <ul
            className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
            style={{ maxHeight: `${LIST_MAX_HEIGHT}px` }}
          >
            {filtered.map((option) => {
              const isSelected = selectedSet.has(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => toggle(option.value)}
                    className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left truncate hover:bg-slate-50 transition ${
                      isSelected ? "text-emerald-600 bg-emerald-50/70" : "text-slate-700"
                    }`}
                  >
                    <span className="w-3.5 shrink-0">
                      {isSelected && <Check size={13} className="text-emerald-600" />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 h-9 flex items-center text-xs text-slate-400">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

// ── Read-only computed fields ────────────────────────────────────────────────

const TripDateField = React.memo(function TripDateField({ tripDate }: { tripDate: string }) {
  const { t } = useI18n();
  return (
    <div>
      <FieldLabel
        icon={Calendar}
        tone="bg-sky-50 text-sky-600"
        label={t("ops.trip.field.trip_date")}
        required={TRIP_FIELD_DEFINITIONS.tripDate.required}
      />
      <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
        {tripDate || <span className="text-slate-400 font-normal text-xs">--</span>}
      </div>
    </div>
  );
});

const StartTimeField = React.memo(function StartTimeField({ startTime }: { startTime: string }) {
  const { t } = useI18n();
  const display = useMemo(() => formatStartTimeForDisplay(startTime), [startTime]);
  return (
    <div>
      <FieldLabel
        icon={Clock}
        tone="bg-blue-50 text-blue-600"
        label={t("ops.trip.field.start_time")}
        required={TRIP_FIELD_DEFINITIONS.startTime.required}
      />
      <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
        {display ? (
          display
        ) : (
          <span className="text-slate-400 font-normal text-xs">{t("ops.trip.will_be_captured")}</span>
        )}
      </div>
    </div>
  );
});

// ── Select fields (Salary-Register-style searchable dropdowns) ───────────────

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
  const { t } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: String(option.id), label: option.vehicleNumber || "" })),
    [options]
  );
  const handleChange = useCallback(
    (value: string) => {
      const id = Number(value) || 0;
      const option = options.find((o) => o.id === id);
      onSelect(id, option?.vehicleNumber || "");
    },
    [options, onSelect]
  );

  return (
    <div>
      <FieldLabel
        icon={Truck}
        tone="bg-blue-50 text-blue-600"
        label={t("operations.vehicle_no")}
        required={TRIP_FIELD_DEFINITIONS.vehicleId.required}
      />
      <SearchDropdown
        value={vehicleId ? String(vehicleId) : ""}
        options={dropdownOptions}
        placeholder={t("ops.trip.search_vehicle")}
        searchPlaceholder={t("ops.trip.search_vehicle")}
        disabled={disabled}
        invalid={invalid}
        onChange={handleChange}
      />
    </div>
  );
});

const SupervisorField = React.memo(function SupervisorField({
  supervisorId,
  options,
  disabled,
  invalid,
  onSelect,
}: {
  supervisorId: number;
  options: EmployeeOption[];
  disabled: boolean;
  invalid?: boolean;
  onSelect: (supervisorId: number, supervisorName: string) => void;
}) {
  const { t } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: String(option.id), label: option.employeeName || "" })),
    [options]
  );
  const handleChange = useCallback(
    (value: string) => {
      const id = Number(value) || 0;
      const option = options.find((o) => o.id === id);
      onSelect(id, option?.employeeName || "");
    },
    [options, onSelect]
  );

  return (
    <div>
      <FieldLabel
        icon={User}
        tone="bg-indigo-50 text-indigo-600"
        label={t("common.supervisor")}
        required={TRIP_FIELD_DEFINITIONS.supervisorId.required}
      />
      <SearchDropdown
        value={supervisorId ? String(supervisorId) : ""}
        options={dropdownOptions}
        placeholder={t("ops.trip.search_supervisor")}
        searchPlaceholder={t("ops.trip.search_supervisor")}
        disabled={disabled}
        invalid={invalid}
        onChange={handleChange}
      />
    </div>
  );
});

const DriverField = React.memo(function DriverField({
  driverId,
  options,
  disabled,
  invalid,
  onSelect,
}: {
  driverId: number;
  options: EmployeeOption[];
  disabled: boolean;
  invalid?: boolean;
  onSelect: (driverId: number, driverName: string) => void;
}) {
  const { t } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: String(option.id), label: option.employeeName || "" })),
    [options]
  );
  const handleChange = useCallback(
    (value: string) => {
      const id = Number(value) || 0;
      const option = options.find((o) => o.id === id);
      onSelect(id, option?.employeeName || "");
    },
    [options, onSelect]
  );

  return (
    <div>
      <FieldLabel
        icon={User}
        tone="bg-emerald-50 text-emerald-600"
        label={t("common.driver")}
        required={TRIP_FIELD_DEFINITIONS.driverId.required}
      />
      <SearchDropdown
        value={driverId ? String(driverId) : ""}
        options={dropdownOptions}
        placeholder={t("ops.trip.search_driver")}
        searchPlaceholder={t("ops.trip.search_driver")}
        disabled={disabled}
        invalid={invalid}
        onChange={handleChange}
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
  const { t } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: option.employeeName, label: option.employeeName || "" })),
    [options]
  );

  return (
    <div>
      <FieldLabel
        icon={Users}
        tone="bg-teal-50 text-teal-600"
        label={t("ops.trip.field.helpers")}
        required={TRIP_FIELD_DEFINITIONS.helpers.required}
      />
      <MultiSearchDropdown
        selected={helpers}
        options={dropdownOptions}
        placeholder={t("ops.trip.select_helpers")}
        searchPlaceholder={t("ops.trip.select_helpers")}
        disabled={disabled}
        invalid={invalid}
        onChange={onChange}
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
  const { t } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: option.employeeName, label: option.employeeName || "" })),
    [options]
  );

  return (
    <div>
      <FieldLabel
        icon={Users}
        tone="bg-amber-50 text-amber-600"
        label={t("ops.trip.field.loaders")}
        required={TRIP_FIELD_DEFINITIONS.loaders.required}
      />
      <MultiSearchDropdown
        selected={loaders}
        options={dropdownOptions}
        placeholder={t("ops.trip.select_loaders")}
        searchPlaceholder={t("ops.trip.select_loaders")}
        disabled={disabled}
        invalid={invalid}
        onChange={onChange}
      />
    </div>
  );
});

const OpeningMeterField = React.memo(function OpeningMeterField({
  value,
  disabled,
  invalid,
  error,
  latestMeter,
  onChange,
}: {
  value: string;
  disabled: boolean;
  invalid?: boolean;
  error?: string | null;
  latestMeter?: { meter: number; tripNo: string; tripDate: string } | null;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
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
      <div className="flex items-center justify-between gap-2">
        <FieldLabel
          icon={Gauge}
          tone="bg-purple-50 text-purple-600"
          label={t("ops.trip.field.opening_meter")}
          required={TRIP_FIELD_DEFINITIONS.openingMeter.required}
        />
        <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
          {t("ops.trip.enter_manually")}
        </span>
      </div>
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
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600 flex items-start gap-1">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      ) : latestMeter ? (
        // While entering: reference line showing the vehicle's last recorded
        // reading (never auto-filled — the value above is typed by the user).
        <p className="mt-1.5 text-xs font-medium text-slate-400 flex items-start gap-1">
          <span aria-hidden>↳</span>
          <span className="truncate">
            {t("ops.trip.last_trip_reading_hint", {
              meter: latestMeter.meter,
              no: latestMeter.tripNo,
              date: latestMeter.tripDate,
            })}
          </span>
        </p>
      ) : null}
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
  const { t } = useI18n();
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
      <FieldLabel
        icon={Wallet}
        tone="bg-orange-50 text-orange-600"
        label={t("operations.advance")}
        required={TRIP_FIELD_DEFINITIONS.advanceAmount.required}
      />
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

function StepStart({
  tripId,
  tripNo,
  startTime,
  startStepSubmitted,
  loadSnapshot,
  updateTrip,
  submitStartStep,
  updateStartStep,
  hasUnsavedChanges = false,
  vehicleOptions,
  employeeOptions,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
  headerLoading = false,
  subscribeHeaderSaveStatus: _subscribeHeaderSaveStatus,
  getHeaderSaveStatus: _getHeaderSaveStatus,
}: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<Step1FormState>(() => tripToForm(loadSnapshot));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<WizardNoticeState>(null);
  const [latestMeter, setLatestMeter] = useState<{
    meter: number;
    tripNo: string;
    tripDate: string;
  } | null>(null);

  const loadedTripIdRef = useRef(tripId);
  const formRef = useRef(form);
  formRef.current = form;
  const submitLockRef = useRef(false);

  // Opening-meter reference: the vehicle's latest recorded reading. Used for
  // field-level validation only — the backend remains the authority on submit.
  useEffect(() => {
    if (!form.vehicleId) {
      setLatestMeter(null);
      return;
    }
    let cancelled = false;
    setLatestMeter(null);
    // Part L: when editing, the backend excludes this trip's own start/end
    // meter from the lookup. The client-side guard below stays as defence in
    // depth (same rule, both sides) in case a stale row slips through.
    fetchLastClosingMeter(form.vehicleId, tripId > 0 ? tripId : undefined)
      .then((data) => {
        if (cancelled) return;
        if (!data || data.closingMeter == null) {
          setLatestMeter(null);
          return;
        }
        const isCurrentTripMeter =
          tripId > 0 &&
          data.ref != null &&
          (String(data.ref) === String(tripId) || data.tripNo === tripNo);
        const isSelf =
          isCurrentTripMeter &&
          (data.source === "TRIP_START" || data.source === "TRIP_END");
        setLatestMeter(
          isSelf
            ? null
            : { meter: data.closingMeter, tripNo: data.tripNo, tripDate: data.tripDate }
        );
      })
      .catch(() => {
        if (!cancelled) setLatestMeter(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.vehicleId, tripId, tripNo]);

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
    const patch = formToTripPatch(form);
    const meterValue = Number(form.openingMeterText);
    const meterNumericBad =
      form.openingMeterText.trim() !== "" && (!Number.isFinite(meterValue) || meterValue < 0);
    // Field-level live rule: the opening reading cannot be LESS than the
    // vehicle's latest recorded reading (equal is allowed). This is the ONLY
    // field with live validation — all other Step 1 fields only flag after a
    // submit attempt (showErrors), so the user is never shown red borders while
    // simply filling the form. No default is ever pre-filled; the value is
    // always typed by the user.
    const meterBelowLatest =
      form.openingMeterText.trim() !== "" &&
      latestMeter != null &&
      Number.isFinite(meterValue) &&
      meterValue < latestMeter.meter;
    return {
      vehicle: showErrors && (!patch.vehicleId || !patch.vehicleNo),
      supervisor: showErrors && (!patch.supervisorId || !patch.supervisorName),
      driver: showErrors && (!patch.driverId || !patch.driverName),
      // KM / Advance are OPTIONAL — an empty value is valid (saved as NULL).
      // Only a non-empty value that is not a valid non-negative number is flagged.
      openingMeter: (showErrors && meterNumericBad) || meterBelowLatest,
      advance:
        showErrors &&
        form.advanceText.trim() !== "" &&
        (!Number.isFinite(Number(form.advanceText)) || Number(form.advanceText) < 0),
      helpers: showErrors && (!patch.helpers || patch.helpers.length === 0),
      loaders: showErrors && (!patch.loaders || patch.loaders.length === 0),
    };
  }, [form, showErrors, latestMeter]);

  const openingMeterError = useMemo(() => {
    const meterValue = Number(form.openingMeterText);
    const meterNumericBad =
      form.openingMeterText.trim() !== "" && (!Number.isFinite(meterValue) || meterValue < 0);
    if (showErrors && meterNumericBad) {
      return t("ops.trip.invalid_meter_reading");
    }
    if (
      form.openingMeterText.trim() !== "" &&
      latestMeter != null &&
      Number.isFinite(meterValue) &&
      meterValue < latestMeter.meter
    ) {
      const ref = latestMeter.tripNo ? ` (${t("ops.trip.from_trip", { no: latestMeter.tripNo })})` : "";
      return t("ops.trip.meter_must_exceed", { meter: latestMeter.meter, ref });
    }
    return null;
  }, [form.openingMeterText, latestMeter, showErrors, t]);

  const handleFormKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (!startStepSubmitted && clearForm) {
      // Brand-new trip, nothing persisted → close the editor.
      clearForm();
      return;
    }
    // Editing a submitted Step 1: discard unsaved edits. The parent reverts the
    // working copy to the last saved trip and remounts this step (the local
    // `form` re-hydrates from the restored snapshot).
    setIsLocalEditing(false);
    onCancel?.();
  }, [startStepSubmitted, clearForm, onCancel]);

  const inputsLocked = headerLoading || isSubmitting;
  const submitLabel = startStepSubmitted
    ? "ops.trip.update_start_details"
    : "ops.trip.submit_start_details";

  const handleSubmit = useCallback(async () => {
    if (submitLockRef.current || isSubmitting || headerLoading) return;
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
      setNotice({ type: "error", message: validation.errors[0] || t("ops.trip.complete_required_fields") });
      return;
    }

    submitLockRef.current = true;
    setShowErrors(false);
    setNotice(null);
    setIsSubmitting(true);
    updateTrip(patch);
    // Editing an already-submitted Step 1 must re-submit via the existing-trip
    // submit endpoint (updateStartStep) so the step STAYS submitted and the
    // backend re-validates changed resources/meters. saveStartProgress is save
    // mode and would strip start_step_submitted — only used for a NEW trip's
    // manual "Save Progress" button, never for editing a submitted Step 1.
    try {
      const isUpdate = tripId > 0 && startStepSubmitted;
      const success = isUpdate
        ? updateStartStep
          ? await updateStartStep(patch)
          : await submitStartStep(patch)
        : await submitStartStep(patch);
      if (success) {
        setIsLocalEditing(false);
        // First submit: parent toasts and unmounts to Create New Trip.
        if (isUpdate) {
          setNotice({ type: "success", message: t("ops.trip.step1_submitted") });
        }
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [loadSnapshot, submitStartStep, updateStartStep, startStepSubmitted, tripId, updateTrip, t, isSubmitting, headerLoading]);

  if (startStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.trip.title.start").toUpperCase()}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title={t("ops.trip.edit_step")}
              >
                <Pencil size={14} />
              </button>
            )}
            <StepCloseButton onClose={clearForm} />
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              {t("ops.trip.submitted_locked")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              {t("operations.trip_no")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.tripNo || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Calendar size={12} className="text-sky-500" /> {t("ops.trip.field.trip_date")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.tripDate || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Clock size={12} className="text-blue-500" /> {t("ops.trip.field.start_time")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{formatStartTimeForDisplay(startTime) || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Truck size={12} className="text-blue-500" /> {t("operations.vehicle_no")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.vehicleNo || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-indigo-500" /> {t("common.supervisor")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.supervisorName || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-emerald-500" /> {t("common.driver")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.driverName || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Users size={12} className="text-teal-500" /> {t("ops.trip.field.helpers")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{loadSnapshot.helpers?.join(", ") || "--"}</span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Users size={12} className="text-amber-500" /> {t("ops.trip.field.loaders")}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">
              {loadSnapshot.loaders?.join(", ") || "--"}
            </span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Gauge size={12} className="text-purple-500" /> {t("ops.trip.field.opening_meter")}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {loadSnapshot.openingMeter == null
                ? t("ops.trip.not_entered")
                : `${loadSnapshot.openingMeter} KM`}
            </span>
          </div>
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Wallet size={12} className="text-orange-500" /> {t("operations.advance")}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {loadSnapshot.advanceAmount == null
                ? t("ops.trip.not_entered")
                : `₹${loadSnapshot.advanceAmount.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
          <p className="text-xs text-slate-600 font-normal">{t("ops.trip.start_submitted_ok")}</p>
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
        {headerLoading && <p className="text-xs text-slate-500">{t("ops.trip.loading_trip_header")}</p>}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.trip.title.start").toUpperCase()}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Part E: no top-right X in first-submit / Edit mode — the bottom
                action bar Cancel is the only cancel affordance. */}
            {((editable && startStepSubmitted) || isLocalEditing) && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                {tripNo ? t("ops.trip.editing_trip", { no: tripNo }) : t("ops.trip.editable_view")}
              </span>
            )}
          </div>
        </div>

        {/* Field order: Trip Date, Start Time, Vehicle No., Supervisor, Driver,
            Helpers, Loaders, then Opening Meter + Closing Meter (last trip
            reference) and Advance. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-4 sm:gap-y-5">
          <TripDateField tripDate={loadSnapshot.tripDate} />
          <StartTimeField startTime={startTime} />
          <VehicleField
            vehicleId={form.vehicleId}
            options={vehicleOptions}
            disabled={inputsLocked}
            invalid={fieldInvalid.vehicle}
            onSelect={handleVehicleSelect}
          />
          <SupervisorField
            supervisorId={form.supervisorId}
            options={supervisorOptions}
            disabled={inputsLocked}
            invalid={fieldInvalid.supervisor}
            onSelect={handleSupervisorSelect}
          />
          <DriverField
            driverId={form.driverId}
            options={driverOptions}
            disabled={inputsLocked}
            invalid={fieldInvalid.driver}
            onSelect={handleDriverSelect}
          />
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
          <OpeningMeterField
            value={form.openingMeterText}
            disabled={inputsLocked}
            invalid={fieldInvalid.openingMeter}
            error={openingMeterError}
            latestMeter={latestMeter}
            onChange={handleOpeningMeterChange}
          />
          <AdvanceField
            value={form.advanceText}
            disabled={inputsLocked}
            invalid={fieldInvalid.advance}
            onChange={handleAdvanceChange}
          />
        </div>

        <WizardStepNotice notice={notice} dirty={hasUnsavedChanges} />
        <WizardActionBar
          onCancel={handleCancelEdit}
          // Step 1 has NO "Save Progress": opening the page never creates a
          // draft, and Start Details are only persisted on submit.
          onSubmit={handleSubmit}
          busy={inputsLocked}
          saveDisabled={!hasUnsavedChanges}
          submitLabel={submitLabel}
        />
      </div>
    </>
  );
}

function areStepStartPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.tripId === next.tripId &&
    prev.tripNo === next.tripNo &&
    prev.startTime === next.startTime &&
    prev.startStepSubmitted === next.startStepSubmitted &&
    prev.editable === next.editable &&
    prev.canEdit === next.canEdit &&
    prev.headerLoading === next.headerLoading &&
    prev.vehicleOptions === next.vehicleOptions &&
    prev.employeeOptions === next.employeeOptions &&
    prev.updateTrip === next.updateTrip &&
    prev.submitStartStep === next.submitStartStep &&
    prev.hasUnsavedChanges === next.hasUnsavedChanges &&
    prev.onCancel === next.onCancel &&
    prev.clearForm === next.clearForm &&
    prev.subscribeHeaderSaveStatus === next.subscribeHeaderSaveStatus &&
    prev.getHeaderSaveStatus === next.getHeaderSaveStatus &&
    prev.loadSnapshot === next.loadSnapshot
  );
}

export default React.memo(StepStart, areStepStartPropsEqual);
