// src/modules/operations/dashboard/components/QuarterOperationsMap.tsx
// -----------------------------------------------------------------------------
// Quarter Operations Map — the index of the active sample quarter across the
// Operations module.
//
// Every number is read through `src/sample/quarterSample.ts` — the quarter
// file's own detection & mapping layer (the `moduleCounts` block the sample
// server publishes on GET /operations/dashboard). Nothing here fabricates,
// estimates or caches data on its own:
//
//   · quarter or counts is `null` (production build, or a real backend) →
//     the card renders nothing, exactly as every other sample-aware surface
//     degrades;
//   · a count the quarter file did not report renders "—" — it is never
//     borrowed from a sibling number;
//   · each tile links to the register that renders the very same number, so
//     the map can never drift from the pages it indexes.
//
// Sync proof: `npm run check:operations-sync` (check 14) renders this
// component against the live sample API and asserts every tile's number
// appears in the markup; check 13 asserts the quarter file's numbers equal
// each page's own endpoint total.
// -----------------------------------------------------------------------------

import { Link } from "react-router-dom";
import {
  Bird,
  Calculator,
  ClipboardList,
  Fuel,
  HandCoins,
  Hourglass,
  Map,
  Store,
  Truck,
} from "lucide-react";
import { useI18n } from "../../../../i18n";
import type {
  QuarterOperationsCounts,
  SampleQuarter,
} from "../../../../sample/quarterSample";

interface TileSpec {
  /** Stable tile id (also the Operations tab key it links to). */
  key: string;
  /** i18n label key. */
  labelKey: string;
  /** i18n unit key — what the number counts. */
  unitKey: string;
  /** Field on the quarter file's per-page counts. */
  field: keyof QuarterOperationsCounts;
  /** The Operations register that renders the same number. */
  to: string;
  Icon: typeof Truck;
}

/** One tile per Operations register, in sidebar order. */
const TILES: readonly TileSpec[] = [
  {
    key: "trip-list",
    labelKey: "ops.dashboard.quarter_map.trip_list",
    unitKey: "ops.dashboard.quarter_map.trip_list_unit",
    field: "tripRecords",
    to: "/operations?tab=trip-list",
    Icon: Truck,
  },
  {
    key: "rate-entry",
    labelKey: "ops.dashboard.quarter_map.rate_entry",
    unitKey: "ops.dashboard.quarter_map.rate_entry_unit",
    field: "rateEntries",
    to: "/operations?tab=rate-entry",
    Icon: Calculator,
  },
  {
    key: "shop-sales",
    labelKey: "ops.dashboard.quarter_map.shop_sales",
    unitKey: "ops.dashboard.quarter_map.shop_sales_unit",
    field: "shopSales",
    to: "/operations?tab=shop-sales",
    Icon: Store,
  },
  {
    key: "collection",
    labelKey: "ops.dashboard.quarter_map.collections",
    unitKey: "ops.dashboard.quarter_map.collections_unit",
    field: "collections",
    to: "/operations?tab=collection",
    Icon: HandCoins,
  },
  {
    key: "pending-collections",
    labelKey: "ops.dashboard.quarter_map.pending",
    unitKey: "ops.dashboard.quarter_map.pending_unit",
    field: "pendingShops",
    to: "/operations?tab=pending-collections",
    Icon: Hourglass,
  },
  {
    key: "mortality",
    labelKey: "ops.dashboard.quarter_map.mortality",
    unitKey: "ops.dashboard.quarter_map.mortality_unit",
    field: "mortalityTrips",
    to: "/operations?tab=mortality",
    Icon: Bird,
  },
  {
    key: "fuel-expenses",
    labelKey: "ops.dashboard.quarter_map.fuel",
    unitKey: "ops.dashboard.quarter_map.fuel_unit",
    field: "fuelBills",
    to: "/operations?tab=fuel-expenses",
    Icon: Fuel,
  },
  {
    key: "orders",
    labelKey: "ops.dashboard.quarter_map.orders",
    unitKey: "ops.dashboard.quarter_map.orders_unit",
    field: "orders",
    to: "/operations?tab=orders",
    Icon: ClipboardList,
  },
];

