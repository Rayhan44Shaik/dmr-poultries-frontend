// src/modules/operations/mortality/components/TripLossTable.tsx
// COMPLETED TRIPS — the centrepiece. EVERY ROW = ONE COMPLETED TRIP.
//
// Farm input -> delivery output (shop COUNT only) -> mortality -> weight loss.
// Individual shop names live in the expandable detail, never in this table.
//
// SURFACE — the Trip List table, with a deliberately tighter measure:
//   • one white card with a tinted header bar: brand tile, title and the trip
//     count sitting TOGETHER on the left, where the eye lands first
//   • 12px uppercase column headers, each with its own coloured glyph —
//     the glyph lives in the HEADER ONLY. Trip List rule: identities and
//     metrics are never re-badged on every row, which is what made the grid
//     noisy and wide before.
//   • paired ↑↓ sort arrows on every sortable column
//   • a serial "#" column (which is also the expand affordance)
//   • "Day" — weekday + date — instead of a bare date
//   • one global <Pagination /> footer, never a bespoke pager
//
// The table shell is ALWAYS rendered. Empty states, loading and the pagination
// footer all live INSIDE it, so the grid never disappears.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bird,
  Calendar,
  ChevronDown,
  ChevronRight,
  Feather,
  Hash,
  HeartCrack,
  Percent,
  Scale,
  SearchX,
  ShoppingBag,
  TrendingDown,
  UserCog,
  Warehouse,
} from "lucide-react";
import type { LossSort, TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import type { SortBy } from "../services/mortalityAnalysisApi";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { Pagination } from "../../../../ui";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
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
  /** A later query is in flight behind rows already on screen. The grid keeps
   *  its rows; only the first load (nothing to keep) shows the skeleton. */
  reloading?: boolean;
  /** No completed trips exist at all (regardless of current filters). */
  emptyAll?: boolean;
  /** A real filter has been applied via Search (shows "no results for filter" state). */
  filtersApplied?: boolean;
  onReset?: () => void;
  /** Localised weight unit, e.g. "kg" / "కేజీ". */
  weightUnit?: string;
}

type Align = "left" | "right" | "center";

type Column = {
  key: string;
  /** i18n key for the header label. Empty = icon-only control column. */
  labelKey?: string;
  /** Hard-coded label used when no i18n key is defined (e.g. the serial "#"). */
  label?: string;
  icon?: typeof Bird;
  /** Colour family for the header glyph, written as a literal text colour. */
  tone?: IconTone;
  /** Full-name i18n key shown as a hover tooltip on abbreviated headers. */
  titleKey?: string;
  sortKey?: SortBy;
  align?: Align;
};

/**
 * Header glyph tints — each column family owns one colour so the eye can track
 * a metric group across the grid. Literal class strings (never interpolated) so
 * Tailwind's scanner always emits them.
 *   indigo  = trip identity      | violet = date
 *   amber   = farm input         | emerald = people
 *   sky     = delivery output    | orange = mortality | rose = weight loss
 */
const ICON_TONES = {
  indigo: "text-indigo-500",
  violet: "text-violet-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  sky: "text-sky-500",
  orange: "text-orange-500",
  rose: "text-rose-500",
} as const;

type IconTone = keyof typeof ICON_TONES;

/**
 * Every column carries a semantically-correct glyph:
 *   Hash = trip · Calendar = day · Warehouse = farm · UserCog = supervisor
 *   Bird = live birds · Scale = a weight figure
 *   ShoppingBag = shops receiving · TrendDown = loss · Percent = percentage
 */
