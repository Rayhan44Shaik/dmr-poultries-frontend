// src/modules/operations/mortality/components/TripLossRowExpand.tsx
// Expandable detail for ONE completed trip — the panel behind the row chevron.
//
// ONE card, ONE table, full width. The three groups are sections stacked inside
// that single table, separated by full-width section rows:
//
//   ┌ TRIP DETAILS ────────────────────────────── [ Completed ] ┐
//   │ TRIP NO      TRP-…-001  │ DAY         Wed, 16 Sep 2026    │
//   │ VEHICLE      TS09UB1074 │ SUPERVISOR  Ravi Rao           │
//   │ DRIVER       Yesu Kumar │ SOURCE FARM Sai Sreenivasa…    │
//   │ LOADERS      Jagadish…  │ HELPERS     Jagadish Rao, …    │
//   ├ WEIGHTS ──────────────────────────────────────────────────┤
//   │ NAME                            BIRDS   WEIGHT        %   │
//   │ Farm                              319  636.09 kg  100.00% │
//   │ …                                                          │
//   ├ RATES ────────────────────────────────────────────────────┤
//   │ SURVIVAL RATE                       97.49%                 │
//   │ MORTALITY %      2.51%   │ LOSS %  2.13%                   │
//   └───────────────────────────────────────────────────────────┘
//
// Four equal columns carry every section: the first column of each half is the
// field name, the next is its data — every cell reads from its own LEFT edge,
// so a value starts right where its name ends instead of being pushed to the
// far side of the cell. Section rows span all four columns, so the card reads
// as one table rather than three boxes with gaps between them.
//
// No shop-wise delivery list here: the shop COUNT already sits on the trip row,
// and shop-level detail lives in the Delivery module where it is actionable.

import { useEffect, useRef, useState } from "react";
import { HeartPulse, Scale, Truck } from "lucide-react";
import type { TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight } from "../../../../utils/format";
import {
  loadScopes,
  loadTabNav,
  selectLoadScope,
  tripLoads,
  type LoadScope,
} from "../utils/mortalityLoads";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { useI18n } from "../../../../i18n";
import { uiAnalysisRowHoverClass, uiAnalysisRowHoverOnTintClass } from "../../../../shared/ui/uiTokens";

/**
 * The line the pointer is on. Every data line in the panel carries it — trip
 * details, weights and rates — so hovering marks exactly the row being read and
 * the label stays with its value.
 */
// Every data line marks itself under the pointer. The band is not defined here:
// it is the shared analysis-row token, the same one the grid and the summary use.

interface TripLossRowExpandProps {
  record: TripLossAnalysis;
  /** Localised weight unit, read from the translation table — never hard-coded. */
  weightUnit?: string;
}

/**
 * Section marks. Each group owns one colour family, so the three blocks stay
 * distinguishable inside the single table:
 *   indigo = the trip · rose = the weights · emerald = the rates.
 */
const SECTION_TILES = {
  indigo: "border-indigo-100 bg-indigo-50/70 text-indigo-500",
  rose: "border-rose-100 bg-rose-50/70 text-rose-500",
  emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-600",
} as const;

type SectionTone = keyof typeof SECTION_TILES;

