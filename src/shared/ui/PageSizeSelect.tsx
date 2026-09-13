import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

interface PageSizeSelectProps {
  value: number;
  onChange: (pageSize: number) => void;
  disabled?: boolean;
  className?: string;
}

// Show only 5 at a time: 10,15,20,30,50 — as requested
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50] as const;
const RANGE_MIN = 5;
const RANGE_MAX = 500;

function clampToRange(raw: number): number {
  if (!Number.isFinite(raw)) return RANGE_MIN;
  return Math.min(RANGE_MAX, Math.max(RANGE_MIN, Math.round(raw)));
}

/**
 * GLOBAL Rows per page — 5 options only, supervisor-like neat dropdown
 * - Label: Rows per page
 * - Options: 10,15,20,30,50 (5 at a time)
 * - Supervisor style: rounded-2xl, emerald accent, white bg, shadow-xl, perfectly colour neat
 * - Global level: all modules use same
 */
export function PageSizeSelect({ value, onChange, disabled = false, className = "" }: PageSizeSelectProps) {
  const id = useId();
  const safeValue = clampToRange(value);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (next: number) => {
    const clamped = clampToRange(next);
    if (clamped !== value) onChange(clamped);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative flex items-center gap-2 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rows per page</span>

      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 min-w-[72px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="tabular-nums">{safeValue}</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute bottom-full z-50 mb-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-scale-in">
            {/* Supervisor-like header */}
            <div className="bg-gradient-to-r from-emerald-50 to-white px-3 py-2.5 border-b border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Rows per page</p>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">Supervisor style • neat & perfect</p>
            </div>

            <div className="p-1.5">
              {PAGE_SIZE_OPTIONS.map((opt) => {
                const selected = safeValue === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => commit(opt)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                      selected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="tabular-nums">{opt}</span>
                    {selected && <Check size={14} className="text-white" />}
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50/60 border-t border-slate-100 px-3 py-2 text-[10px] font-medium text-slate-400 text-center">
              Global • 5 options only
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PageSizeSelect;
