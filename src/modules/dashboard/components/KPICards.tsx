// src/modules/dashboard/components/KPICards.tsx

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

import { useI18n } from "../../../i18n";

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
}

// ---------- Helpers ----------
const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const formatLargeNumber = (value: number): { main: string; suffix: string } => {
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

const formatWeightNumber = (
  value: unknown,
): { main: string; suffix: string } => {
  // Kilos are whole numbers on a dashboard — nobody reads 27,744.23 kg.
  return formatLargeNumber(Math.round(safeNumber(value)));
};

// ---------- Configuration ----------
const cardConfig = {
  "Total Trips": {
    bg: "bg-blue-500",
    chip: "bg-blue-100 text-blue-600",
    hover: "hover:bg-blue-50/60",
    text: "text-blue-600",
    icon: Truck,
    upIsGood: true,
  },
  "Total Birds": {
    bg: "bg-amber-500",
    chip: "bg-amber-100 text-amber-600",
    hover: "hover:bg-amber-50/60",
    text: "text-amber-600",
    icon: Bird,
    upIsGood: true,
  },
  "Total Weight (KG)": {
    bg: "bg-green-500",
    chip: "bg-emerald-100 text-emerald-600",
    hover: "hover:bg-emerald-50/60",
    text: "text-green-600",
    icon: ShoppingBag,
    upIsGood: true,
  },
  "Total Sales Amount": {
    bg: "bg-violet-500",
    chip: "bg-violet-100 text-violet-600",
    hover: "hover:bg-violet-50/60",
    text: "text-violet-600",
    icon: IndianRupee,
    upIsGood: true,
  },
  "Total Collections": {
    bg: "bg-orange-500",
    chip: "bg-orange-100 text-orange-600",
    hover: "hover:bg-orange-50/60",
    text: "text-orange-600",
    icon: Wallet,
    upIsGood: true,
  },
  "Pending Collections": {
    bg: "bg-cyan-500",
    chip: "bg-cyan-100 text-cyan-700",
    hover: "hover:bg-cyan-50/60",
    text: "text-cyan-600",
    icon: Hourglass,
    // Outstanding dues going UP is not a win.
    upIsGood: false,
  },
  "Total Expenses": {
    bg: "bg-pink-500",
    chip: "bg-pink-100 text-pink-600",
    hover: "hover:bg-pink-50/60",
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

const compare = (
  value: number,
  previous: number,
  upIsGood: boolean,
): Comparison => {
  if (!Number.isFinite(previous) || previous <= 0)
    return { kind: "no-baseline" };
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

const KPICard = memo(function KPICard({
  label,
  value,
  prevValue,
  unit,
  rangeDays,
  breakdown,
}: KPICardProps) {
  const { t } = useI18n();
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
  const periodLabel = `${days} D`;
  const rangeLabel = t("ops.dashboard.vs_prev", { days });

  /* The badge now owns the tile's third line, so it never has to fight the logo
     or the figure for width. It still scales with the tile (container queries
     measured on the card itself) and keeps `max-w-full` + `shrink-0`, so the
     change and its period are never clipped and never push anything out. */
  let trendChipClasses =
    "inline-flex max-w-full items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-center text-[8px] font-black tracking-[0.02em] ring-1 ring-inset shadow-sm @min-[96px]:text-[8.5px] @min-[120px]:text-[9px] ";
  const trendIconClass =
    "h-2.5 w-2.5 shrink-0 @min-[96px]:h-3 @min-[96px]:w-3 @min-[120px]:h-3.5 @min-[120px]:w-3.5";
  let trendIcon: React.ReactNode = null;
  let trendText: string;
  let badgeTitle: string;

  if (comparison.kind === "move") {
    trendChipClasses += comparison.good
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : "bg-rose-50 text-rose-600 ring-rose-100";
    trendIcon =
      comparison.pct > 0 ? (
        <TrendingUp size={10} className={trendIconClass} />
      ) : (
        <TrendingDown size={10} className={trendIconClass} />
      );
    trendText = formatPct(comparison.pct);
    badgeTitle = t("ops.dashboard.kpi_compare_title", {
      current: formatWithUnit(value, unit),
      previous: formatWithUnit(prevValue, unit),
      days,
    });
  } else if (comparison.kind === "flat") {
    trendChipClasses += "bg-slate-100 text-slate-500 ring-slate-100";
    trendText = "0%";
    badgeTitle = t("ops.dashboard.kpi_compare_title", {
      current: formatWithUnit(value, unit),
      previous: formatWithUnit(prevValue, unit),
      days,
    });
  } else {
    // No prior window to measure against — say so instead of printing 0.0%.
    trendChipClasses += "bg-slate-100 text-slate-400 ring-slate-100";
    trendText = "—";
    badgeTitle = t("ops.dashboard.kpi_no_baseline", { days });
  }
  const wasValueClass =
    comparison.kind === "move"
      ? comparison.good
        ? "text-emerald-600"
        : "text-rose-400"
      : comparison.kind === "flat"
        ? "text-slate-500"
        : "text-slate-400";
  /* The compact trend chip sits on the top-right edge, while the larger logo
     stays centred on the right edge. */

  /* The tile prints the compact figure ("₹2.89 Cr", "40,183"); the tooltip
     keeps the exact one ("₹28,870,424", "40,183 Kg") so the full number is
     always a hover away without crowding the tile. */
  const exactValue = `${unit === "₹" ? "₹" : ""}${Math.round(safeNumber(value)).toLocaleString()}${
    unit === "KG" ? " Kg" : ""
  }`;
  const visibleValueLength = `${displayMain}${displaySuffix}`.replace(
    /\s/g,
    "",
  ).length;
  const valueSizeClass =
    visibleValueLength <= 3
      ? "text-[22px] @min-[96px]:text-[28px] @min-[120px]:text-[32px]"
      : visibleValueLength <= 5
        ? "text-[20px] @min-[96px]:text-[25px] @min-[120px]:text-[29px]"
        : visibleValueLength <= 8
          ? "text-[18px] @min-[96px]:text-[23px] @min-[120px]:text-[27px]"
          : "text-[16px] @min-[96px]:text-[21px] @min-[120px]:text-[25px]";
  const suffixSizeClass =
    visibleValueLength <= 5
      ? "text-[10px] @min-[96px]:text-[12.5px] @min-[120px]:text-[14.5px]"
      : "text-[9.5px] @min-[96px]:text-[12px] @min-[120px]:text-[14px]";
  const valueTooltip = displaySuffix ? exactValue : undefined;

  const showBreakdown = label === "Total Expenses" && breakdown;

  /* COMPACT TILE, THREE LINES, EVERY DETAIL — and the seven tiles never leave
     one row. The strip is a 7-column grid (see KPICards below), so a tile is
     always exactly 1/7 of the page: no sideways dragging, nothing wrapping
     underneath. Because that share can be narrow, the tile measures ITSELF
     (`@container`) and grows through three densities, each sized against the
     widest real content ("Pending Collections", "₹2.89 Cr", "▲ 494.3% 30 D",
     "No change 30 D", "was ₹40.31 L"):

       line 1  KPI name, with "▲ 5.7% 7 D" pinned to the top-right edge
       line 2  the figure, with the previous "was" value directly underneath

       · tiny (default)     20px logo, 8px name,   14px figure, 7.5px badge, 8px was
       · ≥96px of content   26px logo, 10px name,  19px figure, 9px badge,   8.5px was
       · ≥120px of content  32px logo, 11px name,  24px figure, 9.5px badge, 8.5px was
     Card padding is deliberately NOT tiered: container queries read the tile's
     content-box width, so tiering the padding would move the measurement the
     tiers depend on. The badge keeps its slim px-1.5 at every size for the same
     reason — every pixel it saves goes to keeping "▲ 5.7% 7 D" and "was 48"
     readable. Nothing is ellipsized except as a last resort, and the
     full figure plus the full comparison always sit in the tooltips. */
  const cardContent = (
    <div
      className={`@container group relative flex h-full min-h-[7.25rem] min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm outline-none transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${config.hover} ${
        /* No navigation from the KPI row on purpose — only Expenses keeps the
           "hover me for the breakdown" cue. */
        showBreakdown ? "cursor-help" : ""
      }`}
    >
      <span className={`absolute inset-x-3 top-0 h-0.5 rounded-full ${config.bg}`} />
      <div className="relative z-20 flex items-start justify-between gap-1.5">
        <div className={`${config.chip} flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-inset ring-white/70 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-rotate-3 motion-reduce:transform-none`}>
          <Icon
            className={label === "Total Birds" ? "h-5 w-5" : "h-4 w-4"}
            size={label === "Total Birds" ? 20 : 16}
            strokeWidth={label === "Total Birds" ? 2.15 : 2.25}
          />
        </div>
        <span
          className={trendChipClasses}
          title={`${badgeTitle} · ${rangeLabel}`}
        >
          {trendIcon}
          <span>{trendText}</span>
          <span className="font-medium opacity-70">{periodLabel}</span>
        </span>
      </div>

      <div className="relative mt-2 flex min-w-0 flex-col gap-1">
        <div className="min-w-0">
          <span
            className="block min-w-0 truncate text-[8.5px] font-extrabold uppercase leading-snug tracking-[0.075em] text-slate-500 @min-[96px]:text-[10px]"
            title={t(kpiCardLabel(label))}
          >
            {t(kpiCardShortLabel(label))}
          </span>
        </div>

        <div className="min-w-0">
          <div
            className={`min-w-0 truncate font-black leading-none tracking-tight ${valueSizeClass} ${config.text}`}
            title={valueTooltip}
          >
            {displayMain}
            {displaySuffix && (
              <span
                className={`ml-0.5 font-medium text-slate-400 ${suffixSizeClass}`}
              >
                {displaySuffix}
              </span>
            )}
          </div>
        </div>

        {baseline ? (
          <span
            className={`block min-w-0 max-w-full truncate text-[8px] font-bold leading-none @min-[96px]:text-[9px] @min-[120px]:text-[10px] ${wasValueClass}`}
            title={badgeTitle}
          >
            {t("ops.dashboard.kpi_prev_value", {
              value: formatWithUnit(prevValue, unit),
            })}
          </span>
        ) : null}
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
        {
          dot: "bg-amber-500",
          label: t("ops.dashboard.fuel_expense"),
          amount: breakdown.fuel,
        },
        {
          dot: "bg-sky-500",
          label: t("ops.dashboard.trip_expense"),
          amount: breakdown.trip,
        },
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
            <span className="shrink-0 text-[10px] font-medium text-slate-400">
              {rangeLabel}
            </span>
          </div>

          <div className="divide-y divide-slate-50">
            {breakdownRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 px-3 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`}
                  />
                  <span className="truncate text-[11px] text-slate-600">
                    {row.label}
                  </span>
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

  if (showBreakdown && breakdown) {
    return (
      <div className="group/exp relative h-full">
        {cardContent}
        {breakdownPopup}
      </div>
    );
  }

  return cardContent;
});

// ---------- Main Component ----------
export default function KPICards({
  current,
  previous,
  rangeDays,
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

  const finalCards = useMemo(
    () => cards.map((card) => ({ ...card, rangeDays })),
    [cards, rangeDays],
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
       forcing overflow; the card handles the narrow end with its own densities.
       The staggered entrance is pure CSS (opacity + transform, GPU-only), so
       the row animates without a single rAF loop — nothing can ever "stick". */
    <div className="grid min-w-0 grid-cols-7 gap-1.5 sm:gap-2">
      {finalCards.map((card, index) => (
        <div
          key={card.label}
          className="min-w-0 animate-kpi-tile motion-reduce:animate-none"
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <KPICard {...card} />
        </div>
      ))}
    </div>
  );
}
