import {
  Bird,
  ClipboardList,
  CreditCard,
  Fuel,
  ListChecks,
  PackageCheck,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../i18n";
import type { OperationsModuleCounts } from "../services/dashboardService";

interface QuarterOperationsMapProps {
  counts: OperationsModuleCounts;
  fromDate?: string;
  toDate?: string;
}

interface MapItem {
  key: keyof OperationsModuleCounts;
  labelKey: string;
  hintKey: string;
  path: string;
  icon: LucideIcon;
  tone: "blue" | "violet" | "emerald" | "sky" | "amber" | "rose" | "cyan" | "indigo";
}

const TONE_CLASSES: Record<MapItem["tone"], { icon: string; card: string; ring: string }> = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    card: "hover:border-blue-200 hover:bg-blue-50/40",
    ring: "group-hover:ring-blue-100",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    card: "hover:border-violet-200 hover:bg-violet-50/40",
    ring: "group-hover:ring-violet-100",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    card: "hover:border-emerald-200 hover:bg-emerald-50/40",
    ring: "group-hover:ring-emerald-100",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600",
    card: "hover:border-sky-200 hover:bg-sky-50/40",
    ring: "group-hover:ring-sky-100",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    card: "hover:border-amber-200 hover:bg-amber-50/40",
    ring: "group-hover:ring-amber-100",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600",
    card: "hover:border-rose-200 hover:bg-rose-50/40",
    ring: "group-hover:ring-rose-100",
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-600",
    card: "hover:border-cyan-200 hover:bg-cyan-50/40",
    ring: "group-hover:ring-cyan-100",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-600",
    card: "hover:border-indigo-200 hover:bg-indigo-50/40",
    ring: "group-hover:ring-indigo-100",
  },
};

const MAP_ITEMS: MapItem[] = [
  {
    key: "tripRecords",
    labelKey: "ops.dashboard.module_map.trips",
    hintKey: "ops.dashboard.module_map.trips_hint",
    path: "/operations?tab=trip-list",
    icon: Truck,
    tone: "blue",
  },
  {
    key: "rateEntries",
    labelKey: "ops.dashboard.module_map.rates",
    hintKey: "ops.dashboard.module_map.rates_hint",
    path: "/operations?tab=rate-entry",
    icon: ListChecks,
    tone: "violet",
  },
  {
    key: "shopSales",
    labelKey: "ops.dashboard.module_map.sales",
    hintKey: "ops.dashboard.module_map.sales_hint",
    path: "/operations?tab=shop-sales",
    icon: ShoppingBag,
    tone: "emerald",
  },
  {
    key: "collections",
    labelKey: "ops.dashboard.module_map.collections",
    hintKey: "ops.dashboard.module_map.collections_hint",
    path: "/operations?tab=collection",
    icon: CreditCard,
    tone: "sky",
  },
  {
    key: "pendingShops",
    labelKey: "ops.dashboard.module_map.pending",
    hintKey: "ops.dashboard.module_map.pending_hint",
    path: "/operations?tab=pending-collections",
    icon: ClipboardList,
    tone: "amber",
  },
  {
    key: "mortalityTrips",
    labelKey: "ops.dashboard.module_map.mortality",
    hintKey: "ops.dashboard.module_map.mortality_hint",
    path: "/operations?tab=mortality",
    icon: Bird,
    tone: "rose",
  },
  {
    key: "fuelBills",
    labelKey: "ops.dashboard.module_map.fuel",
    hintKey: "ops.dashboard.module_map.fuel_hint",
    path: "/operations?tab=fuel-expenses",
    icon: Fuel,
    tone: "cyan",
  },
  {
    key: "orders",
    labelKey: "ops.dashboard.module_map.orders",
    hintKey: "ops.dashboard.module_map.orders_hint",
    path: "/operations?tab=orders",
    icon: PackageCheck,
    tone: "indigo",
  },
];

function formatRange(fromDate: string | undefined, toDate: string | undefined, locale: string): string | null {
  if (!fromDate || !toDate) return null;
  const format = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };
  return fromDate === toDate ? format(fromDate) : `${format(fromDate)} – ${format(toDate)}`;
}

/**
 * Record-level navigation for the sample quarter.
 *
 * The counts are passed straight through from GET /operations/dashboard's
 * `moduleCounts` payload. Each link opens the register that owns its rows,
 * rather than recreating or estimating data in the dashboard.
 */
export default function QuarterOperationsMap({ counts, fromDate, toDate }: QuarterOperationsMapProps) {
  const { t, language } = useI18n();
  const locale = language === "te" ? "te-IN" : "en-IN";
  const range = formatRange(fromDate, toDate, locale);
  const number = new Intl.NumberFormat(locale);

  return (
    <section
      aria-labelledby="quarter-operations-map-title"
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5"
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <PackageCheck size={15} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <h2 id="quarter-operations-map-title" className="text-sm font-black tracking-tight text-slate-800">
              {t("ops.dashboard.module_map.title")}
            </h2>
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-slate-500">
            {t("ops.dashboard.module_map.subtitle")}
          </p>
        </div>
        {range ? (
          <span className="shrink-0 self-start rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200 sm:self-auto">
            {range}
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 xl:grid-cols-8">
        {MAP_ITEMS.map((item) => {
          const Icon = item.icon;
          const tone = TONE_CLASSES[item.tone];
          const value = counts[item.key];
          const label = t(item.labelKey);
          return (
            <Link
              key={item.key}
              to={item.path}
              title={t(item.hintKey)}
              aria-label={`${label}: ${number.format(value)}. ${t(item.hintKey)}`}
              className={`group min-w-0 bg-white p-3.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${tone.card}`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-xl transition-transform duration-150 group-hover:scale-105 ${tone.icon}`}>
                <Icon size={16} strokeWidth={2.35} aria-hidden="true" />
              </span>
              <strong className="mt-3 block truncate text-lg font-black tabular-nums tracking-tight text-slate-800">
                {number.format(value)}
              </strong>
              <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-500" title={label}>
                {label}
              </span>
              <span className={`mt-2 block h-px w-full rounded-full bg-slate-100 transition-colors ${tone.ring}`} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
