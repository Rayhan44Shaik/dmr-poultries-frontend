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
  ClipboardList,
  Clock,
  Gauge,
  Truck,
  User,
  Users,
  Wallet,
  Pencil,
} from "lucide-react";
import type { Trip } from "../types/trip";
import { validateStartStep } from "../../../../shared/trip/validation";
import {
  fetchLastClosingMeter,
  fetchNextTripNo,
  formatStartTimeForDisplay,
  formatIstStamp,
} from "../services/tripHeaderApiService";
import { DatePicker } from "../../../../components/common/DatePicker";
import { StepCloseButton, WizardActionBar, type WizardNoticeState } from "./WizardStepUI";
import { TripNoBadge } from "./TripNoBadge";
import { FieldLabel, SearchDropdown, MultiSearchDropdown, StepKpiCard, type DropdownOption } from "./WizardControls";
import { translateValidationMessage } from "../utils/translateValidation";
import {
  TRIP_FIELD_DEFINITIONS,
} from "../../../../shared/trip/definitions";
import { useI18n } from "../../../../i18n";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { localizeTripViewText } from "../utils/tripViewLocalization";
import TripStepConfirmDialog from "./TripStepConfirmDialog";
import { withMinSaveDuration } from "../utils/withMinSaveDuration";

/** Match backend tripNumbering bounds (Asia/Kolkata business calendar). */
const TRIP_DATE_MAX_PAST_DAYS = 730;
const TRIP_DATE_MAX_FUTURE_DAYS = 14;

function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

type VehicleOption = { id: number; vehicleNumber: string; noOfBoxes?: number };
type EmployeeOption = {
  id: number;
  employeeName: string;
  department: string;
  lockedByTripNo?: string | null;
};
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
  /** Bottom Cancel → leave wizard / Create New Trip. */
  onCancel?: () => void;
  /** Header Close while editing a submitted step → back to locked view. */
  onExitEdit?: () => void;
  clearForm?: () => void;
  /** Hide locked-view Close X (Recent / Trip List read-only view). */
  hideWizardClose?: boolean;
  headerLoading?: boolean;
  subscribeHeaderSaveStatus: (listener: () => void) => () => void;
  getHeaderSaveStatus: () => SaveStatus;
}

