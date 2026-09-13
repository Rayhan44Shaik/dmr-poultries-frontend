import { useEffect, useId, useRef, useState, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";
import { MAX_CUSTOM_PAGE_SIZE } from "./uiTokens";

interface PageSizeSelectProps {
  value: number;
  onChange: (pageSize: number) => void;
  disabled?: boolean;
  className?: string;
}

const PRESET_OPTIONS = [10, 12, 20, 25, 50, 100] as const;
const RANGE_MIN = 5;
const RANGE_MAX = MAX_CUSTOM_PAGE_SIZE;

function clampToRange(raw: number): number {
  if (!Number.isFinite(raw)) return RANGE_MIN;
  return Math.min(RANGE_MAX, Math.max(RANGE_MIN, Math.round(raw)));
}

/**
 * GLOBAL page-size dropdown — simple, searchable, custom allowed.
 * - No "Rows per page" message inside
 * - No custom header — just type/search
 * - If typed value not in presets, shows "Use X"
 * - Global level: all modules use same
 */
export function PageSizeSelect({ value, onChange, disabled = false, className = "" }: PageSizeSelectProps) {
  const id = useId();
  const safeValue = clampToRange(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

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

  const filtered = useMemo(() => {
    if (!query.trim()) return PRESET_OPTIONS as readonly number[];
    const q = query.trim().toLowerCase();
    return (PRESET_OPTIONS as readonly number[]).filter((opt) => String(opt).includes(q));
  }, [query]);

  const queryNum = Number(query);
  const isQueryNumeric = query.trim() !== "" && Number.isFinite(queryNum) && queryNum >= RANGE_MIN && queryNum <= RANGE_MAX;
  const queryClamped = isQueryNumeric ? clampToRange(queryNum) : null;
  const showUseThis = isQueryNumeric && !(PRESET_OPTIONS as readonly number[]).includes(queryClamped as number);

  const commit = (next: number) => {
    const clamped = clampToRange(next);
    if (clamped !== value) onChange(clamped);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 min-w-[64px] items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="tabular-nums">{safeValue}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full z-50 mb-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-scale-in">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type e.g. 12"
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[13px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="max-h-56 overflow-auto p-1">
            {filtered.map((opt) => {
              const selected = safeValue === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => commit(opt)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    selected ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="tabular-nums">{opt}</span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}

            {filtered.length === 0 && !showUseThis && (
              <div className="px-2.5 py-3 text-center text-[12px] font-medium text-slate-400">No match</div>
            )}

            {showUseThis && queryClamped != null && (
              <button
                type="button"
                onClick={() => commit(queryClamped)}
                className="mt-1 flex w-full items-center justify-between rounded-lg bg-slate-900 px-2.5 py-2 text-[13px] font-semibold text-white hover:bg-black"
              >
                <span>Use {queryClamped}</span>
                <span className="text-[11px] opacity-80">↩</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PageSizeSelect;
