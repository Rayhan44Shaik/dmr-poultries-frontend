import { Check, Minus, Plus } from "lucide-react";
import { useI18n } from "../../i18n";
import { FONT_SCALE_LEVELS, formatFontScale } from "../../providers/fontScale";
import { useFontScale } from "../../providers/fontScaleContext";

interface FontScalePickerProps {
  labelId?: string;
}

/** Shared level picker used by both the header popover and Appearance settings. */
export default function FontScalePicker({ labelId }: FontScalePickerProps) {
  const { t } = useI18n();
  const { scale, setScale, increase, decrease, canIncrease, canDecrease } = useFontScale();
  const value = formatFontScale(scale);

  return (
    <div aria-labelledby={labelId}>
      <div className="flex items-center justify-between gap-3">
        <p id={labelId} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {t("fontScale.title")}
        </p>
        <output
          className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          aria-live="polite"
          aria-label={t("fontScale.current", { value })}
        >
          {value}
        </output>
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
          type="button"
          onClick={decrease}
          disabled={!canDecrease}
          aria-label={t("fontScale.decrease")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Minus size={17} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 items-baseline justify-center gap-1 text-slate-700 dark:text-slate-100" aria-hidden="true">
          <span className="text-2xl font-semibold leading-none">A</span>
          <span className="text-xs font-medium text-slate-400">{value}</span>
        </div>

        <button
          type="button"
          onClick={increase}
          disabled={!canIncrease}
          aria-label={t("fontScale.increase")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Plus size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label={t("fontScale.levels")}>
        {FONT_SCALE_LEVELS.map((level) => {
          const active = level === scale;
          const label = formatFontScale(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => setScale(level)}
              aria-pressed={active}
              aria-label={t("fontScale.set", { value: label })}
              data-font-scale-current={active ? "true" : undefined}
              className={`relative inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {active ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : null}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
