// src/components/common/DatePicker.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
} from "lucide-react";

import {
  addMonths,
  format,
  isValid,
  parse,
  startOfWeek,
  subMonths,
} from "date-fns";

import {
  DayPicker,
  type DropdownProps,
} from "react-day-picker";
import "react-day-picker/style.css";

// ============================================================
// TYPES
// ============================================================

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;

  placeholder?: string;
  disabled?: boolean;
  className?: string;

  label?: string;
  error?: string;
  required?: boolean;

  icon?: React.ReactNode;

  /**
   * Controls calendar popup position.
   * Default = bottom
   */
  placement?: "top" | "bottom";
}


// ============================================================
// MONTH / YEAR DROPDOWN
// ============================================================

function CalendarDropdown({
  value,
  onChange,
  options = [],
  disabled = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find(
    (option) => String(option.value) === String(value)
  );

  // Whenever the visible month/year changes externally (e.g. via the
  // header previous/next buttons) the dropdown panel should close.
  // Adjusting state during render is the recommended pattern here.
  const [syncedValue, setSyncedValue] = useState(
    String(value ?? "")
  );

  if (String(value ?? "") !== syncedValue) {
    setSyncedValue(String(value ?? ""));
    setIsOpen(false);
  }

  // Close when clicking anywhere outside the dropdown.
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={() => setIsOpen((previous) => !previous)}
        className="
          inline-flex
          items-center
          justify-center
          gap-1.5
          rounded-xl
          border
          border-slate-200/80
          bg-white
          px-3
          py-1.5
          text-[13px]
          font-bold
          text-slate-700
          shadow-sm
          transition-all
          hover:border-emerald-300/80
          hover:bg-emerald-50/50
          hover:text-emerald-700
          focus:outline-none
          focus:ring-2
          focus:ring-emerald-500/20
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        <span>
          {currentOption?.label ?? String(value ?? "")}
        </span>

        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-500" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="
            absolute
            left-1/2
            top-[calc(100%+6px)]
            z-[10000]
            w-36
            -translate-x-1/2
            overflow-hidden
            rounded-xl
            border
            border-slate-100
            bg-white
            p-1.5
            shadow-xl
            shadow-slate-300/40
            ring-1
            ring-black/5
          "
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="max-h-52 overflow-y-auto pr-0.5 custom-scrollbar">
            {options.map((option) => {
              const active =
                String(option.value) === String(value);

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    onChange?.({
                      target: {
                        value: option.value,
                      },
                    } as unknown as React.ChangeEvent<HTMLSelectElement>);

                    setIsOpen(false);
                  }}
                  className={`
                    flex
                    w-full
                    items-center
                    justify-between
                    rounded-lg
                    px-3
                    py-2
                    text-left
                    text-[13px]
                    font-semibold
                    transition-colors
                    ${
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  `}
                >
                  <span>{option.label}</span>

                  {active && (
                    <Check className="text-emerald-600" size={14} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN DATE PICKER
// ============================================================

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className = "",
  label,
  error,
  required = false,
  icon,
  placement = "bottom",
}: DatePickerProps) {

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);

  const selectedDate = useMemo(() => {
    if (!value) {
      return undefined;
    }

    const date = new Date(
      `${value}T00:00:00`
    );

    return isValid(date) ? date : undefined;
  }, [value]);

  // Input always shows DD/MM/YYYY (even on first render).
  const [inputValue, setInputValue] = useState(() => {
    if (!value) {
      return "";
    }

    const date = new Date(
      `${value}T00:00:00`
    );

    return isValid(date)
      ? format(date, "dd/MM/yyyy")
      : "";
  });

  // Controlled month used by the calendar.
  const [month, setMonth] = useState<Date>(
    selectedDate || new Date()
  );

  const containerRef =
    useRef<HTMLDivElement>(null);

  const inputRef =
    useRef<HTMLInputElement>(null);

  // ----------------------------------------------------------
  // SYNC VALUE FROM PARENT
  //
  // When the parent's `value` changes externally (e.g. a record is
  // loaded or the form is reset) the input text and the visible
  // month must follow. Adjusting state during render is the
  // recommended pattern here (no flash, no cascading effect).
  // ----------------------------------------------------------

  const [syncedValue, setSyncedValue] =
    useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);

    if (!value) {
      setInputValue("");
    } else {
      const date = new Date(
        `${value}T00:00:00`
      );

      if (isValid(date)) {
        setInputValue(
          format(date, "dd/MM/yyyy")
        );

        setMonth(date);
      }
    }
  }

  // ----------------------------------------------------------
  // OUTSIDE CLICK
  // ----------------------------------------------------------

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (
      event: MouseEvent
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [isOpen]);

  // ----------------------------------------------------------
  // DATE SELECTION
  // ----------------------------------------------------------

  const handleDateSelect = (
    date: Date | undefined
  ) => {
    if (!date || !isValid(date)) {
      onChange("");
      setInputValue("");
      return;
    }

    const formatted =
      format(date, "yyyy-MM-dd");

    const display =
      format(date, "dd/MM/yyyy");

    onChange(formatted);

    setInputValue(display);

    setMonth(date);

    setIsOpen(false);
  };

  // ----------------------------------------------------------
  // INPUT CHANGE
  // ----------------------------------------------------------

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value;

    setInputValue(nextValue);

    // Allow clearing
    if (nextValue === "") {
      onChange("");
      return;
    }

    // Parse DD/MM/YYYY
    if (
      nextValue.length === 10 &&
      nextValue.includes("/")
    ) {
      const parsed = parse(
        nextValue,
        "dd/MM/yyyy",
        new Date()
      );

      if (isValid(parsed)) {
        const formatted =
          format(parsed, "yyyy-MM-dd");

        onChange(formatted);

        setMonth(parsed);
      }
    }
  };

  // ----------------------------------------------------------
  // INPUT BLUR
  // ----------------------------------------------------------

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange("");
      return;
    }

    const parsed = parse(
      inputValue,
      "dd/MM/yyyy",
      new Date()
    );

    if (isValid(parsed)) {
      const formatted =
        format(parsed, "yyyy-MM-dd");

      onChange(formatted);

      setInputValue(
        format(parsed, "dd/MM/yyyy")
      );

      setMonth(parsed);
    } else {
      // Restore valid parent value
      if (value) {
        const currentDate = new Date(
          `${value}T00:00:00`
        );

        if (isValid(currentDate)) {
          setInputValue(
            format(
              currentDate,
              "dd/MM/yyyy"
            )
          );
        }
      } else {
        setInputValue("");
      }
    }
  };

  // ----------------------------------------------------------
  // OPEN CALENDAR
  // ----------------------------------------------------------

  const openCalendar = () => {
    if (disabled) {
      return;
    }

    setIsOpen(true);

    // If a date already exists,
    // always open at that date.
    if (selectedDate) {
      setMonth(selectedDate);
    }
  };

  // ----------------------------------------------------------
  // CLEAR
  // ----------------------------------------------------------

  const clearDate = () => {
    onChange("");

    setInputValue("");

    setIsOpen(false);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // ----------------------------------------------------------
  // TODAY
  // ----------------------------------------------------------

  const handleToday = () => {
    handleDateSelect(new Date());
  };

  // ----------------------------------------------------------
  // SELECT WEEK (starts on Monday)
  // ----------------------------------------------------------

  const handleSelectWeek = () => {
    const start = startOfWeek(
      month,
      {
        weekStartsOn: 1,
      }
    );

    handleDateSelect(start);
  };

  // ----------------------------------------------------------
  // MONTH NAVIGATION
  //
  // Navigation is fully controlled through `month` state.
  // The header buttons update it directly, so every click
  // moves exactly one month reliably.
  // ----------------------------------------------------------

  const goToPreviousMonth = () => {
    setMonth((currentMonth) =>
      subMonths(currentMonth, 1)
    );
  };

  const goToNextMonth = () => {
    setMonth((currentMonth) =>
      addMonths(currentMonth, 1)
    );
  };

  // ----------------------------------------------------------
  // MONTH / YEAR RANGE (for dropdowns)
  // ----------------------------------------------------------

  const currentYear = new Date().getFullYear();

  const startMonth = new Date(
    currentYear - 100,
    0,
    1
  );

  const endMonth = new Date(
    currentYear + 50,
    11,
    31
  );

  // ----------------------------------------------------------
  // POPUP POSITION
  // ----------------------------------------------------------

  const popupPosition =
    placement === "top"
      ? "bottom-[calc(100%+10px)]"
      : "top-[calc(100%+10px)]";

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
    >

      {/* ======================================================
          LABEL
      ======================================================= */}

      {label && (
        <label
          className="
            mb-1.5
            block
            text-sm
            font-medium
            text-slate-700
          "
        >
          {label}

          {required && (
            <span className="ml-1 text-red-500">
              *
            </span>
          )}
        </label>
      )}

      {/* ======================================================
          INPUT
      ======================================================= */}

      <div className="relative">

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={openCalendar}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          className={`
            h-11
            w-full
            rounded-xl
            border
            bg-white
            px-3
            pr-20
            text-sm
            font-medium
            text-slate-800
            outline-none
            transition-all
            shadow-sm
            placeholder:text-slate-400
            hover:border-slate-300

            ${
              error
                ? "border-red-300 focus:border-red-500 focus:ring-[3px] focus:ring-red-500/20 focus:bg-white bg-slate-50/30"
                : "border-slate-200/80 focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/20 focus:bg-white bg-slate-50/30"
            }

            disabled:cursor-not-allowed
            disabled:bg-slate-50
            disabled:text-slate-400
          `}
        />

        {/* Input action buttons */}

        <div
          className="
            absolute
            right-2
            top-1/2
            flex
            -translate-y-1/2
            items-center
            gap-1
          "
        >

          {/* Clear */}

          {value && !disabled && (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={clearDate}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                text-slate-400
                transition
                hover:bg-slate-100
                hover:text-slate-700
              "
              title="Clear date"
              aria-label="Clear date"
            >
              <X size={15} />
            </button>
          )}

          {/* Calendar */}

          <button
            type="button"
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={openCalendar}
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              bg-emerald-50/80
              text-emerald-600
              ring-1
              ring-emerald-200/50
              shadow-sm
              transition-all
              hover:bg-emerald-100
              hover:text-emerald-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
            title="Open calendar"
            aria-label="Open calendar"
          >
            {icon || (
              <CalendarIcon size={16} />
            )}
          </button>
        </div>
      </div>

      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {/* ======================================================
          CALENDAR POPUP
      ======================================================= */}

      {isOpen && !disabled && (
        <div
          className={`
            absolute
            left-0
            ${popupPosition}
            z-[9999]
            w-[340px]
            max-w-[calc(100vw-24px)]
          `}
          role="dialog"
          aria-label="Date picker"
          onMouseDown={(event) => {
            /*
             * Keep the input focused and prevent the outside-click
             * handler from closing the calendar before the clicked
             * control (previous/next month, dropdown, day, Today,
             * This Week) executes.
             */
            event.preventDefault();
            event.stopPropagation();
          }}
        >

          <div className="rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-slate-300/40 ring-1 ring-slate-200/50">

            {/* =================================================
                CALENDAR HEADER
            ================================================== */}

            <div className="rounded-t-2xl border-b border-emerald-700/20 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">

              <div className="flex items-center justify-between">

                {/* Previous month */}

                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={goToPreviousMonth}
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-white/40
                    bg-white
                    text-emerald-600
                    shadow-sm
                    transition-all
                    duration-200
                    hover:bg-emerald-50
                    hover:text-emerald-700
                    hover:shadow-md
                    active:scale-95
                  "
                  title="Previous month"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Current month indicator */}

                <div className="flex flex-col items-center">

                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/90">
                    Select Date
                  </div>

                  <div className="mt-0.5 text-base font-bold tracking-wide text-white">
                    {format(
                      month,
                      "MMMM yyyy"
                    )}
                  </div>
                </div>

                {/* Next month */}

                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={goToNextMonth}
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-white/40
                    bg-white
                    text-emerald-600
                    shadow-sm
                    transition-all
                    duration-200
                    hover:bg-emerald-50
                    hover:text-emerald-700
                    hover:shadow-md
                    active:scale-95
                  "
                  title="Next month"
                  aria-label="Next month"
                >
                  <ChevronRight size={20} />
                </button>

              </div>
            </div>

            {/* =================================================
                DAY PICKER
            ================================================== */}

            <div className="px-4 pb-3 pt-4">

              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}

                /*
                 * Controlled month.
                 * Our header buttons update this directly, so
                 * month navigation is always reliable.
                 */
                month={month}
                onMonthChange={setMonth}

                startMonth={startMonth}
                endMonth={endMonth}

                /*
                 * Keep month/year quick selection dropdowns.
                 */
                captionLayout="dropdown"

                weekStartsOn={1}

                /*
                 * Hide DayPicker's internal navigation entirely.
                 * We render our own header buttons.
                 */
                hideNavigation

                classNames={{
                  months: "w-full",
                  month: "w-full",
                  month_caption: "flex items-center justify-center w-full h-11 mb-1",
                  dropdowns: "flex items-center justify-center gap-2",
                  month_grid: "w-full border-collapse",
                  weekdays: "grid grid-cols-7 mb-1",
                  weekday: "flex h-8 items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400",
                  week: "grid grid-cols-7 gap-y-1",
                  day: "flex h-9 w-full items-center justify-center p-0 text-sm",
                  day_button: "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium text-slate-700 transition-all hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200",
                  selected: "[&_button]:!bg-emerald-600 [&_button]:!text-white [&_button]:font-bold [&_button]:shadow-md [&_button]:shadow-emerald-500/25 [&_button:hover]:!bg-emerald-700 [&_button:hover]:!text-white",
                  today: "[&_button]:border [&_button]:border-emerald-300 [&_button]:bg-emerald-50 [&_button]:text-emerald-700 [&_button]:font-bold",
                  outside: "[&_button]:text-slate-300 [&_button]:opacity-40",
                  disabled: "[&_button]:cursor-not-allowed [&_button]:text-slate-300 [&_button]:opacity-40",
                  hidden: "invisible",
                }}

                components={{
                  Dropdown: CalendarDropdown,
                }}
              />
            </div>

            {/* =================================================
                FOOTER ACTIONS
            ================================================== */}

            <div className="rounded-b-2xl border-t border-slate-100/80 bg-slate-50/50 px-5 py-3.5">

              <div className="flex items-center gap-2">

                {/* Select week */}

                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={handleSelectWeek}
                  className="
                    flex-1
                    rounded-xl
                    border
                    border-emerald-200
                    bg-emerald-50
                    px-4
                    py-2
                    text-xs
                    font-bold
                    text-emerald-700
                    shadow-sm
                    transition-all
                    hover:bg-emerald-100
                    hover:shadow
                    active:scale-95
                  "
                  title="Select this week (starts Monday)"
                >
                  This Week
                </button>

                {/* Today */}

                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={handleToday}
                  className="
                    flex-1
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-4
                    py-2
                    text-xs
                    font-bold
                    text-slate-700
                    shadow-sm
                    transition-all
                    hover:border-slate-300
                    hover:bg-slate-50
                    hover:text-slate-900
                    active:scale-95
                  "
                  title="Select today"
                >
                  Today
                </button>

              </div>

              {/* Selected date */}

              <div className="mt-3.5 flex items-center justify-between px-1">

                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Selected
                </span>

                <span className="text-xs font-bold text-slate-800">
                  {selectedDate
                    ? format(
                        selectedDate,
                        "dd MMM yyyy"
                      )
                    : "No date selected"}
                </span>

              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;