const COLUMNS: Column[] = [
  { key: "serial", label: "#", align: "center" },
  { key: "tripNo", labelKey: "table.trip_no", icon: Hash, tone: "indigo", sortKey: "tripNo" },
  { key: "tripDate", labelKey: "ops.trip.day", icon: Calendar, tone: "violet", sortKey: "tripDate" },
  {
    key: "sourceFarm",
    labelKey: "ops.mortality.col.source_farm",
    titleKey: "ops.trip.source_farm",
    icon: Warehouse,
    tone: "amber",
    sortKey: "sourceFarm",
  },
  { key: "supervisorName", labelKey: "common.supervisor", icon: UserCog, tone: "emerald", sortKey: "supervisorName" },
  {
    key: "farmBirds",
    labelKey: "ops.mortality.col.farm_birds",
    titleKey: "ops.mortality.kpi.farm_birds",
    icon: Bird,
    tone: "amber",
    sortKey: "farmBirds",
    align: "center",
  },
  {
    key: "farmWeight",
    labelKey: "ops.mortality.col.farm_weight",
    titleKey: "ops.mortality.kpi.farm_weight",
    icon: Scale,
    tone: "amber",
    sortKey: "farmWeight",
    align: "center",
  },
  {
    key: "deliveryShops",
    labelKey: "ops.mortality.col.delivery_shops",
    titleKey: "ops.mortality.kpi.delivery_shops",
    icon: ShoppingBag,
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
    align: "center",
  },
  {
    key: "deliveredWeight",
    labelKey: "ops.mortality.col.delivery_weight",
    titleKey: "ops.mortality.kpi.delivery_weight",
    icon: Scale,
    tone: "sky",
    sortKey: "deliveredWeight",
    align: "center",
  },
  {
    key: "mortalityCount",
    labelKey: "ops.mortality.col.mortality",
    titleKey: "ops.mortality.kpi.mortality_birds",
    icon: Feather,
    tone: "orange",
    sortKey: "mortalityCount",
    align: "center",
  },
  {
    key: "mortalityWeight",
    labelKey: "ops.mortality.col.mortality_weight",
    titleKey: "ops.mortality.kpi.mortality_weight",
    icon: Scale,
    tone: "orange",
    sortKey: "mortalityWeight",
    align: "center",
  },
  {
    key: "weightLoss",
    labelKey: "ops.mortality.col.weight_loss",
    titleKey: "ops.mortality.kpi.weight_loss",
    icon: TrendingDown,
    tone: "rose",
    sortKey: "weightLoss",
    align: "center",
  },
  {
    key: "weightLossPercentage",
    labelKey: "ops.mortality.col.loss_pct",
    titleKey: "ops.mortality.kpi.weight_loss_pct",
    icon: Percent,
    tone: "rose",
    sortKey: "weightLossPercentage",
    align: "center",
  },
];

/** Paired ↑↓ arrows — identical to the Trip List header indicator. */
function SortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

const alignClass = (align?: Align) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

