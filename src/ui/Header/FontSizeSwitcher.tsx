import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Minus, Plus, Type } from "lucide-react";
import { useI18n } from "../../i18n";
import { FONT_SCALE_STEPS, useFontSize, type FontScale } from "../../providers/FontSizeProvider";

const SCALE_LABELS: Record<FontScale, string> = {
  1: "100%",
  1.1: "110%",
  1.2: "120%",
  1.3: "130%",
  1.4: "140%",
  1.5: "150%",
};

export default function FontSizeSwitcher() {
  const { t } = useI18n();
  const { scale, canDecrease, canIncrease, setScale, increase, decrease } = useFontSize();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: FontScale) => {
    setScale(next);
    setOpen(false);
  };

  const currentLabel = SCALE_LABELS[scale];
  const buttonClass = `flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors ${
    open
      ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={t("header.changeFontSize")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("header.fontSize")}
        className={buttonClass}
      >
        <Type size={15} className="shrink-0" />
        <span className="hidden whitespace-nowrap sm:inline">{currentLabel}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("header.fontSize")}
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-2 shadow-pop animate-scale-in dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">{t("header.fontSize")}</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {currentLabel}
            </span>
          </div>

          <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-slate-50 p-1 dark:bg-slate-700/40">
            <button
              type="button"
              onClick={decrease}
              disabled={!canDecrease}
              aria-label={t("header.decreaseFontSize")}
              title={t("header.decreaseFontSize")}
              className="flex h-9 flex-1 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <Minus size={16} />
            </button>
            <div className="flex min-w-16 items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-100">
              A
            </div>
            <button
              type="button"
              onClick={increase}
              disabled={!canIncrease}
              aria-label={t("header.increaseFontSize")}
              title={t("header.increaseFontSize")}
              className="flex h-9 flex-1 items-center justify-center rounded-md text-brand-700 transition-colors hover:bg-white hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-35 dark:text-brand-300 dark:hover:bg-slate-700 dark:hover:text-brand-200"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {FONT_SCALE_STEPS.map((step) => {
              const selected = step === scale;
              return (
                <button
                  key={step}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => choose(step)}
                  className={`flex min-h-9 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white"
                  }`}
                >
                  {SCALE_LABELS[step]}
                  {selected && <Check size={13} />}
                </button>
              );
            })}
          </div>

          <p className="mt-2 px-1 text-[10.5px] leading-4 text-slate-400 dark:text-slate-500">
            {t("header.fontSizeHint")}
          </p>
        </div>
      )}
    </div>
  );
}