type ReferenceField = "shops" | "farms" | "vehicles" | "employees";

const REFERENCE_FIELDS: readonly { field: ReferenceField; labelKey: string }[] = [
  { field: "shops", labelKey: "ops.dashboard.quarter_map.shops" },
  { field: "farms", labelKey: "ops.dashboard.quarter_map.farms" },
  { field: "vehicles", labelKey: "ops.dashboard.quarter_map.vehicles" },
  { field: "employees", labelKey: "ops.dashboard.quarter_map.employees" },
];

/** "2026-06-18" → "18 Jun" (locale month abbreviation, numeric day). */
function shortDate(value: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

interface QuarterOperationsMapProps {
  /** Active sample quarter, or `null` when a real backend is serving. */
  quarter: SampleQuarter | null;
  /** Per-page counts straight from the quarter file's mapping layer. */
  counts: QuarterOperationsCounts | null;
}

export default function QuarterOperationsMap({ quarter, counts }: QuarterOperationsMapProps) {
  const { t, language } = useI18n();

  // The quarter file is the gate: no sample quarter (or no counts) means a
  // production/real-backend deployment and this card does not exist there.
  if (!quarter || !counts) return null;

  const locale = language === "te" ? "te-IN" : "en-IN";
  const windowLabel = `${shortDate(quarter.fromDate, locale)} → ${shortDate(quarter.toDate, locale)}`;

  const reference = REFERENCE_FIELDS.flatMap(({ field, labelKey }) =>
    typeof counts[field] === "number"
      ? [{ field, labelKey, value: counts[field] as number }]
      : []
  );

  return (
    <section
      aria-label={t("ops.dashboard.quarter_map.title")}
      className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* ── Header: what this is + the exact quarter window it indexes ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/70">
            <Map size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-800">
              {t("ops.dashboard.quarter_map.title")}
            </h3>
            <span aria-hidden="true" className="mt-1 block h-0.5 w-10 rounded-full bg-amber-400" />
            <p className="mt-1 truncate text-[10.5px] font-semibold tabular-nums text-slate-400">
              {windowLabel}
              {typeof quarter.days === "number"
                ? ` · ${quarter.days} ${t("ops.dashboard.quarter_map.days")}`
                : ""}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold text-amber-700 ring-1 ring-inset ring-amber-200/80">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {t("ops.dashboard.quarter_map.sample")} · {quarter.label}
        </span>
      </div>

      {/* ── One tile per Operations register ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {TILES.map((tile) => {
          const value = counts[tile.field];
          const hasCount = typeof value === "number";
          const TileIcon = tile.Icon;
          return (
            <Link
              key={tile.key}
              to={tile.to}
              aria-label={`${t(tile.labelKey)} — ${hasCount ? `${(value as number).toLocaleString("en-IN")} ${t(tile.unitKey)}` : t("ops.dashboard.quarter_map.no_count")}`}
              className="group/map relative flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm ring-1 ring-inset ring-slate-200/70 transition-colors duration-150 group-hover/map:bg-amber-100/80">
                <TileIcon size={15} strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-slate-400 transition-colors duration-150 group-hover/map:text-amber-700">
                  {t(tile.labelKey)}
                </span>
                <span className="mt-0.5 block text-lg font-black leading-tight tabular-nums text-slate-800">
                  {hasCount ? (value as number).toLocaleString("en-IN") : "—"}
                </span>
                <span className="block truncate text-[10px] font-semibold text-slate-400">
                  {t(tile.unitKey)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Reference masters the same pages build their filters from ── */}
      {reference.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-300">
            {t("ops.dashboard.quarter_map.reference")}
          </span>
          {reference.map(({ field, labelKey, value }) => (
            <span key={field} className="text-[11.5px] font-bold tabular-nums text-slate-500">
              {value.toLocaleString("en-IN")}{" "}
              <span className="font-semibold text-slate-400">{t(labelKey)}</span>
            </span>
          ))}
          <span className="ml-auto hidden max-w-md text-right text-[10.5px] font-semibold text-slate-300 lg:block">
            {t("ops.dashboard.quarter_map.hint")}
          </span>
        </div>
      )}
    </section>
  );
}