export default function TripLossTable({
  records,
  sort,
  setSort,
  page,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  reloading = false,
  emptyAll = false,
  filtersApplied,
  weightUnit = "kg",
  onReset,
}: TripLossTableProps) {
  const { t, language } = useI18n();
  /**
   * The trip whose detail panel is open — ONE at a time, so walking the grid with
   * ↑/↓ reads as a single trip after another rather than a pile of open panels.
   */
  const [openTripId, setOpenTripId] = useState<number | null>(null);
  /** Row elements by trip id, so ↑/↓ can move focus down the grid. */
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  /**
   * Width of the VISIBLE table area.
   *
   * The grid has fourteen columns and can therefore be wider than the box that
   * scrolls it. An expanded row is a <td colSpan> inside that same table, so it
   * would inherit that full — partly off-screen — width and push its right-hand
   * half out of view. The panel is pinned to the scroller's left edge and given
   * the measured width instead, so it always fits exactly under the grid.
   */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const sync = () => setPanelWidth(element.clientWidth);
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(
    (id: number) => setOpenTripId((prev) => (prev === id ? null : id)),
    []
  );

  /**
   * Move the grid's attention to another trip: the row takes focus (so the next
   * ↑/↓ starts from here) and, when a panel is open, the panel follows — one trip
   * after another.
   */
  const moveTo = useCallback((next: TripLossAnalysis | undefined, follow: boolean) => {
    if (!next) return;
    if (follow) setOpenTripId(next.tripId);
    requestAnimationFrame(() => rowRefs.current.get(next.tripId)?.focus());
  }, []);

  /**
   * Keyboard contract for the grid — the same one the Trip List table uses:
   *
   *   ↑ / ↓   move to the row above / below, one trip at a time. When a detail
   *           panel is open the panel travels with the focus, so the operator can
   *           read every trip in turn without touching the mouse
   *   Enter   open or close that trip's detail panel (Space does the same)
   *   Escape  close the open panel without moving
   *
   * Focus stays on the row itself, so the browser's own scroll-into-view keeps
   * the target visible. ↑/↓ are also honoured while the focus is inside the row
   * (the chevron) or inside the open panel; Enter / Space / Escape belong to
   * whatever control actually has focus, so a button keeps its own key behaviour.
   */
  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
      if (event.target !== event.currentTarget) return;
      const row = records[rowIndex];
      if (!row) return;

      if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
        // Only the row itself owns these; a focused chevron keeps its own keys.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Escape") {
          if (openTripId !== row.tripId) return;
          event.preventDefault();
          setOpenTripId(null);
          return;
        }
        event.preventDefault();
        toggle(row.tripId);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      // ↑/↓ always step one trip, wherever the focus sits inside the row.
      event.preventDefault();
      const next = records[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
      moveTo(next, openTripId !== null);
    },
    [records, openTripId, toggle, moveTo]
  );

  /**
   * ↑/↓/Escape from inside the open panel. The panel is focusable so a click on
   * its text keeps the keyboard alive — a reader can select a value with the
   * mouse and still walk to the next trip with the arrow keys.
   */
  const handlePanelKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, rowIndex: number) => {
      const row = records[rowIndex];
      if (!row) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenTripId(null);
        rowRefs.current.get(row.tripId)?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      moveTo(records[rowIndex + (event.key === "ArrowDown" ? 1 : -1)], true);
    },
    [records, moveTo]
  );

  const onSort = (col: Column) => {
    if (!col.sortKey) return;
    setSort((prev) =>
      prev.key === col.sortKey
        ? { key: prev.key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: col.sortKey as SortBy, dir: "desc" }
    );
  };

  /** Header cell in the Trip List idiom: glyph + label + paired sort arrows. */
  const sortable = (col: Column) => {
    const active = Boolean(col.sortKey) && sort.key === col.sortKey;
    const content = (
      <>
        {col.icon && (
          <col.icon size={14} className={`shrink-0 ${col.tone ? ICON_TONES[col.tone] : "text-slate-400"}`} />
        )}
        <span>{col.labelKey ? t(col.labelKey) : col.label}</span>
        {col.sortKey && <SortArrows active={active} dir={sort.dir} />}
      </>
    );
    const innerClass = `flex w-full items-center gap-1.5 ${alignClass(col.align)} ${
      col.align === "center" ? "justify-center" : ""
    }`;

    if (!col.sortKey) {
      return (
        <span className={innerClass} title={col.titleKey ? t(col.titleKey) : undefined}>
          {content}
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onSort(col)}
        title={col.titleKey ? t(col.titleKey) : undefined}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort ${innerClass} text-[12px] font-bold uppercase tracking-wider transition-colors hover:text-emerald-700 ${
          active ? "text-emerald-700" : ""
        }`}
      >
        {content}
      </button>
    );
  };

  const showEmptyAll = !loading && emptyAll;
  const showEmptyFiltered = !loading && filtersApplied && records.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-xs shadow-sm md:text-sm">
      {/* ── Table header bar ─────────────────────────────────────────────
          Title and count are one block: "Completed Trips  • 525 trips".
          The trip count is the first thing read after the title, so it can
          never look like a stray pill parked at the far edge of the card.
          Flat rose tile, broken heart — mortality, stated plainly: no glossy
          gradient, no drop shadow, same quiet weight as the Trip List tile. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 via-white to-rose-50/40 px-5 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50/70 text-rose-500 shadow-inner">
          <HeartCrack size={18} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-[15px] font-bold tracking-tight text-slate-800">
            {t("ops.mortality.section.completed_trips")}
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-white px-2.5 py-[3px] text-[11px] font-bold tabular-nums text-rose-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
            {t("ops.mortality.section.count", { count: formatNumber(totalRecords) })}
          </span>
        </div>
        <p className="ml-auto hidden items-center gap-1.5 text-[11px] font-medium text-slate-400 lg:inline-flex">
          <span
            className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-[1px] text-slate-500 shadow-sm"
            aria-hidden="true"
          >
            <ArrowUp size={10} strokeWidth={2.6} />
            <ArrowDown size={10} strokeWidth={2.6} />
          </span>
          {t("ops.mortality.hint.keys")}
        </p>
      </div>

      {/* A background re-fetch is stated as a single quiet line rather than a
          skeleton: the operator keeps reading the rows they already have, and a
          Reset never looks like the page reloading itself. */}
      <div className="h-0.5 w-full overflow-hidden bg-transparent" aria-hidden={!reloading}>
        {reloading && (
          <div
            className="h-full w-full animate-pulse bg-emerald-500/70"
            role="progressbar"
            aria-label={t("ops.mortality.updating")}
          />
        )}
      </div>

      <div ref={scrollRef} className="w-full overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[13px]" aria-busy={reloading}>
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
            <tr className="whitespace-nowrap">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 align-middle text-[12px] font-bold uppercase tracking-wider ${alignClass(
                    col.align
                  )} ${col.key === "serial" ? "w-12" : ""}`}
                >
                  {sortable(col)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <>
                {[0, 1, 2, 3, 4, 5].map((rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    <td colSpan={COLUMNS.length} className="px-3 py-3.5">
                      <div className="h-5 w-full animate-pulse rounded-md bg-slate-100" />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={COLUMNS.length} className="px-2.5 py-2 text-center">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                        aria-hidden="true"
                      />
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
                    <p className="text-[13px] font-semibold text-slate-700">{t("ops.mortality.empty.title")}</p>
                    <p className="max-w-md text-xs text-slate-400">{t("ops.mortality.empty.hint")}</p>
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
                    <p className="max-w-md text-xs text-slate-400">{t("ops.mortality.empty.hint")}</p>
                    {onReset && (
                      <button
                        type="button"
                        onClick={onReset}
                        className="group mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
                      >
                        <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
                          <TrendingDown size={13} />
                        </span>
                        {t("common.reset")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r, index) => {
                const isOpen = openTripId === r.tripId;
                const serialNo = (page - 1) * pageSize + index + 1;
                return (
                  <Fragment key={r.tripId}>
                    <tr
                      ref={(element) => {
                        if (element) rowRefs.current.set(r.tripId, element);
                        else rowRefs.current.delete(r.tripId);
                      }}
                      tabIndex={0}
                      onKeyDown={(event) => handleRowKeyDown(event, index)}
                      aria-expanded={isOpen}
                      onClick={(event) => {
                        // A click anywhere on the trip row opens its detail — the
                        // row takes focus first, so the keyboard walks on from the
                        // trip the operator just picked.
                        event.currentTarget.focus();
                        toggle(r.tripId);
                      }}
                      className={`cursor-pointer select-none outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 hover:bg-slate-50/60 ${
                        isOpen ? "bg-slate-50/60" : index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                      }`}
                    >
                      <td className="w-12 px-3 py-3.5">
                        <span className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggle(r.tripId);
                            }}
                            className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label={isOpen ? t("ops.mortality.aria.collapse") : t("ops.mortality.aria.expand")}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                          <span className="text-[12.5px] font-medium tabular-nums text-slate-400">
                            {formatNumber(serialNo)}
                          </span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 font-bold text-indigo-600">
                        {localizeTripViewText(r.tripNo, language)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-600">
                        {formatTripListDay(r.tripDate, language)}
                      </td>

                      <td
                        className="max-w-[170px] truncate px-3 py-3.5 font-medium text-slate-700"
                        title={r.sourceFarm || undefined}
                      >
                        {localizeTripViewText(r.sourceFarm, language) || "—"}
                      </td>

                      <td
                        className="max-w-[130px] truncate px-3 py-3.5 text-slate-600"
                        title={r.supervisorName || undefined}
                      >
                        {localizeTripViewText(r.supervisorName, language) || "—"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold tabular-nums text-amber-700">
                        {formatNumber(r.farmBirds)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center tabular-nums text-amber-700">
                        {formatWeight(r.farmWeight, weightUnit)}
                      </td>

                      {/* Plain number — the ShoppingBag glyph already names this
                          column in the header; repeating a badge on every row
                          is what made the grid noisy. */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold tabular-nums text-slate-700">
                        {formatNumber(r.deliveryShops)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold tabular-nums text-sky-700">
                        {formatNumber(r.deliveredBirds)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center tabular-nums text-sky-700">
                        {formatWeight(r.deliveredWeight, weightUnit)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold tabular-nums text-orange-600">
                        {formatNumber(r.mortalityCount)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center tabular-nums text-orange-600">
                        {formatWeight(r.mortalityWeight, weightUnit)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold tabular-nums text-rose-600">
                        {formatWeight(r.weightLoss, weightUnit)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center tabular-nums text-rose-600">
                        {r.weightLossPercentage.toFixed(2)}%
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="p-0">
                          <div
                            className="sticky left-0 cursor-text select-text"
                            style={panelWidth > 0 ? { width: `${panelWidth}px` } : undefined}
                            tabIndex={-1}
                            onKeyDown={(event) => handlePanelKeyDown(event, index)}
                            onMouseUp={(event) => {
                              // A plain click hands the keyboard to the panel so
                              // ↑/↓ keep working; a drag that selected text is left
                              // alone, because reading a value comes first.
                              const selection = window.getSelection?.();
                              if (!selection || selection.isCollapsed) event.currentTarget.focus();
                            }}
                          >
                            <TripLossRowExpand record={r} weightUnit={weightUnit} />
                          </div>
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

      {/* GLOBAL PAGINATION — the one pager used by the Trip List and every other
          module. Hidden for short result sets where paging adds noise. */}
      {shouldShowPagination(totalRecords) && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalRecords}
          onPageChange={onPageChange}
          onPageSizeChange={(size) => {
            onPageSizeChange(size);
            onPageChange(1);
          }}
          disabled={loading}
        />
      )}
    </div>
  );
}
