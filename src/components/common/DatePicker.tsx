

import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { format, isValid, parse, startOfWeek } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

// -------- Internal dropdown for month/year picker (unchanged) --------
function CalendarDropdown({ value, onChange, options }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector("[data-active='true']");
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [isOpen]);

  const currentOption = options?.find((o: any) => o.value === value);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg py-1.5 px-2.5 outline-none hover:bg-slate-100 transition shadow-sm min-w-[75px]"
      >
        <span>{currentOption?.label || value}</span>
        <ChevronDown size={13} className="text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute left-0 z-50 mt-1 max-h-[155px] w-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg text-slate-700 scrollbar-thin"
        >
          {options?.map((opt: any) => {
            const isActive = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                data-active={isActive}
                onClick={() => {
                  if (onChange) {
                    onChange({ target: { value: opt.value } } as any);
                  }
                  setIsOpen(false);
                }}
                className={`block w-full text-left rounded-md px-3 py-1.5 text-xs transition ${
                  isActive
                    ? "bg-green-600 font-bold text-white"
                    : "hover:bg-green-50 hover:text-green-700 text-slate-700"
                } disabled:opacity-30`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------- Main DatePicker --------
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
  // Controls where the calendar popup appears relative to the input 
  placement?: "top" | "bottom"; // default "bottom"
}

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
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined;
  const [month, setMonth] = useState<Date>(selectedDate || new Date());

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input display when external value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      if (isValid(d)) {
        setInputValue(format(d, "dd/MM/yyyy"));
        setMonth(d);
      }
    } else {
      setInputValue("");
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handlers
  const handleDateSelect = (date: Date | undefined) => {
    if (date && isValid(date)) {
      const formatted = format(date, "yyyy-MM-dd");
      onChange(formatted);
      setInputValue(format(date, "dd/MM/yyyy"));
      setIsOpen(false);
    } else {
      onChange("");
      setInputValue("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.length === 10 && val.includes("/")) {
      const parsed = parse(val, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        const formatted = format(parsed, "yyyy-MM-dd");
        onChange(formatted);
        setMonth(parsed);
        return;
      }
    }
    if (val === "") {
      onChange("");
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange("");
      return;
    }
    const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      const formatted = format(parsed, "yyyy-MM-dd");
      onChange(formatted);
      setInputValue(format(parsed, "dd/MM/yyyy"));
      setMonth(parsed);
    } else {
      if (value) {
        const d = new Date(value + "T00:00:00");
        if (isValid(d)) {
          setInputValue(format(d, "dd/MM/yyyy"));
        }
      } else {
        setInputValue("");
      }
    }
  };

  const clearDate = () => {
    onChange("");
    setInputValue("");
    setIsOpen(false);
  };

  const handleSelectWeek = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    handleDateSelect(start);
  };

  const viewYear = month.getFullYear();
  const startMonth = new Date(viewYear - 50, 0);
  const endMonth = new Date(viewYear + 50, 11);

  // -------- Placement logic --------
  // We'll use dynamic CSS classes to position the dropdown above or below.
  // "bottom" is default (mt-2) and "top" puts it above (mb-2 + bottom: 100%)
  const dropdownPositionClass =
    placement === "top"
      ? "bottom-[calc(100%+6px)] mb-1"
      : "top-[calc(100%+6px)] mt-1";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-slate-100 disabled:text-slate-400 ${
            error ? "border-red-500" : ""
          }`}
        />

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={clearDate}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 transition"
              title="Clear date"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 transition"
          >
            {icon || <CalendarIcon size={18} className="text-green-600" />}
          </button>
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {isOpen && !disabled && (
        <div
          className={`absolute left-0 z-50 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl select-none text-slate-900 ${dropdownPositionClass}
            [&_table]:w-full [&_table]:border-collapse [&_tr]:h-auto [&_td]:p-0 [&_th]:p-0 [&_th]:pb-2`}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            month={month}
            onMonthChange={setMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            captionLayout="dropdown"
            weekStartsOn={1}
            classNames={{
              months: "relative w-full",
              month: "w-full space-y-2",
              month_caption: "flex justify-center items-center relative h-8 mb-2 w-full",
              dropdowns: "flex justify-center items-center gap-4 text-slate-800 z-10 mx-6",
              nav: "flex items-center",
              button_previous:
                "absolute left-0 top-0.5 h-7 w-7 bg-transparent rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition border border-slate-100",
              button_next:
                "absolute right-0 top-0.5 h-7 w-7 bg-transparent rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition border border-slate-100",
              month_grid: "w-full",
              weekdays: "flex justify-between w-full border-b border-slate-50 pb-1",
              weekday: "text-slate-400 w-8 font-medium text-[0.7rem] uppercase tracking-wider text-center block",
              week: "flex w-full mt-1 justify-between",
              day: "h-8 w-8 p-0 font-normal text-slate-700 rounded-lg hover:bg-green-50 transition flex items-center justify-center text-xs",
              selected:
                "bg-green-600 text-white hover:bg-green-700 hover:text-white focus:bg-green-700 focus:text-white shadow-sm font-semibold",
              today: "bg-green-50 text-green-700 font-bold border border-green-200",
              outside: "text-slate-300 opacity-40",
              disabled: "text-slate-300 opacity-30",
              hidden: "invisible",
            }}
            components={{
              Dropdown: CalendarDropdown,
              Chevron: ({ orientation }) => {
                if (orientation === "left") return <ChevronLeft size={16} />;
                if (orientation === "right") return <ChevronRight size={16} />;
                return <></>;
              },
            }}
          />

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 gap-2">
            <button
              type="button"
              onClick={() => handleSelectWeek(month || new Date())}
              className="flex-1 rounded-lg bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
            >
              Select this week
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                handleDateSelect(today);
                setMonth(today);
              }}
              className="flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}