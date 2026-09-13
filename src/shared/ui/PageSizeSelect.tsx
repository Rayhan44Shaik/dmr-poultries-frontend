import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check, Settings2 } from "lucide-react";
import { useI18n } from "../../i18n";
import { MAX_CUSTOM_PAGE_SIZE } from "./uiTokens";

interface PageSizeSelectProps {
  value: number;
  onChange: (pageSize: number) => void;
  disabled?: boolean;
  className?: string;
}

const PRESET_OPTIONS = [10, 12, 20, 25, 50, 100] as const;
const RANGE_MIN = 5;
const RANGE_MAX = MAX_CUSTOM_PAGE_SIZE; // 500

function clampToRange(raw: number): number {
  if (!Number.isFinite(raw)) return RANGE_MIN;
  return Math.min(RANGE_MAX, Math.max(RANGE_MIN, Math.round(raw)));
}

/**
 * GLOBAL "rows per page" selector — dropdown style like supervisor,
 * same font & color system, with custom option.
 *
 * - Shows preset options: 10, 12, 20, 25, 50, 100
 * - Custom: if current value is not in preset, shows as custom
 * - Selecting "Custom" opens numeric input (5-500) — type 12 and press Enter/Apply
 * - Selecting 12 then "Use this" commits and filters globally (parent resets to page 1)
 * - Same font: text-[13px] font-semibold, color slate-700 / emerald-700 selected
 * - Supervisor-like: rounded-xl, border, shadow, emerald accent
 */
export function PageSizeSelect({ value, onChange, disabled = false, className = "" }: PageSizeSelectProps) {
  const { t } = useI18n();
  const id = useId();
  const safeValue = clampToRange(value);
  const isPreset = (PRESET_OPTIONS as readonly number[]).includes(safeValue);

  const [open, setOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<string>(String(safeValue));
  const [showCustomInput, setShowCustomInput] = useState(!isPreset);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomDraft(String(clampToRange(value)));
    setShowCustomInput(!(PRESET_OPTIONS as readonly number[]).includes(clampToRange(value)));
  }, [value]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const commitCustom = () => {
    const n = Number(customDraft);
    const next = clampToRange(n);
    setCustomDraft(String(next));
    commit(next);
  };

  return (
    <div ref={wrapperRef} className={`relative flex items-center gap-2 ${className}`}>
      <span className="hidden text-[12px] font-semibold tracking-wide text-slate-500 sm:inline uppercase">
        {t("common.rows_per_page")}
      </span>

      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="tabular-nums">{safeValue}</span>
          <span className="flex items-center gap-1 text-slate-400">
            {!isPreset && <Settings2 size={12} className="text-emerald-600" />}
            <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>

        {open && (
          <div className="absolute bottom-full z-50 mb-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-scale-in">
            {/* Header like supervisor */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Rows per page</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Same font & color as supervisor • custom allowed</p>
            </div>

            <div className="max-h-64 overflow-auto p-1.5">
              {PRESET_OPTIONS.map((opt) => {
                const selected = safeValue === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => commit(opt)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                      selected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="tabular-nums">{opt} rows</span>
                    {selected && <Check size={14} className="text-white" />}
                  </button>
                );
              })}

              <div className="my-1.5 h-px bg-slate-100" />

              <button
                type="button"
                onClick={() => setShowCustomInput((v) => !v)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                  !isPreset ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Settings2 size={14} />
                  Custom
                  {!isPreset && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{safeValue}</span>}
                </span>
                <ChevronDown size={12} className={`${showCustomInput ? "rotate-180" : ""} transition-transform`} />
              </button>

              {showCustomInput && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-emerald-700">Custom rows (5–500)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={RANGE_MIN}
                      max={RANGE_MAX}
                      step={1}
                      value={customDraft}
                      onChange={(e) => setCustomDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitCustom();
                        }
                      }}
                      placeholder="e.g. 12"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-bold tabular-nums text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      autoFocus={!isPreset}
                    />
                    <button
                      type="button"
                      onClick={commitCustom}
                      className="h-9 shrink-0 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-700"
                    >
                      Use this
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] font-medium text-slate-500">Select 12 → Use this → filter updates globally</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-[10px] font-medium text-slate-400">
              Global • All modules use same dropdown
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PageSizeSelect;