type Step1FormState = {
  tripDate: string;
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

function formatNumericField(value: number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/** Step 1 opening-meter hint — never render literal "null"/"undefined". */
function formatLastMeterHint(
  t: (key: string, params?: Record<string, string | number>) => string,
  latestMeter: { meter: number; tripNo: string; tripDate: string }
): string {
  const meter = latestMeter.meter;
  const rawNo = latestMeter.tripNo == null ? "" : String(latestMeter.tripNo).trim();
  const no =
    !rawNo || rawNo === "null" || rawNo === "undefined" ? "" : rawNo;
  const rawDate = latestMeter.tripDate == null ? "" : String(latestMeter.tripDate).trim();
  const date =
    !rawDate || rawDate === "null" || rawDate === "undefined" ? "" : rawDate;

  if (no && date) {
    return t("ops.trip.last_trip_reading_hint", { meter, no, date });
  }
  if (date) {
    return t("ops.trip.last_reading_hint_meter_date", { meter, date });
  }
  if (no) {
    return t("ops.trip.last_trip_reading_hint", { meter, no, date: "—" });
  }
  return t("ops.trip.last_reading_hint_meter_only", { meter });
}

function parseNumericField(text: string): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function tripToForm(trip: Trip): Step1FormState {
  return {
    tripDate: trip.tripDate || localTodayYmd(),
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
    form.tripDate ||
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
    tripDate: form.tripDate,
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


// ── Trip date (editable on create and while Step 1 edit mode is open) ────────

const TripDateField = React.memo(function TripDateField({
  tripDate,
  editable,
  disabled,
  language,
  onChange,
}: {
  tripDate: string;
  editable: boolean;
  disabled?: boolean;
  language: "en" | "te";
  onChange?: (date: string) => void;
}) {
  const { t } = useI18n();
  const today = localTodayYmd();
  const minDate = shiftYmd(today, -TRIP_DATE_MAX_PAST_DAYS);
  const maxDate = shiftYmd(today, TRIP_DATE_MAX_FUTURE_DAYS);

  return (
    <div>
      <FieldLabel
        icon={Calendar}
        tone="bg-sky-50/70 text-sky-500"
        label={t("ops.trip.field.trip_date")}
        required={TRIP_FIELD_DEFINITIONS.tripDate.required}
      />
      {editable ? (
        <div className="mt-1">
          <DatePicker
            value={tripDate}
            onChange={(value) => onChange?.(value)}
            language={language}
            disabled={disabled}
            minDate={minDate}
            maxDate={maxDate}
            hideClear
            hideThisWeek
            placeholder={t("ops.trip.select_trip_date")}
            className="w-full text-sm font-medium"
          />
          <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">
            {t("ops.trip.trip_date_number_hint")}
          </p>
        </div>
      ) : (
        <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
          {tripDate || <span className="text-slate-400 font-normal text-xs">--</span>}
        </div>
      )}
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
        tone="bg-blue-50/70 text-blue-500"
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
  onSelect: (vehicleId: number, vehicleNo: string, noOfBoxes?: number) => void;
}) {
  const { t, language } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: String(option.id), label: localizeTripViewText(option.vehicleNumber, language), searchText: option.vehicleNumber || "" })),
    [options, language]
  );
  const handleChange = useCallback(
    (value: string) => {
      const id = Number(value) || 0;
      const option = options.find((o) => o.id === id);
      onSelect(id, option?.vehicleNumber || "", option?.noOfBoxes);
    },
    [options, onSelect]
  );

  return (
    <div>
      <FieldLabel
        icon={Truck}
        tone="bg-blue-50/70 text-blue-500"
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
  const { t, language } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: String(option.id), label: localizeTripViewText(option.employeeName, language), searchText: option.employeeName || "" })),
    [options, language]
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
        tone="bg-indigo-50/70 text-indigo-500"
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
  const { t, language } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () => options.map((option) => ({ value: String(option.id), label: localizeTripViewText(option.employeeName, language), searchText: option.employeeName || "" })),
    [options, language]
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
        tone="bg-emerald-50/70 text-emerald-500"
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
  const { t, language } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () =>
      options.map((option) => {
        const locked = Boolean(option.lockedByTripNo);
        return {
          value: option.employeeName,
          label: localizeTripViewText(option.employeeName, language),
          searchText: option.employeeName || "",
          disabled: locked,
          hint: locked ? `(${option.lockedByTripNo})` : undefined,
        };
      }),
    [options, language]
  );

  return (
    <div>
      <FieldLabel
        icon={Users}
        tone="bg-teal-50/70 text-teal-500"
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
  const { t, language } = useI18n();
  const dropdownOptions = useMemo<DropdownOption[]>(
    () =>
      options.map((option) => {
        const locked = Boolean(option.lockedByTripNo);
        return {
          value: option.employeeName,
          label: localizeTripViewText(option.employeeName, language),
          searchText: option.employeeName || "",
          disabled: locked,
          hint: locked ? `(${option.lockedByTripNo})` : undefined,
        };
      }),
    [options, language]
  );

  return (
    <div>
      <FieldLabel
        icon={Users}
        tone="bg-amber-50/70 text-amber-500"
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
  locked,
  lockRef,
  onChange,
}: {
  value: string;
  disabled: boolean;
  invalid?: boolean;
  error?: string | null;
  latestMeter?: { meter: number; tripNo: string; tripDate: string } | null;
  locked?: boolean;
  lockRef?: string | null;
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
          tone="bg-purple-50/70 text-purple-500"
          label={t("ops.trip.field.opening_meter")}
          required={TRIP_FIELD_DEFINITIONS.openingMeter.required}
        />
        <span className="whitespace-nowrap text-xs font-medium text-slate-400">
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
            ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/10"
            : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10"
        }`}
        placeholder="0.00"
      />
      {locked ? (
        <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="font-semibold">{t("ops.trip.locked_trip_modify")}</div>
          <div>{t("ops.trip.meter_locked_trip", { ref: lockRef ?? "—" })}</div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-500 flex items-start gap-1">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      ) : latestMeter ? (
        // While entering: reference line showing the vehicle's last recorded
        // reading (never auto-filled — the value above is typed by the user).
        <p className="mt-1.5 text-xs font-medium text-slate-400 flex items-start gap-1">
          <span aria-hidden>↳</span>
          <span className="truncate">
            {formatLastMeterHint(t, latestMeter)}
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
        tone="bg-orange-50/70 text-orange-500"
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
            ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/10"
            : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10"
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
  saveStartProgress,
  hasUnsavedChanges = false,
  vehicleOptions,
  employeeOptions,
  editable = false,
  canEdit = false,
  onCancel,
  onExitEdit,
  clearForm,
  hideWizardClose = false,
  headerLoading = false,
}: Props) {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const [form, setForm] = useState<Step1FormState>(() => tripToForm(loadSnapshot));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(Boolean(editable));
  useEffect(() => {
    if (editable) setIsLocalEditing(true);
  }, [editable, tripId]);
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<WizardNoticeState>(null);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: "warning" | "info";
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [latestMeter, setLatestMeter] = useState<{
    meter: number;
    tripNo: string;
    tripDate: string;
  } | null>(null);
  const [previewTripNo, setPreviewTripNo] = useState<string>("");

  const loadedTripIdRef = useRef(tripId);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const submitLockRef = useRef(false);

  // Preview the date sequence for create and date-changing edit.
  useEffect(() => {
    const date = form.tripDate?.trim();
    const originalDate = String(loadSnapshot.tripDate || "").slice(0, 10);
    const dateChangingEdit = tripId > 0 && date !== originalDate;
    if ((tripId > 0 && !dateChangingEdit) || (startStepSubmitted && !isLocalEditing && !editable)) {
      setPreviewTripNo("");
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setPreviewTripNo("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchNextTripNo(date)
        .then((preview) => {
          if (!cancelled) setPreviewTripNo(preview.tripNo);
        })
        .catch(() => {
          if (!cancelled) setPreviewTripNo("");
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editable, form.tripDate, isLocalEditing, loadSnapshot.tripDate, startStepSubmitted, tripId]);

  const handleTripDateChange = useCallback(
    (date: string) => {
      if (!date) return;
      setForm((prev) => ({ ...prev, tripDate: date }));
      updateTrip({ tripDate: date });
    },
    [updateTrip]
  );

  // Opening-meter reference: the vehicle's latest recorded reading. Used for
  // field-level validation only — the backend remains the authority on submit.
  useEffect(() => {
    let cancelled = false;
    if (!form.vehicleId) {
      queueMicrotask(() => { if (!cancelled) setLatestMeter(null); });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => { if (!cancelled) setLatestMeter(null); });
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
            : {
                meter: data.closingMeter,
                tripNo: data.tripNo == null ? "" : String(data.tripNo),
                tripDate: data.tripDate == null ? "" : String(data.tripDate),
              }
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
      const reset = tripToForm(loadSnapshot);
      formRef.current = reset;
      setForm(reset);
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

  const handleVehicleSelect = useCallback((vehicleId: number, vehicleNo: string, noOfBoxes?: number) => {
    patchForm({ vehicleId, vehicleNo });
    const capacity = Number(noOfBoxes) > 0 ? Number(noOfBoxes) : undefined;
    updateTrip({ vehicleId, vehicleNo, vehicleBoxCapacity: capacity });
  }, [patchForm, updateTrip]);

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
    // Locked trips are meter read-only (a later approved same-vehicle fuel /
    // maintenance / trip transaction exists). The banner explains why; the
    // backend rejects direct API writes with 409 regardless of this guard.
    if (loadSnapshot.meterLocked) return;
    patchForm({ openingMeterText });
  }, [patchForm]);

  const handleAdvanceChange = useCallback((advanceText: string) => {
    patchForm({ advanceText });
  }, [patchForm]);

  const fieldInvalid = useMemo(() => {
    const patch = formToTripPatch(form);
    const meterValue = Number(form.openingMeterText);
    const meterNumericBad =
      form.openingMeterText.trim() === "" || !Number.isFinite(meterValue) || meterValue <= 0;
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
      form.openingMeterText.trim() === "" || !Number.isFinite(meterValue) || meterValue <= 0;
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

  /** Bottom Cancel → always leave wizard (Create New Trip). */
  const handleCancelEdit = useCallback(() => {
    setIsLocalEditing(false);
    if (onCancel) {
      onCancel();
      return;
    }
    clearForm?.();
  }, [onCancel, clearForm]);

  /** Header Close while editing submitted step → locked submitted view. */
  const handleExitToLocked = useCallback(() => {
    setIsLocalEditing(false);
    if (onExitEdit) {
      onExitEdit();
      return;
    }
    // Fallback: discard local edits only.
    onCancel?.();
  }, [onExitEdit, onCancel]);

  const inputsLocked = headerLoading || isSubmitting;
  // Backend-computed meter lock: a later approved same-vehicle fuel /
  // maintenance / trip transaction exists. The opening meter renders read-only
  // with the reason; enforcement stays server-side (409 on direct API writes).
  const meterLocked = Boolean(loadSnapshot.meterLocked);
  const meterLockRef =
    typeof loadSnapshot.meterLockReason?.ref === "string"
      ? loadSnapshot.meterLockReason.ref
      : null;
  const submitLabel = startStepSubmitted
    ? "ops.trip.update_start_details"
    : "ops.trip.submit_start_details";

  const runStartSubmit = useCallback(async () => {
    if (submitLockRef.current || isSubmitting || headerLoading) return;
    const patch = formToTripPatch(formRef.current);
    const candidate = {
      ...loadSnapshot,
      ...patch,
      startStepSubmitted: false,
    } as Trip;
    const validation = validateStartStep(candidate);
    if (!validation.valid) {
      setShowErrors(true);
      setNotice({
        type: "error",
        message: translateValidationMessage(t, validation.errors[0]) || t("ops.trip.complete_required_fields"),
      });
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

  const handleSaveProgress = useCallback(async () => {
    if (!saveStartProgress || submitLockRef.current || isSubmitting || headerLoading) return;
    const patch = formToTripPatch(formRef.current);
    const candidate = {
      ...loadSnapshot,
      ...patch,
      startStepSubmitted: false,
    } as Trip;
    const validation = validateStartStep(candidate);
    if (!validation.valid) {
      setShowErrors(true);
      setNotice({
        type: "error",
        message: translateValidationMessage(t, validation.errors[0]) || t("ops.trip.complete_required_fields"),
      });
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    updateTrip(patch);
    try {
      const success = await withMinSaveDuration(() => saveStartProgress(patch));
      if (success) {
        showNotification(t("ops.trip.progress_saved"), "success");
        setNotice(null);
      } else if (tripId <= 0) {
        // Hook already toasts submit_start_first when no trip id exists.
        setNotice(null);
      } else {
        showNotification(t("ops.trip.submission_failed"), "error");
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    saveStartProgress,
    isSubmitting,
    headerLoading,
    loadSnapshot,
    updateTrip,
    showNotification,
    t,
    tripId,
  ]);

  const handleSubmit = useCallback(() => {
    if (submitLockRef.current || isSubmitting || headerLoading) return;
    const patch = formToTripPatch(formRef.current);
    const candidate = {
      ...loadSnapshot,
      ...patch,
      startStepSubmitted: false,
    } as Trip;
    const validation = validateStartStep(candidate);
    if (!validation.valid) {
      setShowErrors(true);
      setNotice({
        type: "error",
        message: translateValidationMessage(t, validation.errors[0]) || t("ops.trip.complete_required_fields"),
      });
      return;
    }

    const isEditMode = tripId > 0 && startStepSubmitted;
    setConfirmation({
      isOpen: true,
      title: isEditMode ? t("ops.trip.update_start_details") : t("ops.trip.submit_start_details"),
      message: isEditMode
        ? t("ops.trip.confirm_update_start")
        : t("ops.trip.confirm_submit_start"),
      confirmLabel: isEditMode ? t("ops.trip.yes_update") : t("ops.trip.yes_create"),
      cancelLabel: t("common.cancel"),
      type: isEditMode ? "info" : "warning",
      onConfirm: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
        void runStartSubmit();
      },
      onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
    });
  }, [
    isSubmitting,
    headerLoading,
    loadSnapshot,
    t,
    tripId,
    startStepSubmitted,
    runStartSubmit,
  ]);

  if (startStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Clock size={18} className="text-indigo-500" />
              {t("ops.trip.title.start")}
            </h3>
            <TripNoBadge tripNo={loadSnapshot.tripNo || tripNo} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Locked / view: Close X → Create New Trip (Trip Entry only) */}
            {!hideWizardClose && (
              <StepCloseButton
                onClose={() => {
                  if (onCancel) onCancel();
                  else clearForm?.();
                }}
                animated
              />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocalEditing(true)}
                className="group relative bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                aria-label={t("ops.trip.edit_step")}
              >
                <Pencil size={14} className={uiActionIconMotionClass.edit} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              {t("ops.trip.submitted_locked")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Time first on locked view, then remaining fields */}
          <StepKpiCard
            icon={Clock}
            tone="bg-blue-50/70 text-blue-500"
            label={t("ops.trip.field.start_time")}
            value={loadSnapshot.startStepSubmittedAt ? formatIstStamp(loadSnapshot.startStepSubmittedAt) : formatStartTimeForDisplay(startTime) || "--"}
          />
          <StepKpiCard
            icon={ClipboardList}
            tone="bg-slate-100 text-slate-500"
            label={t("operations.trip_no")}
            value={loadSnapshot.tripNo || tripNo || "--"}
          />
          <StepKpiCard
            icon={Calendar}
            tone="bg-sky-50/70 text-sky-500"
            label={t("ops.trip.field.trip_date")}
            value={loadSnapshot.tripDate || "--"}
          />
          <StepKpiCard
            icon={Truck}
            tone="bg-blue-50/70 text-blue-500"
            label={t("operations.vehicle_no")}
            value={localizeTripViewText(loadSnapshot.vehicleNo, language) || "--"}
          />
          <StepKpiCard
            icon={User}
            tone="bg-indigo-50/70 text-indigo-500"
            label={t("common.supervisor")}
            value={localizeTripViewText(loadSnapshot.supervisorName, language) || "--"}
          />
          <StepKpiCard
            icon={User}
            tone="bg-emerald-50/70 text-emerald-500"
            label={t("common.driver")}
            value={localizeTripViewText(loadSnapshot.driverName, language) || "--"}
          />
          <StepKpiCard
            icon={Users}
            tone="bg-teal-50/70 text-teal-500"
            label={t("ops.trip.field.helpers")}
            value={localizeTripViewText(loadSnapshot.helpers?.join(", "), language) || "--"}
          />
          <StepKpiCard
            icon={Users}
            tone="bg-amber-50/70 text-amber-500"
            label={t("ops.trip.field.loaders")}
            value={localizeTripViewText(loadSnapshot.loaders?.join(", "), language) || "--"}
          />
          <StepKpiCard
            icon={Gauge}
            tone="bg-purple-50/70 text-purple-500"
            label={t("ops.trip.field.opening_meter")}
            value={
              loadSnapshot.openingMeter == null
                ? t("ops.trip.not_entered")
                : `${loadSnapshot.openingMeter} ${t("common.km")}`
            }
          />
          <StepKpiCard
            icon={Wallet}
            tone="bg-orange-50/70 text-orange-500"
            label={t("operations.advance")}
            value={
              loadSnapshot.advanceAmount == null
                ? t("ops.trip.not_entered")
                : `₹${loadSnapshot.advanceAmount.toLocaleString()}`
            }
          />
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
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Clock size={18} className="text-indigo-500" />
              {t("ops.trip.title.start")}
            </h3>
            <TripNoBadge
              tripNo={previewTripNo || tripNo || loadSnapshot.tripNo}
              provisional={Boolean(previewTripNo)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Part E: no top-right X in first-submit / Edit mode — the bottom
                action bar Cancel is the only cancel affordance. */}
            {((editable && startStepSubmitted) || isLocalEditing) && (
              <>
                {/* Edit mode only: animated Close X → locked submitted view */}
                {startStepSubmitted ? (
                  <StepCloseButton onClose={handleExitToLocked} animated />
                ) : null}
                <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                  {t("ops.trip.editable_view")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Field order: Trip Date, Start Time, Vehicle No., Supervisor, Driver,
            Helpers, Loaders, Advance — Opening Meter LAST. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-4 sm:gap-y-5">
          <TripDateField
            tripDate={form.tripDate || loadSnapshot.tripDate}
            editable={!startStepSubmitted || isLocalEditing || editable}
            disabled={inputsLocked}
            language={language}
            onChange={handleTripDateChange}
          />
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
          <AdvanceField
            value={form.advanceText}
            disabled={inputsLocked}
            invalid={fieldInvalid.advance}
            onChange={handleAdvanceChange}
          />
          {/* Opening Meter stays LAST in Step 1 (after Loaders and Advance). */}
          <OpeningMeterField
            value={form.openingMeterText}
            locked={meterLocked}
            lockRef={meterLockRef}
            disabled={inputsLocked}
            invalid={fieldInvalid.openingMeter}
            error={openingMeterError}
            latestMeter={latestMeter}
            onChange={handleOpeningMeterChange}
          />
        </div>

        <WizardActionBar
          notice={notice}
          dirty={hasUnsavedChanges}
          onCancel={handleCancelEdit}
          onSave={saveStartProgress && tripId > 0 ? handleSaveProgress : undefined}
          onSubmit={handleSubmit}
          busy={inputsLocked}
          saveDisabled={!hasUnsavedChanges && !formHasEdits(form)}
          submitLabel={submitLabel}
        />
      </div>

      <TripStepConfirmDialog
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        type={confirmation.type}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel || (() => setConfirmation((prev) => ({ ...prev, isOpen: false })))}
      />
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
    prev.saveStartProgress === next.saveStartProgress &&
    prev.hasUnsavedChanges === next.hasUnsavedChanges &&
    prev.onCancel === next.onCancel &&
    prev.onExitEdit === next.onExitEdit &&
    prev.clearForm === next.clearForm &&
    prev.subscribeHeaderSaveStatus === next.subscribeHeaderSaveStatus &&
    prev.getHeaderSaveStatus === next.getHeaderSaveStatus &&
    prev.loadSnapshot === next.loadSnapshot
  );
}

export default React.memo(StepStart, areStepStartPropsEqual);
