// -----------------------------------------------------------------------------
// PENDING APPROVALS — slim inline KPI strip for the dashboard / trip entry.
// Just a small coloured logo, the count and a short label per queue — nothing
// else. Each tile has a readable custom tooltip. `actions` (e.g. the
// date-range filter) sits on the same row, right side.
// Live data via the approval snapshot store.
// -----------------------------------------------------------------------------

import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CheckCircle2,
  ReceiptText,
  Truck,
  Wrench,
} from "lucide-react";
import { usePendingApprovals } from "../../../approvals/hooks/usePendingApprovals";

/* Preload the destination route/tab chunk as soon as a tile is hovered or
   focused, so the click itself never waits on a download. Bundler de-dupes. */
const preloadOnce = (() => {
  const done = new Set<string>();
  return (key: string, load: () => Promise<unknown>) => {
    if (done.has(key)) return;
    done.add(key);
    void load().catch(() => done.delete(key));
  };
})();

const preloaders: Record<string, () => void> = {
  trips: () =>
    preloadOnce("ops", () => import("../../../operations/pages/OperationsPages")),
  rates: () =>
    preloadOnce("ops", () => import("../../../operations/pages/OperationsPages")),
  maintenance: () => {
    preloadOnce("fleet", () => import("../../../fleet-operations/pages/FleetPages"));
    preloadOnce("fleet-entry", () =>
      import("../../../fleet-operations/pages/MaintenanceEntryPage")
    );
  },
  payments: () =>
    preloadOnce("accounts", () => import("../../../accounts/pages/AccountsPage")),
};

interface Stat {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  count: number;
  /** Readable hover tooltip line. */
  tip: string;
  /** Tooltip bubble anchoring (responsive — tiles are 2-up on mobile, 4-up on sm+). */
  tipClass: string;
  /** Matching arrow position. */
  arrowClass: string;
  chip: string; // coloured icon tile (literal classes so Tailwind keeps them)
  hover: string;
  dot: string; // small coloured dot in the tooltip
}

export default function PendingApprovalsPanel({ actions }: { actions?: ReactNode }) {
  const q = usePendingApprovals();
  const loading = !q.loaded;
  const allClear = q.loaded && q.total === 0;

  // Warm the maintenance (Fleet) route on idle — it is the one destination
  // loaded as a separate lazy chunk, so this makes its tile click instant.
  useEffect(() => {
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1800));
    const handle = idle(() => preloaders.maintenance());
    return () => window.cancelIdleCallback?.(handle as number);
  }, []);

  const stats: Stat[] = [
    {
      key: "trips",
      label: "Trips",
      href: "/operations?tab=trip-entry&status=Pending",
      icon: Truck,
      count: q.trips.count,
      tip: "Trips completed and waiting for your approval",
      tipClass: "left-0",
      arrowClass: "left-4",
      chip: "bg-sky-100 text-sky-600",
      hover: "hover:bg-sky-50",
      dot: "bg-sky-500",
    },
    {
      key: "rates",
      label: "Rate entries",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      tip: "Completed trips that still need shop sale rates",
      tipClass: "right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-indigo-100 text-indigo-600",
      hover: "hover:bg-indigo-50",
      dot: "bg-indigo-500",
    },
    {
      key: "maintenance",
      label: "Maintenance",
      href: "/fleet?tab=entry&view=pending",
      icon: Wrench,
      count: q.maintenance.count,
      tip: "Maintenance bills waiting to be verified",
      tipClass: "left-0 sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "left-4 sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-violet-100 text-violet-600",
      hover: "hover:bg-violet-50",
      dot: "bg-violet-500",
    },
    {
      key: "payments",
      label: "Payments",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      tip: "Draft payment requests waiting for approval",
      tipClass: "right-0",
      arrowClass: "right-4",
      chip: "bg-emerald-100 text-emerald-600",
      hover: "hover:bg-emerald-50",
      dot: "bg-emerald-500",
    },
  ];

  const tipLine = (stat: Stat): string =>
    stat.count === 0 ? `No ${stat.label.toLowerCase()} pending right now` : stat.tip;

  return (
    <section
      aria-label="Pending approvals"
      className="relative z-30 flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm"
    >
      {loading ? (
        <div className="flex items-center gap-4 px-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : allClear ? (
        <p className="flex items-center gap-1.5 px-1 text-[12px] font-semibold text-emerald-600">
          <CheckCircle2 size={14} strokeWidth={2.4} className="shrink-0" />
          Nothing pending for approval
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const empty = stat.count === 0;
            return (
              <Link
                key={stat.key}
                to={stat.href}
                onMouseEnter={() => preloaders[stat.key]()}
                onFocus={() => preloaders[stat.key]()}
                onTouchStart={() => preloaders[stat.key]()}
                aria-label={`${stat.count} ${stat.label} pending — open ${stat.label}`}
                className={`group/tile relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-150 active:scale-[0.96] sm:px-3 motion-reduce:transition-none motion-reduce:active:scale-100 ${stat.hover} ${
                  empty ? "opacity-40 hover:bg-transparent" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 origin-center items-center justify-center rounded-lg transition-transform duration-200 ease-out group-hover/tile:scale-110 group-active/tile:scale-75 group-active/tile:-rotate-12 motion-reduce:transform-none motion-reduce:transition-none ${stat.chip}`}
                >
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <span className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-[15px] font-extrabold tabular-nums text-slate-900">
                    {stat.count}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-500">
                    {stat.label}
                  </span>
                </span>

                {/* Readable custom tooltip — opens BELOW the tile (the strip
                    sits at page top, where an upward bubble would clip). */}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute top-[calc(100%+6px)] z-[70] w-max max-w-[230px] rounded-lg bg-slate-900 px-3 py-2 text-left text-[11.5px] font-medium leading-snug text-white opacity-0 shadow-xl shadow-slate-900/25 transition-opacity duration-75 ease-out delay-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100 motion-reduce:transition-none ${stat.tipClass}`}
                >
                  <span className="flex items-start gap-1.5">
                    <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${stat.dot}`} />
                    <span>
                      <span className="block text-[12px] font-bold text-white">
                        {stat.count} {stat.label}
                      </span>
                      <span className="block text-slate-300">{tipLine(stat)}</span>
                    </span>
                  </span>
                  <span
                    className={`absolute -top-1 h-2 w-2 rotate-45 rounded-[2px] bg-slate-900 ${stat.arrowClass}`}
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {actions && (
        <div className="ml-auto flex items-center gap-2 pl-2">{actions}</div>
      )}
    </section>
  );
}
