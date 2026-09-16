// src/modules/operations/mortality/components/CumulativeSummary.tsx
// CUMULATIVE SUMMARY — the totals for the WHOLE filtered set, shown BELOW the
// table once a Search filter is applied.
//
// This is deliberately not a page-by-page summary and not a row of KPI cards:
// the server aggregates every matching trip before paging, so the figures here
// stay the same while the operator walks from page 1 to page 53. The scope line
// says so explicitly, and repeats the trip / shop counts the totals are built
// from.
//
// The table mirrors the trip panel's weights section, so the page has one
// reading language: NAME │ BIRDS │ WEIGHT │ %, closed by the survival strip.
// Every label is translated; only the figures stay numeric.

import { Sigma } from "lucide-react";
import type { LossKpis } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";
import { uiAnalysisRowHoverClass, uiAnalysisRowHoverOnTintClass } from "../../../../shared/ui/uiTokens";

interface CumulativeSummaryProps {
  kpis: LossKpis;
  /** Records matching the applied filter — the basis of every total here. */
  totalRecords: number;
  /** Rows per page, used only to explain the scope. */
  pageSize: number;
  /** Localised weight unit, read from the translation table — never hard-coded. */
  weightUnit?: string;
}

export default function CumulativeSummary({ kpis, totalRecords, pageSize, weightUnit = "kg" }: CumulativeSummaryProps) {
  const { t } = useI18n();

  const farmWeight = Math.max(kpis.farmWeight, 1);
  const rows = [
    {
      key: "farm",
      label: t("ops.mortality.detail.farm"),
      birds: formatNumber(kpis.farmBirds),
      weight: formatWeight(kpis.farmWeight, weightUnit),
      pct: "100.00%",
      tone: "text-amber-700",
    },
    {
      key: "delivered",
      label: t("ops.mortality.detail.delivered"),
      birds: formatNumber(kpis.deliveredBirds),
      weight: formatWeight(kpis.deliveredWeight, weightUnit),
      pct: `${((kpis.deliveredWeight / farmWeight) * 100).toFixed(2)}%`,
      tone: "text-sky-700",
    },
    {
      key: "mortality",
      label: t("ops.mortality.detail.mortality"),
      birds: formatNumber(kpis.mortalityCount),
      weight: formatWeight(kpis.mortalityWeight, weightUnit),
      pct: `${kpis.mortalityPercentage.toFixed(2)}%`,
      tone: "text-orange-600",
    },
    {
      key: "loss",
      label: t("ops.mortality.detail.weight_loss"),
      // Loss is a weight-and-percentage figure; it has no bird count of its own.
      birds: <span className="text-slate-300">—</span>,
      weight: formatWeight(kpis.weightLoss, weightUnit),
      pct: `${kpis.weightLossPercentage.toFixed(2)}%`,
      tone: "text-rose-600",
    },
  ];

  const numericHead =
    "w-1/4 border-l border-slate-200 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-900";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-xs shadow-sm md:text-sm">
      {/* Title bar — the same surface as the table it summarises. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-5 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/70 text-emerald-600 shadow-inner">
          <Sigma size={18} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-[15px] font-bold tracking-tight text-slate-800">
            {t("ops.mortality.cumulative.title")}
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white px-2.5 py-[3px] text-[11px] font-bold tabular-nums text-emerald-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("ops.mortality.cumulative.scope", {
              trips: formatNumber(totalRecords),
              shops: formatNumber(kpis.deliveryShops),
            })}
          </span>
        </div>
        <p className="ml-auto hidden text-[11px] font-medium text-slate-400 lg:block">
          {t("ops.mortality.cumulative.hint", { rows: formatNumber(pageSize) })}
        </p>
      </div>

      <table className="w-full table-fixed border-collapse text-[12.5px]">
        <tbody className="divide-y divide-slate-100">
          <tr>
            <th
              scope="col"
              className="w-1/4 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-900"
            >
              {t("common.name")}
            </th>
            <th scope="col" className={numericHead}>
              {t("common.birds")}
            </th>
            <th scope="col" className={numericHead}>
              {t("common.weight")}
            </th>
            <th scope="col" className={numericHead}>
              %
            </th>
          </tr>

          {rows.map((row) => (
            <tr key={row.key} className={uiAnalysisRowHoverClass}>
              <th
                scope="row"
                className="w-1/4 px-3 py-2.5 text-left align-middle text-[12.5px] font-medium text-slate-700"
              >
                {row.label}
              </th>
              <td
                className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-left align-middle font-semibold tabular-nums ${row.tone}`}
              >
                {row.birds}
              </td>
              <td
                className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-left align-middle font-semibold tabular-nums ${row.tone}`}
              >
                {row.weight}
              </td>
              <td
                className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-left align-middle font-semibold tabular-nums ${row.tone}`}
              >
                {row.pct}
              </td>
            </tr>
          ))}

          {/* Survival closes the summary, exactly as it closes the trip panel.
              100 − mortality %: both numbers are the server's. */}
          <tr className={`bg-emerald-50/70 ${uiAnalysisRowHoverOnTintClass}`}>
            <th
              scope="row"
              className="w-1/4 px-3 py-2.5 text-left align-middle text-[10.5px] font-bold uppercase leading-tight tracking-wide text-emerald-700"
            >
              {t("ops.mortality.field.survival_rate")}
            </th>
            <td
              colSpan={3}
              className="px-3 py-2.5 text-left align-middle text-[15px] font-extrabold tabular-nums text-emerald-700"
            >
              {(100 - kpis.mortalityPercentage).toFixed(2)}%
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
