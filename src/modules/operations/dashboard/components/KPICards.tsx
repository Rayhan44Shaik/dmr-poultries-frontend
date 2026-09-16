// src/modules/operations/dashboard/components/KPICards.tsx

import { useMemo, memo } from "react";
import {
  Bird,
  Truck,
  ShoppingBag,
  IndianRupee,
  Wallet,
  Hourglass,
  ReceiptIndianRupee,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../../i18n";
import { buildAnalysisPath } from "../../../../shared/kpi/analysisLink";

// ---------- Type Definitions ----------
export interface DashboardMetrics {
  totalTrips?: number;
  /** Birds loaded at the farm across the window. */
  totalBirds?: number;
  totalSalesWeight?: number;
  totalSalesAmount?: number;
  totalCollections?: number;
  pendingCollections?: number;
  totalExpenses?: number;
  fuelExpense?: number;
  tripExpense?: number;
}

export interface KPICardsProps {
  current: DashboardMetrics;
  /** The equal-length window before the one on screen; `null` until it loads. */
  previous?: DashboardMetrics | null;
  rangeDays?: number;
  /** The window on screen, so each KPI can deep-link its analysis page to the
   *  very same dates (and the window before them). */
  range?: { from: string; to: string } | null;
}

// ---------- Helpers ----------
const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const formatLargeNumber = (
  value: number
): { main: string; suffix: string } => {
  const abs = Math.abs(value);
  if (abs >= 10000000) {
    return {
      main: (value / 10000000).toFixed(2),
      suffix: "Cr",
    };
  } else if (abs >= 100000) {
    return {
      main: (value / 100000).toFixed(2),
      suffix: "L",
    };
  } else {
    return {
      main: value.toLocaleString(),
      suffix: "",
    };
  }
};

const formatCurrency = (amount: unknown): { main: string; suffix: string } => {
  const num = safeNumber(amount);
  const { main, suffix } = formatLargeNumber(num);
  return {
    main: `₹${main}`,
    suffix,
  };
};

const formatWeightNumber = (value: unknown): { main: string; suffix: string } => {
  // Kilos are whole numbers on a dashboard — nobody reads 27,744.23 kg.
  return formatLargeNumber(Math.round(safeNumber(value)));
};

// ---------- Configuration ----------
const cardConfig = {
  "Total Trips": {
    bg: "bg-blue-500",
    text: "text-blue-600",
    icon: Truck,
    upIsGood: true,
  },
  "Total Birds": {
    bg: "bg-amber-500",
    text: "text-amber-600",
    icon: Bird,
    upIsGood: true,
  },
  "Total Weight (KG)": {
    bg: "bg-green-500",
    text: "text-green-600",
    icon: ShoppingBag,
    upIsGood: true,
  },
  "Total Sales Amount": {
    bg: "bg-violet-500",
    text: "text-violet-600",
    icon: IndianRupee,
    upIsGood: true,
  },
  "Total Collections": {
    bg: "bg-orange-500",
    text: "text-orange-600",
    icon: Wallet,
    upIsGood: true,
  },
  "Pending Collections": {
    bg: "bg-cyan-500",
    text: "text-cyan-600",
    icon: Hourglass,
    // Outstanding dues going UP is not a win.
    upIsGood: false,
  },
  "Total Expenses": {
    bg: "bg-pink-500",
    text: "text-pink-600",
    icon: ReceiptIndianRupee,
    // Nor is spending more.
    upIsGood: false,
  },
} as const;

type CardLabel = keyof typeof cardConfig;

/** One comparison, three honest answers: a move, a flat line, or no baseline. */
type Comparison =
  | { kind: "move"; pct: number; good: boolean }
  | { kind: "flat" }
  | { kind: "no-baseline" };

const compare = (value: number, previous: number, upIsGood: boolean): Comparison => {
  if (!Number.isFinite(previous) || previous <= 0) return { kind: "no-baseline" };
  const pct = ((value - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return { kind: "flat" };
  return { kind: "move", pct, good: pct > 0 === upIsGood };
};

const formatPct = (pct: number): string =>
  `${Math.abs(pct) < 0.1 ? "<0.1" : Math.abs(pct).toFixed(1)}%`;

const formatWithUnit = (value: unknown, unit?: "KG" | "₹"): string => {
  if (unit === "₹") {
    const { main, suffix } = formatCurrency(value);
    return `${main}${suffix ? ` ${suffix}` : ""}`;
  }
  if (unit === "KG") {
    const { main, suffix } = formatWeightNumber(value);
    return `${main}${suffix ? ` ${suffix}` : ""}`;
  }
  const { main, suffix } = formatLargeNumber(Math.round(safeNumber(value)));
  return `${main}${suffix ? ` ${suffix}` : ""}`;
};

// ---------- Individual Card ----------
interface KPICardProps {
  label: CardLabel;
  value: number;
  prevValue: number;
  unit?: "KG" | "₹";
  rangeDays?: number;
  breakdown?: { fuel: number; trip: number };
  /** Accounts → Analysis, opened on the dashboard's window with compare on. */
  to?: string | null;
  range?: { from: string; to: string } | null;
}

const kpiCardLabel = (label: CardLabel): string => {
  switch (label) {
    case "Total Trips":
      return "ops.dashboard.kpi_total_trips";
    case "Total Birds":
      return "ops.dashboard.kpi_total_birds";
    case "Total Weight (KG)":
      return "ops.dashboard.kpi_total_weight";
    case "Total Sales Amount":
      return "ops.dashboard.kpi_total_sales";
    case "Total Collections":
      return "ops.dashboard.kpi_total_collections";
    case "Pending Collections":
      return "ops.dashboard.kpi_pending_collections";
    case "Total Expenses":
      return "ops.dashboard.kpi_total_expenses";
  }
};

/** Compact names keep the tile small and scannable. Pending is the one
 *  exception: it keeps its full "Pending Collections" name, because a bare
 *  "Pending" next to real money is too easy to misread. The full name of every
 *  tile is still one hover away (`title`). */
const kpiCardShortLabel = (label: CardLabel): string => {
  switch (label) {
    case "Total Trips":
      return "ops.dashboard.kpi_short_trips";
    case "Total Birds":
      return "ops.dashboard.kpi_short_birds";
    case "Total Weight (KG)":
      return "ops.dashboard.kpi_short_weight";
    case "Total Sales Amount":
      return "ops.dashboard.kpi_short_sales";
    case "Total Collections":
      return "ops.dashboard.kpi_short_collections";
    case "Pending Collections":
      return "ops.dashboard.kpi_pending_collections";
    case "Total Expenses":
      return "ops.dashboard.kpi_short_expenses";
  }
};

/** "2026-09-07" → "07 Sep 2026" — used in the deep-link tooltip. */
const formatRangeDate = (dateKey: string, language: string): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const KPICard = memo(function KPICard({
  label,
  value,
  prevValue,
  unit,
  rangeDays,
  breakdown,
  to,
  range,
}: KPICardProps) {
  const { t, language } = useI18n();
  const config = cardConfig[label];
  const Icon = config.icon;

  let displayMain: string;
  let displaySuffix: string;

  if (unit === "₹") {
    const formatted = formatCurrency(value);
    displayMain = formatted.main;
    displaySuffix = formatted.suffix;
  } else if (unit === "KG") {
    const formatted = formatWeightNumber(value);
    displayMain = formatted.main;
    displaySuffix = formatted.suffix;
  } else {
    const formatted = formatLargeNumber(value);
    displayMain = formatted.main;
    displaySuffix = formatted.suffix;
  }

  const comparison = compare(value, prevValue, config.upIsGood);
  const baseline = prevValue > 0;
  const days = rangeDays && rangeDays > 0 ? rangeDays : 7;
  const periodLabel = `${days}d`;
  const rangeLabel = t("ops.dashboard.vs_prev", { days });

  /* The badge now owns the tile's third line, so it never has to fight the logo
     or the figure for width. It still scales with the tile (container queries
     measured on the card itself) and keeps `max-w-full` + `shrink-0`, so the
     change and its period are never clipped and never push anything out. */
  let badgeClasses =
    "inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full px-1 py-0.5 text-[7.5px] font-semibold whitespace-nowrap @min-[96px]:px-1.5 @min-[96px]:text-[9px] @min-[120px]:text-[9.5px] ";
  const trendIconClass =
    "h-2 w-2 shrink-0 @min-[96px]:h-2.5 @min-[96px]:w-2.5 @min-[120px]:h-[11px] @min-[120px]:w-[11px]";
  let iconElement: React.ReactNode = null;
  let changeText: string;
  let badgeTitle: string;

  if (comparison.kind === "move") {
    badgeClasses += comparison.good
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-600";
    iconElement =
      comparison.pct > 0 ? (
        <TrendingUp size={10} className={trendIconClass} />
      ) : (
        <TrendingDown size={10} className={trendIconClass} />
      );
    changeText = formatPct(comparison.pct);
    badgeTitle = t("ops.dashboard.kpi_compare_title", {
      current: formatWithUnit(value, unit),
      previous: formatWithUnit(prevValue, unit),
      days,
    });
  } else if (comparison.kind === "flat") {
    badgeClasses += "bg-slate-100 text-slate-500";
    changeText = t("ops.dashboard.kpi_no_change");
    badgeTitle = t("ops.dashboard.kpi_compare_title", {
      current: formatWithUnit(value, unit),
      previous: formatWithUnit(prevValue, unit),
      days,
    });
  } else {
    // No prior window to measure against — say so instead of printing 0.0%.
    badgeClasses += "bg-slate-100 text-slate-400";
    changeText = "—";
    badgeTitle = t("ops.dashboard.kpi_no_baseline", { days });
  }
  /* The badge keeps just the period ("7d"); the full "vs prev 7d" sentence is
     in the tooltip so the top-right corner stays small. */

  /* The tile prints the compact figure ("₹2.89 Cr", "40,183"); the tooltip
     keeps the exact one ("₹28,870,424", "40,183 Kg") so the full number is
     always a hover away without crowding the tile. */
  const exactValue = `${unit === "₹" ? "₹" : ""}${Math.round(safeNumber(value)).toLocaleString()}${
    unit === "KG" ? " Kg" : ""
  }`;

  const showBreakdown = label === "Total Expenses" && breakdown;

  /* COMPACT TILE, THREE LINES, EVERY DETAIL — and the seven tiles never leave
     one row. The strip is a 7-column grid (see KPICards below), so a tile is
     always exactly 1/7 of the page: no sideways dragging, nothing wrapping
     underneath. Because that share can be narrow, the tile measures ITSELF
     (`@container`) and grows through three densities, each sized against the
     widest real content ("Pending Collections", "₹2.89 Cr", "▲ 494.3% 30d",
     "No change 30d", "was ₹40.31 L"):

       line 1  logo + name (short; "Pending Collections" wraps, never cut)
       line 2  the figure
       line 3  ▲ 5.7% 7d ……… was 48   (change left, previous figure right)

       · tiny (default)     20px logo, 8px name,   14px figure, 7.5px badge, 8px was
       · ≥96px of content   26px logo, 10px name,  19px figure, 9px badge,   8.5px was
       · ≥120px of content  32px logo, 11px name,  24px figure, 9.5px badge, 8.5px was
     Card padding is deliberately NOT tiered: container queries read the tile's
     content-box width, so tiering the padding would move the measurement the
     tiers depend on. The badge keeps its slim px-1.5 at every size for the same
     reason — every pixel it saves goes to keeping "▲ 5.7% 7d" and "was 48" on
     one shared line. Nothing is ellipsized except as a last resort, and the
     full figure plus the full comparison always sit in the tooltips. */
  const cardContent = (
    <div
      className={`@container group relative flex h-full min-h-[6.875rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        /* Every tile is a link now, so the pointer leads; only a non-clickable
           Expenses tile would keep the "hover me for the breakdown" cursor. */
        showBreakdown ? (to ? "cursor-pointer" : "cursor-help") : ""
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50 opacity-80" />

      <div className="relative flex h-full min-w-0 flex-col justify-between gap-1.5">
        {/* line 1 — logo + name */}
        <div className="flex min-w-0 items-center gap-1 @min-[96px]:gap-2 @min-[120px]:gap-2.5">
          <div
            className={`${config.bg} flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md shadow-md transition-transform duration-300 group-hover:scale-110 @min-[96px]:h-[1.625rem] @min-[96px]:w-[1.625rem] @min-[96px]:rounded-lg @min-[120px]:h-8 @min-[120px]:w-8`}
          >
            <Icon
              className="h-3 w-3 text-white @min-[96px]:h-3.5 @min-[96px]:w-3.5 @min-[120px]:h-4 @min-[120px]:w-4"
              size={12}
            />
          </div>
          <span
            className="min-w-0 text-[8px] leading-snug font-semibold break-words text-slate-500 @min-[96px]:text-[10px] @min-[120px]:text-[11px]"
            title={t(kpiCardLabel(label))}
          >
            {t(kpiCardShortLabel(label))}
          </span>
        </div>

        {/* line 2 — the figure, big and unclipped */}
        <div
          className={`min-w-0 truncate text-[14px] font-bold leading-none tracking-tight @min-[96px]:text-[19px] @min-[120px]:text-[24px] ${config.text}`}
          title={`${t(kpiCardLabel(label))} · ${exactValue}`}
        >
          {displayMain}
          {displaySuffix && (
            <span className="ml-0.5 text-[8.5px] font-medium text-slate-400 @min-[96px]:text-[11px] @min-[120px]:text-[13px]">
              {displaySuffix}
            </span>
          )}
        </div>

        {/* line 3 — the bottom line: the change with its window on the left
            ("▲ 5.7% 7d") and the previous window's own figure on the right
            ("was 48"), side by side, so the percentage can be read against a
            real number at a glance. `flex-wrap` is the safety valve: on a tile
            too narrow for both (a long "No change 7d" beside "was ₹2.89 Cr"),
            the "was" figure drops underneath instead of being squeezed or cut. */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-0 gap-y-1">
          <span className={badgeClasses} title={`${badgeTitle} · ${rangeLabel}`}>
            {iconElement}
            {changeText}
            <span className="font-medium text-slate-400">{periodLabel}</span>
          </span>
          {baseline ? (
            <span
              className="min-w-0 max-w-full truncate text-[8px] font-medium text-slate-400 @min-[96px]:text-[8.5px]"
              title={badgeTitle}
            >
              {t("ops.dashboard.kpi_prev_value", { value: formatWithUnit(prevValue, unit) })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  /* ---- Expenses: the full breakdown, dropped BELOW the tile ----
     The strip is a plain grid now (no scroll container), so nothing clips a
     popup hanging under the tile: `main` only scrolls vertically, and the KPI
     strip sits in a `relative z-10` wrapper, so this paints over the sections
     below it. It is anchored to the RIGHT edge on purpose — Expenses is the
     last tile, so a centred popup would spill past the page.
     The three rows are exactly how the sample API builds the figure
     (scripts/quarter-sample-data.mjs: totalExpenses = fuel + trip +
     maintenance), so they add up to the total printed on the card. */
  const maintenanceAmount = breakdown
    ? Math.max(0, value - breakdown.fuel - breakdown.trip)
    : 0;
  const breakdownRows = breakdown
    ? [
        { dot: "bg-amber-500", label: t("ops.dashboard.fuel_expense"), amount: breakdown.fuel },
        { dot: "bg-sky-500", label: t("ops.dashboard.trip_expense"), amount: breakdown.trip },
        {
          dot: "bg-violet-500",
          label: t("ops.trip.exp_vehicle_maintenance"),
          amount: maintenanceAmount,
        },
      ]
    : [];

  const breakdownPopup =
    showBreakdown && breakdown ? (
      <div className="pointer-events-none absolute top-full right-0 z-50 mt-2 w-60 origin-top-right scale-[0.97] opacity-0 transition-all duration-200 group-hover/exp:scale-100 group-hover/exp:opacity-100">
        {/* notch pointing back up at the tile */}
        <div className="absolute -top-[5px] right-7 h-2.5 w-2.5 rotate-45 border-t border-l border-slate-200 bg-white" />

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              {t("ops.dashboard.breakdown")}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-slate-400">{rangeLabel}</span>
          </div>

          <div className="divide-y divide-slate-50">
            {breakdownRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                  <span className="truncate text-[11px] text-slate-600">{row.label}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-slate-800">
                  ₹{Math.round(row.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-3 py-2">
            <span className="truncate text-[11px] font-semibold text-slate-600">
              {t("ops.dashboard.kpi_total_expenses")}
            </span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
              ₹{Math.round(value).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    ) : null;

  /* The whole tile is the link: click anywhere on it and the Analysis page
     opens on exactly the window this dashboard is showing. */
  const linkTitle =
    to && range
      ? t("ops.analysis.open_kpi", {
          kpi: t(kpiCardLabel(label)),
          range: `${formatRangeDate(range.from, language)} → ${formatRangeDate(range.to, language)}`,
        })
      : undefined;

  const tile = to ? (
    <Link
      to={to}
      className="block h-full min-w-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2"
      title={linkTitle}
      aria-label={linkTitle}
    >
      {cardContent}
    </Link>
  ) : (
    cardContent
  );

  if (showBreakdown && breakdown) {
    return (
      <div className="group/exp relative h-full">
        {tile}
        {breakdownPopup}
      </div>
    );
  }

  return tile;
});

// ---------- Main Component ----------
export default function KPICards({
  current,
  previous,
  rangeDays,
  range,
}: KPICardsProps) {
  const cards = useMemo(() => {
    const prev = previous || {};
    return [
      {
        label: "Total Trips" as CardLabel,
        value: safeNumber(current.totalTrips),
        prevValue: safeNumber(prev.totalTrips),
      },
      {
        label: "Total Birds" as CardLabel,
        value: safeNumber(current.totalBirds),
        prevValue: safeNumber(prev.totalBirds),
      },
      {
        label: "Total Weight (KG)" as CardLabel,
        value: safeNumber(current.totalSalesWeight),
        prevValue: safeNumber(prev.totalSalesWeight),
        unit: "KG" as const,
      },
      {
        label: "Total Sales Amount" as CardLabel,
        value: safeNumber(current.totalSalesAmount),
        prevValue: safeNumber(prev.totalSalesAmount),
        unit: "₹" as const,
      },
      {
        label: "Total Collections" as CardLabel,
        value: safeNumber(current.totalCollections),
        prevValue: safeNumber(prev.totalCollections),
        unit: "₹" as const,
      },
      {
        label: "Pending Collections" as CardLabel,
        value: safeNumber(current.pendingCollections),
        prevValue: safeNumber(prev.pendingCollections),
        unit: "₹" as const,
      },
      {
        label: "Total Expenses" as CardLabel,
        value: safeNumber(current.totalExpenses),
        prevValue: safeNumber(prev.totalExpenses),
        unit: "₹" as const,
        breakdown: {
          fuel: safeNumber(current.fuelExpense),
          trip: safeNumber(current.tripExpense),
        },
      },
    ];
  }, [current, previous]);

  /* Every tile goes to the same place — Accounts → Analysis, the trip analysis
     behind all seven figures — carrying the exact window on screen and asking
     for its "Compare previous" to be on. 7 days here is 7 days there; a custom
     range arrives as that same range. */
  const analysisPath = useMemo(() => (range ? buildAnalysisPath(range) : null), [range]);

  const finalCards = useMemo(
    () => cards.map((card) => ({ ...card, rangeDays, range: range ?? null, to: analysisPath })),
    [cards, rangeDays, range, analysisPath]
  );

  return (
    /* ALL SEVEN ON ONE LINE, ALWAYS VISIBLE — no sideways dragging.
       A fixed 7-column grid gives every KPI exactly 1/7 of the page width, so
       Trips · Birds · Weight · Amount · Collections · Pending · Expenses sit on
       a single row at any window size instead of wrapping to a second one, and
       the tiles stay compact (three short lines inside: logo + name, the
       figure, then the change and the previous window's figure side by side) so
       nothing has to be squeezed or clipped to fit.
       `min-w-0` on the cells is what lets them shrink with the page rather than
       forcing overflow; the card handles the narrow end with its own densities. */
    <div className="grid min-w-0 grid-cols-7 gap-1.5 sm:gap-2">
      {finalCards.map((card) => (
        <div key={card.label} className="min-w-0">
          <KPICard {...card} />
        </div>
      ))}
    </div>
  );
}