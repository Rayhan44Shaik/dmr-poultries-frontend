// src/modules/operations/pages/KpiRangeBar.tsx
/* Shown above an analysis page that was opened from a dashboard KPI tile.

   It says which KPI brought you here, which window is applied, which window it
   is being compared against, and lets you flip between the two (or drop the
   deep link entirely) without walking back to the dashboard. The dates live in
   the URL, so the choice survives a refresh or a shared link. */

import { CalendarRange, X } from "lucide-react";

import { useI18n } from "../../../i18n";
import { KPI_LABEL_KEY, type KpiDrill, type KpiWindow } from "../../../shared/kpi/kpiRange";
import { uiCardClass, uiFocusRing, uiTransition } from "../../../shared/ui/uiTokens";

interface KpiRangeBarProps {
  drill: KpiDrill;
  onWindow: (win: KpiWindow) => void;
  onClear: () => void;
}

const SEGMENT_BASE =
  "rounded-md px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap focus:outline-none";

export default function KpiRangeBar({ drill, onWindow, onClear }: KpiRangeBarProps) {
  const { t, language } = useI18n();
  const locale = language === "te" ? "te-IN" : "en-IN";

  const formatDate = (dateKey: string): string => {
    if (!dateKey) return "—";
    const date = new Date(`${dateKey}T00:00:00`);
    if (isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const kpiName = t(KPI_LABEL_KEY[drill.kpi] ?? drill.kpi);
  const windows: Array<{ key: KpiWindow; label: string }> = [
    { key: "current", label: t("ops.analysis.window_current", { days: drill.days }) },
    { key: "previous", label: t("ops.analysis.window_previous", { days: drill.days }) },
  ];

  return (
    <div className={`${uiCardClass} flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <CalendarRange size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-slate-800">
          {kpiName}
          <span className="ml-1.5 font-normal text-slate-400">
            {t("ops.analysis.from_dashboard")}
          </span>
        </p>
        <p className="truncate text-[11.5px] text-slate-500">
          <span className="font-semibold text-slate-700 tabular-nums">
            {formatDate(drill.activeFrom)} → {formatDate(drill.activeTo)}
          </span>
          {drill.compareFrom ? (
            <>
              <span className="mx-1.5 text-slate-300">·</span>
              {t("ops.dashboard.vs_prev", { days: drill.days })}:{" "}
              <span className="tabular-nums">
                {formatDate(drill.compareFrom)} → {formatDate(drill.compareTo)}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {windows.map((win) => {
            const active = drill.win === win.key;
            return (
              <button
                key={win.key}
                type="button"
                onClick={() => onWindow(win.key)}
                aria-pressed={active}
                className={`${SEGMENT_BASE} ${uiTransition} ${uiFocusRing} ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {win.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label={t("ops.analysis.clear_drill")}
          title={t("ops.analysis.clear_drill")}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 ${uiTransition} ${uiFocusRing} hover:bg-slate-100 hover:text-slate-700`}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
