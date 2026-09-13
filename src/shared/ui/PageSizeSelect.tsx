import { useEffect, useId, useRef, useState, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

interface PageSizeSelectProps {
  value: number;
  onChange: (pageSize: number) => void;
  disabled?: boolean;
  className?: string;
}

// Only 5 at a time: 10,15,20,30,50 — as requested, supervisor-like neat
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50] as const;
const RANGE_MIN = 5;
const RANGE_MAX = 500;

function clampToRange(raw: number): number {
  if (!Number.isFinite(raw)) return RANGE_MIN;
  return Math.min(RANGE_MAX, Math.max(RANGE_MIN, Math.round(raw)));
}

/**
 * GLOBAL pagination dropdown — no ROWS per page label, with search + custom Use
 * - Search input at top, type e.g. 12
 * - If not in 5 options, shows Use X
 * - If 5 not there then Use — e.g. type 12 → Use 12
 * - Supervisor-like perfectly colour neat: rounded-2xl, emerald accent, shadow-xl
 * - Global for all modules
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
    if (!query.trim()) return PAGE_SIZE_OPTIONS as readonly number[];
    const q = query.trim().toLowerCase();
    return (PAGE_SIZE_OPTIONS as readonly number[]).filter((opt) => String(opt).includes(q));
  }, [query]);

  const queryNum = Number(query);
  const isQueryNumeric = query.trim() !== "" && Number.isFinite(queryNum) && queryNum >= RANGE_MIN && queryNum <= RANGE_MAX;
  const queryClamped = isQueryNumeric ? clampToRange(queryNum) : null;
  const showUseThis = isQueryNumeric && !(PAGE_SIZE_OPTIONS as readonly number[]).includes(queryClamped as number);

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
        className="inline-flex h-8 min-w-[64px] items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="tabular-nums">{safeValue}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full z-50 mb-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-scale-in">
          <div className="relative p-2 border-b border-slate-100 bg-slate-50/60">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or type custom"
              className="h-8 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-[13px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="max-h-60 overflow-auto p-1.5">
            {filtered.map((opt) => {
              const selected = safeValue === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => commit(opt)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                    selected ? "bg-emerald-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="tabular-nums">{opt}</span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}

            {filtered.length === 0 && !showUseThis && (
              <div className="px-3 py-3 text-center text-[12px] font-medium text-slate-400">No match — type custom</div>
            )}

            {showUseThis && queryClamped != null && (
              <button
                type="button"
                onClick={() => commit(queryClamped)}
                className="mt-1.5 flex w-full items-center justify-between rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-black"
              >
                <span>Use {queryClamped}</span>
                <span className="text-[11px] opacity-70">custom</span>
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white px-3 py-2 text-center">
            <p className="text-[10px] font-medium text-slate-400">5 options • search • custom Use</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PageSizeSelect;
