// src/modules/operations/vehicle-trips/components/WizardControls.tsx
//
// Shared presentation controls for the Trip Entry wizard steps:
//   • FieldLabel        — soft-coloured icon chip + label + required marker
//   • SearchDropdown    — single-select, Salary-Register-style searchable panel
//   • MultiSearchDropdown — multi-select variant with removable plain-black
//     name chips and green ✓ accents inside the panel
// Purely presentational: no data fetching, no validation, no persistence.

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/** How many option rows are visible before the list scrolls. */
const VISIBLE_ITEMS = 8;
/** Fixed row height so VISIBLE_ITEMS maps to an exact pixel height. */
const ITEM_HEIGHT = 36; // h-9
const LIST_MAX_HEIGHT = VISIBLE_ITEMS * ITEM_HEIGHT;

export type DropdownOption = { value: string; label: string; chipLabel?: string };

/** Soft-coloured icon chip ("logo") shown beside every field label. */
export const FieldLabel = React.memo(function FieldLabel({
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
    <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
      <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={13} />
      </span>
      <span className="truncate">{label}</span>
      {required && <span className="text-red-500">*</span>}
    </label>
  );
});

export function dropdownTriggerClass(invalid: boolean, disabled: boolean): string {
  return [
    "mt-1 w-full rounded-xl border bg-white text-sm font-medium outline-none transition-all text-left",
    disabled
      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
      : invalid
        ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
        : "border-slate-200 hover:border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10",
  ].join(" ");
}

/**
 * Read-only KPI card for the submitted/locked step views (Steps 1 & 2).
 * Tone-consistent icon chip, uppercase label and a bold truncated value.
 * Purely presentational (no coloured top accent bar).
 */
export const StepKpiCard = React.memo(function StepKpiCard({
  icon: Icon,
  tone,
  label,
  value,
  valueClass,
  title,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  /** Icon chip tone, e.g. "bg-sky-50 text-sky-600". */
  tone: string;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div
      className="group relative overflow-hidden bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs transition-all duration-200 hover:shadow-sm hover:border-slate-300/80"
      title={title}
    >
      <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
        <span className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={12} />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className={`block text-sm font-bold text-slate-800 truncate ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
});

const DropdownSearchBox = React.memo(function DropdownSearchBox({
  searchRef,
  query,
  setQuery,
  searchPlaceholder,
}: {
  searchRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (q: string) => void;
  searchPlaceholder: string;
}) {
  return (
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
  );
});

/** Shared dropdown panel behaviour: outside-click close + autofocused search. */
function useDropdownPanel() {
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

  const filtered = useCallback(
    (options: DropdownOption[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return options;
      return options.filter((option) => option.label.toLowerCase().includes(q));
    },
    [query]
  );

  return { open, setOpen, query, setQuery, ref, searchRef, filtered };
}

export const SearchDropdown = React.memo(function SearchDropdown({
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
  const { open, setOpen, query, setQuery, ref, searchRef, filtered } = useDropdownPanel();

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
    [onChange, setOpen, setQuery]
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
          <DropdownSearchBox
            searchRef={searchRef}
            query={query}
            setQuery={setQuery}
            searchPlaceholder={searchPlaceholder}
          />

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
            {filtered(options).map((option) => {
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
            {filtered(options).length === 0 && (
              <li className="px-3 h-9 flex items-center text-xs text-slate-400">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

export const MultiSearchDropdown = React.memo(function MultiSearchDropdown({
  selected: selectedValues,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  invalid,
  onChange,
  chipSummary,
  renderOptionLabel,
}: {
  selected: string[];
  options: DropdownOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (selected: string[]) => void;
  /** When provided, the trigger shows this compact summary instead of one
   *  chip per selected value — use when the selected values are already
   *  rendered elsewhere (e.g. a dedicated box-numbers grid) so they don't
   *  appear twice. */
  chipSummary?: (count: number) => string;
  /** Optional rich label for each list row (e.g. a coloured box-number chip). */
  renderOptionLabel?: (option: DropdownOption) => React.ReactNode;
}) {
  const { open, setOpen, query, setQuery, ref, searchRef, filtered } = useDropdownPanel();

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
        ) : chipSummary ? (
          <span className="inline-flex items-center gap-1.5 px-1.5 text-xs font-semibold text-slate-800">
            <Check size={13} className="text-emerald-600 shrink-0" />
            {chipSummary(selectedValues.length)}
          </span>
        ) : (
          selectedValues.map((value) => {
            const option = options.find((opt) => opt.value === value);
            const label = option?.chipLabel ?? option?.label ?? value;
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
          <DropdownSearchBox
            searchRef={searchRef}
            query={query}
            setQuery={setQuery}
            searchPlaceholder={searchPlaceholder}
          />

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
            {filtered(options).map((option) => {
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
                    {renderOptionLabel ? (
                      renderOptionLabel(option)
                    ) : (
                      <span className="truncate">{option.label}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {filtered(options).length === 0 && (
              <li className="px-3 h-9 flex items-center text-xs text-slate-400">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});