/** A full-width band that opens a section of the table. */
function SectionRow({
  icon: Icon,
  tone,
  title,
  colSpan,
  action,
}: {
  icon: typeof Truck;
  tone: SectionTone;
  title: string;
  colSpan: number;
  action?: React.ReactNode;
}) {
  return (
    <tr className="bg-slate-50/80">
      <th colSpan={colSpan} scope="colgroup" className="px-3 py-1.5 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-900">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow-inner ${SECTION_TILES[tone]}`}
            >
              <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
            </span>
            {title}
          </span>
          {action}
        </span>
      </th>
    </tr>
  );
}

/** One label │ value pair, filling two of the four columns. */
function Pair({ label, value, tone, rule = true }: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  /** Draw the hairline between this pair's name and its data. */
  rule?: boolean;
}) {
  return (
    <>
      <th
        scope="row"
        className={`w-1/4 px-3 py-2.5 text-left align-middle text-[10.5px] font-bold uppercase leading-tight tracking-wide text-slate-900 ${
          rule ? "border-l border-slate-100" : ""
        }`}
      >
        {label}
      </th>
      <td
        className={`w-1/4 border-l border-slate-200 px-3 py-2.5 text-left align-middle text-[12.5px] font-semibold tabular-nums ${
          tone ?? "text-slate-700"
        }`}
      >
        {value}
      </td>
    </>
  );
}

export default function TripLossRowExpand({ record, weightUnit = "kg" }: TripLossRowExpandProps) {
  const { t, language } = useI18n();
  // Trip data is localised the way the Trip List rows are: names read in Telugu
  // script and the figures stay numeric.
  const view = (value?: string | null) => localizeTripViewText(value, language);
  const crew = (names?: string[]) =>
    names && names.length > 0 ? names.map((name) => view(name)).join(", ") : "—";

  /**
   * Load tabs for multi-load trips. "All Loads" is the exact aggregate main
   * row; a load tab shows only that load's canonical values. Tab state is
   * local — switching never refetches, and a new trip always reopens on All.
   */
  const scopes = loadScopes(record);
  const [scope, setScope] = useState<LoadScope>("all");
  useEffect(() => setScope("all"), [record.tripId]);
  const effectiveScope = scopes.includes(scope) ? scope : "all";
  const figures = selectLoadScope(record, effectiveScope);
  const activeTab = Math.max(0, scopes.indexOf(effectiveScope));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabLabel = (tab: LoadScope) =>
    tab === "all"
      ? t("ops.mortality.load.all")
      : t("ops.mortality.load.number", { number: tab });
  const onTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = loadTabNav(activeTab, scopes.length, event.key);
    if (next === activeTab) return;
    event.preventDefault();
    setScope(scopes[next]);
    requestAnimationFrame(() => tabRefs.current[next]?.focus());
  };

  // Multi-load trips name every submitted load's farm instead of implying one.
  const loadFarms = [...new Set(tripLoads(record).map((load) => load.farmName).filter((name): name is string => !!name?.trim()))];

  /** Trip facts, two pairs per row — trip no + day, vehicle + supervisor, … */
  const detailRows: Array<Array<{ label: string; value: React.ReactNode; tone?: string }>> = [
    [
      { label: t("ops.mortality.field.trip_no"), value: view(record.tripNo), tone: "text-indigo-600" },
      { label: t("ops.trip.day"), value: formatTripListDay(record.tripDate, language) },
    ],
    [
      { label: t("common.vehicle"), value: <span>{view(record.vehicleNo) || "—"}{record.isRentedVehicle ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Rental</span> : null}</span> },
      { label: t("common.supervisor"), value: view(record.supervisorName) || "—" },
    ],
    [
      { label: t("common.driver"), value: view(record.driverName) || "—" },
      {
        label: t("ops.mortality.field.source_farm"),
        value: loadFarms.length > 1 ? loadFarms.map((name) => view(name)).join(" · ") : view(record.sourceFarm) || "—",
      },
    ],
    [
      { label: t("ops.trip.field.loaders"), value: crew(record.loaders) },
      { label: t("ops.trip.field.helpers"), value: crew(record.helpers) },
    ],
  ];

  /**
   * Quantities, one row per measure, with that measure's own percentage — for
   * the selected tab. All Loads is the exact aggregate main row; a load tab
   * shows only that load.
   */
  const weightRows: Array<{ label: string; birds: React.ReactNode; weight: string; pct: string; tone: string }> = [
    {
      label: t("ops.mortality.detail.farm"),
      birds: formatNumber(figures.farmBirds),
      weight: formatWeight(figures.farmWeight, weightUnit),
      pct: "100.00%",
      tone: "text-amber-700",
    },
    {
      label: t("ops.mortality.detail.delivered"),
      birds: formatNumber(figures.deliveredBirds),
      weight: formatWeight(figures.deliveredWeight, weightUnit),
      pct: `${((figures.deliveredWeight / Math.max(figures.farmWeight, 1)) * 100).toFixed(2)}%`,
      tone: "text-sky-700",
    },
    {
      label: t("ops.mortality.tooltip.box_mode"),
      birds: formatNumber(figures.boxMortalityCount),
      weight: formatWeight(figures.boxMortalityWeight, weightUnit),
      pct: figures.farmBirds > 0 ? `${((figures.boxMortalityCount / figures.farmBirds) * 100).toFixed(2)}%` : "0.00%",
      tone: "text-orange-600",
    },
    {
      label: t("ops.mortality.tooltip.weight_mode"),
      birds: formatNumber(figures.weightModeMortalityCount),
      weight: formatWeight(figures.weightModeMortalityWeight, weightUnit),
      pct: figures.farmBirds > 0 ? `${((figures.weightModeMortalityCount / figures.farmBirds) * 100).toFixed(2)}%` : "0.00%",
      tone: "text-violet-600",
    },
    {
      label: t("ops.mortality.detail.mortality"),
      birds: formatNumber(figures.mortalityCount),
      weight: formatWeight(figures.mortalityWeight, weightUnit),
      pct: `${figures.mortalityPercentage.toFixed(2)}%`,
      tone: "text-orange-600",
    },
    {
      label: t("ops.mortality.detail.weight_loss"),
      // Loss is a weight figure; it has no bird count of its own.
      birds: <span className="text-slate-300">—</span>,
      weight: formatWeight(figures.weightLoss, weightUnit),
      pct: `${figures.weightLossPercentage.toFixed(2)}%`,
      tone: "text-rose-600",
    },
  ];

  const numericHead =
    "w-1/4 border-l border-slate-200 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-900";

  return (
    <div className="border-t border-slate-200/80 bg-slate-100/60 px-2 py-2.5">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ── Card header — the trip section, so the table opens straight into
            its first rows. ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5">
          <h4 className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-900">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow-inner ${SECTION_TILES.indigo}`}
            >
              <Truck size={12} strokeWidth={2.4} aria-hidden="true" />
            </span>
            {t("ops.mortality.detail.trip_overview")}
          </h4>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[1px] text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {view(record.status)}
          </span>
        </div>

        <table className="w-full table-fixed border-collapse text-[12.5px]">
          <tbody className="divide-y divide-slate-100">
            {/* ── TRIP DETAILS ─────────────────────────────────────── */}
            {detailRows.map((row, rowIndex) => (
              // The pointer marks the line it is on, so a name and the value it
              // belongs to are read together — the same band the grid uses.
              <tr key={rowIndex} className={uiAnalysisRowHoverClass}>
                {row.map((field, fieldIndex) => (
                  <Pair
                    key={fieldIndex}
                    label={field.label}
                    value={field.value}
                    tone={field.tone}
                    rule={fieldIndex === 1}
                  />
                ))}
              </tr>
            ))}

            {/* ── WEIGHTS ──────────────────────────────────────────── */}
            <SectionRow
              icon={Scale}
              tone="rose"
              title={t("ops.mortality.detail.weight_summary")}
              colSpan={4}
              action={
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {scopes.length > 0 ? (
                    <span
                      role="tablist"
                      aria-label={t("ops.mortality.detail.load_scope")}
                      onKeyDown={onTabsKeyDown}
                      className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
                    >
                      {scopes.map((tab, tabIndex) => {
                        const isActive = tabIndex === activeTab;
                        return (
                          <button
                            key={String(tab)}
                            ref={(element) => {
                              tabRefs.current[tabIndex] = element;
                            }}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => setScope(tab)}
                            className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                              isActive ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {tabLabel(tab)}
                          </button>
                        );
                      })}
                    </span>
                  ) : null}
                  <span className="hidden max-w-xl text-right text-[10px] font-medium normal-case tracking-normal text-slate-400 lg:block">{t("ops.mortality.tooltip.helper")}</span>
                </span>
              }
            />
            <tr>
              <th scope="col" className="w-1/4 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-900">
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
            {weightRows.map((row) => (
              <tr key={row.label} className={uiAnalysisRowHoverClass}>
                <th
                  scope="row"
                  className="w-1/4 px-3 py-2.5 text-left align-middle text-[12.5px] font-medium text-slate-700"
                >
                  {row.label}
                </th>
                <td className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-left align-middle font-semibold tabular-nums ${row.tone}`}>
                  {row.birds}
                </td>
                <td className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-left align-middle font-semibold tabular-nums ${row.tone}`}>
                  {row.weight}
                </td>
                <td className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-left align-middle font-semibold tabular-nums ${row.tone}`}>
                  {row.pct}
                </td>
              </tr>
            ))}

            {/* ── RATES ────────────────────────────────────────────── */}
            <SectionRow
              icon={HeartPulse}
              tone="emerald"
              title={t("ops.mortality.detail.rates")}
              colSpan={4}
            />
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
                {(figures.survivalRate * 100).toFixed(2)}%
              </td>
            </tr>
            <tr className={uiAnalysisRowHoverClass}>
              <Pair
                label={t("ops.mortality.field.mortality_pct")}
                value={`${figures.mortalityPercentage.toFixed(2)}%`}
                tone="text-orange-600"
                rule={false}
              />
              <Pair
                label={t("ops.mortality.field.weight_loss_pct")}
                value={`${figures.weightLossPercentage.toFixed(2)}%`}
                tone="text-rose-600"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
