import { useEffect, useId, useState } from "react";
import { useI18n } from "../../i18n";
import { MAX_CUSTOM_PAGE_SIZE } from "./uiTokens";

interface PageSizeSelectProps {
  /** Current rows-per-page. */
  value: number;
  /** Fired with the committed page size. */
  onChange: (pageSize: number) => void;
  disabled?: boolean;
  /** Extra classes for the wrapper. */
  className?: string;
}

/** Inclusive range the slider can select. */
const RANGE_MIN = 5;
const RANGE_MAX = MAX_CUSTOM_PAGE_SIZE; // 500
const RANGE_STEP = 5;

function clampToRange(raw: number): number {
  if (!Number.isFinite(raw)) return RANGE_MIN;
  return Math.min(RANGE_MAX, Math.max(RANGE_MIN, Math.round(raw)));
}

/**
 * GLOBAL "rows per page" selector — a CUSTOM RANGE, not the built-in presets.
 *
 * Replaces the old preset-only dropdown (10 / 20 / 50 / 100) with a free range
 * slider (5–500) plus a numeric input, so an operator can pick ANY count within
 * the range instead of being limited to fixed options. The slider drags in
 * steps of 5; the numeric input accepts any exact whole number (clamped on
 * commit to the same 5–500 range).
 *
 * Used by the shared `<Pagination>` and every module pagination footer, so the
 * same custom-range behaviour is available on every list (Rate Entry, Trip
 * List, Masters, Fleet, Staff, …).
 */
export function PageSizeSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: PageSizeSelectProps) {
  const { t } = useI18n();
  const id = useId();
  const safeValue = clampToRange(value);

  // Local draft for the numeric input so typing "30" isn't clobbered mid-keystroke
  // (the first "3" would otherwise clamp to the 5-minimum before the "0" lands).
  const [draft, setDraft] = useState<string>(String(safeValue));
  useEffect(() => {
    setDraft(String(clampToRange(value)));
  }, [value]);

  const commitFromDraft = () => {
    const n = Number(draft);
    const next = clampToRange(n);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="hidden text-xs font-semibold text-slate-600 sm:inline">
        {t("common.rows_per_page")}
      </span>
      <input
        id={id}
        type="range"
        min={RANGE_MIN}
        max={RANGE_MAX}
        step={RANGE_STEP}
        value={safeValue}
        disabled={disabled}
        aria-label={t("common.rows_per_page")}
        onChange={(event) => {
          const next = clampToRange(Number(event.target.value));
          setDraft(String(next));
          if (next !== value) onChange(next);
        }}
        className="h-2.5 w-24 cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <input
        type="number"
        min={RANGE_MIN}
        max={RANGE_MAX}
        step={1}
        value={draft}
        disabled={disabled}
        aria-label={t("common.rows_per_page")}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitFromDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0"
      />
    </div>
  );
}

export default PageSizeSelect;
