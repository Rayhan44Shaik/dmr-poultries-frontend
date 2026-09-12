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
import { useI18n } from "../../../../i18n";

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

/** What fits on the card next to the badge; the full name is the tooltip. */
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
      return "ops.dashboard.kpi_short_pending";
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
  const periodLabel = `${days}d`;
  const rangeLabel = t("ops.dashboard.vs_prev", { days });

  let badgeClasses =
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ";
  let iconElement: React.ReactNode = null;
  let changeText: string;
  let badgeTitle: string;

  if (comparison.kind === "move") {
    badgeClasses += comparison.good
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-600";
    iconElement = comparison.pct > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />;
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

  const numberSizeClass = "text-[27px]";

  const showBreakdown = label === "Total Expenses" && breakdown;

  // Left content – vertically centered
  const leftContent = (
    <div className="flex flex-col justify-center flex-1 min-w-0">
      {/* Top row: the name on the left, the comparison pinned top-right. */}
      <div className="flex items-start justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${config.bg}`} />
          <p
            className="truncate whitespace-nowrap text-[11px] font-semibold text-slate-500"
            title={t(kpiCardLabel(label))}
          >
            {t(kpiCardShortLabel(label))}
          </p>
        </span>
        <span className={badgeClasses} title={`${badgeTitle} · ${rangeLabel}`}>
          {iconElement}
          {changeText}
          <span className="font-medium text-slate-400">{periodLabel}</span>
        </span>
      </div>

      <h2
        className={`mt-1 ${numberSizeClass} font-bold leading-none tracking-tight ${config.text}`}
      >
        {displayMain}
        {displaySuffix && (
          <span className="ml-0.5 text-xs font-medium text-slate-400">
            {displaySuffix}
          </span>
        )}
      </h2>

      {/* What it is measured against — the number, not just the ratio. */}
      {baseline ? (
        <p
          className="mt-1 truncate text-[10px] font-medium text-slate-400"
          title={`${rangeLabel} ${t("ops.dashboard.kpi_prev_value", {
            value: formatWithUnit(prevValue, unit),
          })}`}
        >
          {t("ops.dashboard.kpi_prev_value", { value: formatWithUnit(prevValue, unit) })}
        </p>
      ) : null}
    </div>
  );

  // Card content – smaller icon
  const cardContent = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50 opacity-80" />

      <div className="relative flex items-center gap-3">
        {leftContent}

        <div
          className={`
            ${config.bg}
            h-9 w-9 rounded-xl shadow-md
            flex items-center justify-center flex-shrink-0
            transition-transform duration-300 group-hover:scale-110
          `}
        >
          <Icon className="text-white" size={18} />
        </div>
      </div>
    </div>
  );

  // ---- Expense breakdown tooltip (now BELOW the card) ----
  if (showBreakdown) {
    return (
      <div className="relative cursor-help group">
        {cardContent}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
              <span className="font-medium text-slate-600">{t("ops.dashboard.breakdown")}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">{t("ops.dashboard.fuel_expense")}</span>
                <span className="font-medium text-slate-800">₹{breakdown.fuel.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t("ops.dashboard.trip_expense")}</span>
                <span className="font-medium text-slate-800">₹{breakdown.trip.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45"></div>
        </div>
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
    [cards, rangeDays]
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {finalCards.map((card) => (
        <KPICard key={card.label} {...card} />
      ))}
    </div>
  );
}