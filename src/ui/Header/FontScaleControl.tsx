import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "../../i18n";
import { formatFontScale } from "../../providers/fontScale";
import { useFontScale } from "../../providers/fontScaleContext";
import FontScalePicker from "./FontScalePicker";

export default function FontScaleControl() {
  const { t } = useI18n();
  const { scale } = useFontScale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const labelId = useId();
  const value = formatFontScale(scale);

  useEffect(() => {
    if (!open) return undefined;

    const focusCurrentLevel = window.requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLButtonElement>('[data-font-scale-current="true"]')
        ?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusCurrentLevel);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={t("fontScale.current", { value })}
        title={t("fontScale.current", { value })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`dmr-font-scale-trigger flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums transition-colors ${
          open
            ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        }`}
      >
        <span className="text-base font-bold leading-none" aria-hidden="true">A</span>
        <span className="dmr-font-scale-value whitespace-nowrap">{value}</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={labelId}
          className="dmr-font-scale-menu fixed left-4 right-4 top-[calc(4rem+0.5rem)] z-50 rounded-xl border border-slate-200/80 bg-white p-4 shadow-pop dark:border-slate-700 dark:bg-slate-800 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
        >
          <FontScalePicker labelId={labelId} />
        </div>
      ) : null}
    </div>
  );
}
