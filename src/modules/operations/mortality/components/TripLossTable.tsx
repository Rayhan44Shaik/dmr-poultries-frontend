// src/modules/operations/mortality/components/TripLossTable.tsx
// COMPLETED TRIPS — the centrepiece. EVERY ROW = ONE COMPLETED TRIP.
//
// Farm input -> delivery output (shop COUNT only) -> mortality -> weight loss.
// Individual shop names live in the expandable detail, never in this table.
//
// The table shell is ALWAYS rendered. Empty states, loading and the
// pagination footer all live INSIDE it, so the grid never disappears.

import { Fragment, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bird,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Feather,
  Package,
  Percent,
  Route as RouteIcon,
  SearchX,
  Store,
  TrendingDown,
  UserCheck,
  Warehouse,
  Weight,
} from "lucide-react";
import type { LossSort, TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import type { SortBy } from "../services/mortalityAnalysisApi";
import { formatDateShort, formatNumber, formatWeight } from "../../../../utils/format";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import TripLossRowExpand from "./TripLossRowExpand";
import { useI18n } from "../../../../i18n";

interface TripLossTableProps {
  records: TripLossAnalysis[];
  sort: LossSort;
  setSort: (updater: (prev: LossSort) => LossSort) => void;
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
  /** No completed trips exist at all (regardless of current filters). */
  emptyAll?: boolean;
  /** A real filter has been applied via Search (shows "no results for filter" state). */
  filtersApplied?: boolean;
  onReset?: () => void;
}

type Align = "left" | "right" | "center";

type Column = {
  key: string;
  /** i18n key for the header label. Empty = icon-only control column. */
  labelKey?: string;
  /** Hard-coded label used when no i18n key is defined (e.g. unit suffixes). */
  label?: string;
  icon?: typeof Bird;
  /** Colour family for the header glyph chip. */
  tone?: IconTone;
  /** Full-name i18n key shown as a hover tooltip on abbreviated headers. */
  titleKey?: string;
  sortKey?: SortBy;
  align?: Align;
};

/**
 * Header icon tints — each column family owns one colour so the eye can track
 * a metric group across the grid. Written as literal class strings (never
 * interpolated) so Tailwind's scanner always emits them.
 *   indigo  = trip identity      | violet = date
 *   amber   = farm input         | emerald = people
 *   sky     = delivery output    | orange = mortality | rose = weight loss
 */
const ICON_TONES = {
  indigo: "bg-indigo-50 text-indigo-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
} as const;

type IconTone = keyof typeof ICON_TONES;

/**
 * Every column carries a semantically-correct glyph:
 *   Route = trip  · CalendarDays = date · Warehouse = farm · UserCheck = supervisor
 *   Bird  = live birds           · Weight = a weight figure
 *   Store = shops receiving      · Package = delivered goods
 *   Skull = mortality            · TrendingDown = loss · Percent = percentage
 */
const COLUMNS: Column[] = [
  { key: "expand", label: "" },
  { key: "tripNo", labelKey: "table.trip_no", icon: RouteIcon, tone: "indigo", sortKey: "tripNo" },
  { key: "tripDate", labelKey: "common.date", icon: CalendarDays, tone: "violet", sortKey: "tripDate" },
  {
    key: "sourceFarm",
    labelKey: "ops.mortality.col.source_farm",
    titleKey: "ops.trip.source_farm",
    icon: Warehouse,
    tone: "amber",
    sortKey: "sourceFarm",
  },
  { key: "supervisorName", labelKey: "common.supervisor", icon: UserCheck, tone: "emerald", sortKey: "supervisorName" },
  {
    key: "farmBirds",
    labelKey: "ops.mortality.col.farm_birds",
    titleKey: "ops.mortality.kpi.farm_birds",
    icon: Bird,
    tone: "indigo",
    sortKey: "farmBirds",
    align: "right",
  },
  {
    key: "farmWeight",
    labelKey: "ops.mortality.col.farm_weight",
    titleKey: "ops.mortality.kpi.farm_weight",
    icon: Weight,
    tone: "amber",
    sortKey: "farmWeight",
    align: "right",
  },
  {
    key: "deliveryShops",
    labelKey: "ops.mortality.col.delivery_shops",
    titleKey: "ops.mortality.kpi.delivery_shops",
    icon: Store,
    tone: "sky",
    sortKey: "deliveryShops",
    align: "center",
  },
  {
    key: "deliveredBirds",
    labelKey: "ops.mortality.col.delivered_birds",
    titleKey: "ops.mortality.kpi.delivered_birds",
    icon: Bird,
    tone: "sky",
    sortKey: "deliveredBirds",
    align: "right",
  },
  {
    key: "deliveredWeight",
    labelKey: "ops.mortality.col.delivery_weight",
    titleKey: "ops.mortality.kpi.delivery_weight",
    icon: Package,
    tone: "sky",
    sortKey: "deliveredWeight",
    align: "right",
  },
  {
    key: "mortalityCount",
    labelKey: "ops.mortality.col.mortality",
    titleKey: "ops.mortality.kpi.mortality_birds",
    icon: Feather,
    tone: "orange",
    sortKey: "mortalityCount",
    align: "right",
  },
  {
    key: "mortalityWeight",
    labelKey: "ops.mortality.col.mortality_weight",
    titleKey: "ops.mortality.kpi.mortality_weight",
    icon: Weight,
    tone: "orange",
    sortKey: "mortalityWeight",
    align: "right",
  },
  {
    key: "weightLoss",
    labelKey: "ops.mortality.col.weight_loss",
    titleKey: "ops.mortality.kpi.weight_loss",
    icon: TrendingDown,
    tone: "rose",
    sortKey: "weightLoss",
    align: "right",
  },
  {
    key: "weightLossPercentage",
    labelKey: "ops.mortality.col.loss_pct",
    titleKey: "ops.mortality.kpi.weight_loss_pct",
    icon: Percent,
    tone: "rose",
    sortKey: "weightLossPercentage",
    align: "right",
  },
];

const PAGE_SIZE_OPTIONS = [10, 15, 20];

function SortGlyph({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  // Inactive columns still show the up/down pair so every sortable header is
  // discoverable — but in a muted slate rather than the active emerald.
  if (!active) return <ArrowUpDown size={12} className="text-slate-400" />;
  return dir === "asc" ? (
    <ArrowUp size={12} className="text-emerald-600" />
  ) : (
    <ArrowDown size={12} className="text-emerald-600" />
  );
}

export default function TripLossTable({
  records,
  sort,
  setSort,
  page,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  emptyAll = false,
  filtersApplied = false,
  onReset: _onReset,
}: TripLossTableProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSort = (col: Column) => {
    if (!col.sortKey) return;
    setSort((prev) =>
      prev.key === col.sortKey
        ? { key: prev.key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: col.sortKey as SortBy, dir: "desc" }
    );
  };

  const rangeStart = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalRecords);
  const showEmptyAll = !loading && emptyAll;
  const showEmptyFiltered = !loading && filtersApplied && records.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1140px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col)}
                  title={col.titleKey ? t(col.titleKey) : undefined}
                  className={`whitespace-nowrap border-b border-slate-200 px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.sortKey ? "cursor-pointer select-none hover:text-slate-700" : ""}`}
                  aria-sort={
                    col.sortKey && sort.key === col.sortKey
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === "right" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {col.icon && (
                      <span
                        className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ${
                          col.tone ? ICON_TONES[col.tone] : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <col.icon size={11} strokeWidth={2.4} />
                      </span>
                    )}
                    <span>{col.labelKey ? t(col.labelKey) : col.label}</span>
                    {col.sortKey && <SortGlyph active={sort.key === col.sortKey} dir={sort.dir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-[13px]">
            {loading ? (
              <>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={`skeleton-${i}`}>
                    <td colSpan={COLUMNS.length} className="px-3 py-2.5">
                      <div className="h-6 w-full animate-pulse rounded-lg bg-slate-100" />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-3 text-center">
                    <span className="animate-pulse text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {t("ops.mortality.loading")}
                    </span>
                  </td>
                </tr>
              </>
            ) : showEmptyAll ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <SearchX size={18} />
                    </span>
                    <p className="text-[13px] font-semibold text-slate-700">
                      {t("ops.mortality.empty.title")}
                    </p>
                    <p className="max-w-md text-xs text-slate-400">
                      {t("ops.mortality.empty.hint")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : showEmptyFiltered ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-500">
                      <SearchX size={18} />
                    </span>
                    <p className="text-[13px] font-semibold text-slate-700">
                      {t("ops.mortality.empty.filtered_title")}
                    </p>
                    <p className="max-w-md text-xs text-slate-400">
                      {t("ops.mortality.empty.hint")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isOpen = expanded.has(r.tripId);
                return (
                  <Fragment key={r.tripId}>
                    <tr
                      className={`transition-colors hover:bg-slate-50/70 ${
                        isOpen ? "bg-slate-50/60" : ""
                      }`}
                    >
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggle(r.tripId)}
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label={
                            isOpen
                              ? t("ops.mortality.aria.collapse")
                              : t("ops.mortality.aria.expand")
                          }
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="font-semibold tabular-nums text-slate-800">{r.tripNo}</span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {formatDateShort(r.tripDate)}
                      </td>

                      <td className="max-w-[160px] truncate px-3 py-2.5 font-medium text-slate-700">
                        {r.sourceFarm || "—"}
                      </td>

                      <td className="max-w-[150px] truncate px-3 py-2.5 text-slate-600">
                        {r.supervisorName || "—"}
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-700">
                        {formatNumber(r.farmBirds)}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatWeight(r.farmWeight)}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-slate-700">
                          <Store size={11} className="text-sky-600" />
                          {r.deliveryShops}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-sky-700">
                        {formatNumber(r.deliveredBirds)}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-sky-700">
                        {formatWeight(r.deliveredWeight)}
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-orange-600">
                        {formatNumber(r.mortalityCount)}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">
                        {formatWeight(r.mortalityWeight)}
                      </td>

                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-rose-600">
                        {formatWeight(r.weightLoss)}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                        {r.weightLossPercentage.toFixed(2)}%
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="p-0">
                          <TripLossRowExpand record={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* GLOBAL PAGINATION — sorts the FULL filtered set, then paginates.
          When the result set is empty the "Showing …" label renders nothing. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium text-slate-500">
            {totalRecords === 0
              ? ""
              : t("ops.mortality.pagination.showing", {
                  start: formatNumber(rangeStart),
                  end: formatNumber(rangeEnd),
                  total: formatNumber(totalRecords),
                })}
          </p>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="whitespace-nowrap">{t("ops.mortality.pagination.rows_per_page")}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-emerald-400"
              aria-label={t("ops.mortality.pagination.rows_per_page")}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <TripPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          hidePageInfo
        />
      </div>
    </div>
  );
}
