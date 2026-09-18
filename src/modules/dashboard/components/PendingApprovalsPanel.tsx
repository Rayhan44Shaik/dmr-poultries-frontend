// -----------------------------------------------------------------------------
// PENDING APPROVALS — slim inline KPI strip for the dashboard / trip entry.
// Queues: Trips · Rate entries · Collections · Maintenance · Payments ·
// Leaves · Documents. Just a small coloured logo, the count and a short label
// per queue — nothing else. Each tile has a readable custom tooltip. `actions`
// (e.g. the date-range filter) sits on the same row, right side.
// Live data via the approval snapshot store.
// -----------------------------------------------------------------------------

import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  ReceiptText,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { useI18n } from "../../../i18n";
import { usePendingApprovals } from "../../approvals/hooks/usePendingApprovals";
import { PENDING_LEAVES_PATH } from "../../staff/utils/leaveDeepLink";

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
    preloadOnce(
      "ops",
      () => import("../../operations/pages/OperationsPages"),
    ),
  rates: () =>
    preloadOnce(
      "ops",
      () => import("../../operations/pages/OperationsPages"),
    ),
  collections: () =>
    preloadOnce(
      "ops",
      () => import("../../operations/pages/OperationsPages"),
    ),
  maintenance: () => {
    preloadOnce(
      "fleet",
      () => import("../../fleet-operations/pages/FleetPages"),
    );
    preloadOnce(
      "fleet-entry",
      () => import("../../fleet-operations/pages/MaintenanceEntryPage"),
    );
  },
  payments: () =>
    preloadOnce(
      "accounts",
      () => import("../../accounts/pages/AccountsPage"),
    ),
  leaves: () =>
    preloadOnce("staff", () => import("../../staff/pages/StaffPages")),
  documents: () => {
    preloadOnce(
      "fleet",
      () => import("../../fleet-operations/pages/FleetPages"),
    );
    preloadOnce(
      "fleet-permits",
      () => import("../../fleet-operations/pages/DocumentsExpiryPage"),
    );
  },
};

interface Stat {
  key: string;
  /** i18n key for the tile label (`ops.dashboard.approvals.<key>`). */
  labelKey: string;
  /** i18n key for the hover tooltip line. */
  tipKey: string;
  href: string;
  icon: LucideIcon;
  count: number;
  /** Tooltip bubble anchoring (responsive — tiles are 2-up on mobile, 4-up on sm+). */
  tipClass: string;
  /** Matching arrow position. */
  arrowClass: string;
  chip: string; // coloured icon tile (literal classes so Tailwind keeps them)
  hover: string;
  dot: string; // small coloured dot in the tooltip
}

export default function PendingApprovalsPanel({
  actions,
}: {
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const q = usePendingApprovals();
  const loading = !q.loaded;
  const allClear = q.loaded && q.total === 0 && q.documents.count === 0;

  // Warm the Fleet route (Maintenance + Documents tabs) on idle — these are
  // loaded as separate lazy chunks, so warming makes their tile clicks instant.
  useEffect(() => {
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1800));
    const handles = [
      idle(() => preloaders.maintenance()),
      idle(() => preloaders.documents()),
    ];
    return () =>
      handles.forEach((h) => window.cancelIdleCallback?.(h as number));
  }, []);

  const stats: Stat[] = [
    {
      key: "trips",
      labelKey: "ops.dashboard.approvals.trips",
      href: "/operations?tab=trip-entry&status=Pending",
      icon: Truck,
      count: q.trips.count,
      tipKey: "ops.dashboard.approvals.tip.trips",
      tipClass: "left-0",
      arrowClass: "left-4",
      chip: "bg-sky-100 text-sky-600",
      hover: "hover:bg-sky-50",
      dot: "bg-sky-500",
    },
    {
      key: "rates",
      labelKey: "ops.dashboard.approvals.rate_entries",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      tipKey: "ops.dashboard.approvals.tip.rate_entries",
      tipClass: "right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-indigo-100 text-indigo-600",
      hover: "hover:bg-indigo-50",
      dot: "bg-indigo-500",
    },
    {
      key: "collections",
      labelKey: "ops.dashboard.approvals.collections",
      href: "/operations?tab=collection",
      icon: Wallet,
      count: q.collections.count,
      tipKey: "ops.dashboard.approvals.tip.collections",
      tipClass: "left-0 sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "left-4 sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-amber-100 text-amber-600",
      hover: "hover:bg-amber-50",
      dot: "bg-amber-500",
    },
    {
      key: "maintenance",
      labelKey: "ops.dashboard.approvals.maintenance",
      href: "/fleet?tab=entry&view=pending",
      icon: Wrench,
      count: q.maintenance.count,
      tipKey: "ops.dashboard.approvals.tip.maintenance",
      tipClass: "left-0 sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "left-4 sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-violet-100 text-violet-600",
      hover: "hover:bg-violet-50",
      dot: "bg-violet-500",
    },
    {
      key: "payments",
      labelKey: "ops.dashboard.approvals.payments",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      tipKey: "ops.dashboard.approvals.tip.payments",
      tipClass: "right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-emerald-100 text-emerald-600",
      hover: "hover:bg-emerald-50",
      dot: "bg-emerald-500",
    },
    {
      key: "leaves",
      labelKey: "ops.dashboard.approvals.leaves",
      href: PENDING_LEAVES_PATH,
      icon: CalendarDays,
      count: q.leaves.count,
      tipKey: "ops.dashboard.approvals.tip.leaves",
      /* Tiles are 2-up on mobile, where this one lands in the right column, so
         the bubble hugs the right edge there and centres from `sm` up. */
      tipClass: "right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      arrowClass: "right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
      chip: "bg-cyan-100 text-cyan-700",
      hover: "hover:bg-cyan-50",
      dot: "bg-cyan-500",
    },
    {
      key: "documents",
      labelKey: "ops.dashboard.approvals.documents",
      href: "/fleet?tab=permits",
      icon: FileWarning,
      count: q.documents.count,
      tipKey: "ops.dashboard.approvals.tip.documents",
      tipClass: "left-0 sm:left-auto sm:right-0",
      arrowClass: "left-4 sm:left-auto sm:right-4",
      chip: "bg-rose-100 text-rose-600",
      hover: "hover:bg-rose-50",
      dot: "bg-rose-500",
    },
  ];

  const tipLine = (stat: Stat): string =>
    stat.count === 0
      ? stat.key === "documents"
        ? t("ops.dashboard.approvals.empty_tip_documents")
        : t("ops.dashboard.approvals.empty_tip", {
            label: t(stat.labelKey).toLowerCase(),
          })
      : t(stat.tipKey);

  const pendingTotal = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <section
      aria-label={t("ops.dashboard.approvals.title")}
      className="relative z-30 rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* ── Header: logo + title left, the calendar / refresh actions right ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/70">
            <ClipboardCheck size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-800">
              {t("ops.dashboard.approvals.title")}
            </h3>
            <span
              aria-hidden="true"
              className="mt-1 block h-0.5 w-10 rounded-full bg-amber-400"
            />
            <p className="mt-1 truncate text-[10.5px] font-semibold tabular-nums text-slate-400">
              {loading
                ? t("ops.dashboard.syncing")
                : t("ops.dashboard.approvals.subtitle", {
                    count: pendingTotal,
                  })}
            </p>
          </div>
        </div>
        {actions && (
          <div className="ml-auto flex items-center gap-2 pl-2">{actions}</div>
        )}
      </div>

      {/* ── One map-style tile per queue, same links / tooltips as before ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {loading ? (
          [0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100/70"
            />
          ))
        ) : allClear ? (
          <p className="col-span-full flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-[12px] font-semibold text-emerald-600">
            <CheckCircle2 size={14} strokeWidth={2.4} className="shrink-0" />
            {t("ops.dashboard.approvals.all_clear")}
          </p>
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            const empty = stat.count === 0;
            return (
              <Link
                key={stat.key}
                to={stat.href}
                onMouseEnter={() => preloaders[stat.key]()}
                onFocus={() => preloaders[stat.key]()}
                onTouchStart={() => preloaders[stat.key]()}
                aria-label={t("ops.dashboard.approvals.tile_aria", {
                  count: stat.count,
                  label: t(stat.labelKey),
                })}
                className={`group/tile relative flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-md active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                  empty ? "opacity-40 hover:bg-slate-50/40" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 origin-center items-center justify-center rounded-lg shadow-sm ring-1 ring-inset ring-slate-200/70 transition-transform duration-200 ease-out group-hover/tile:scale-110 group-active/tile:scale-75 group-active/tile:-rotate-12 motion-reduce:transform-none motion-reduce:transition-none ${stat.chip}`}
                >
                  <Icon size={15} strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-slate-400 transition-colors duration-150 group-hover/tile:text-amber-700">
                    {t(stat.labelKey)}
                  </span>
                  <span className="mt-0.5 block text-lg font-black leading-tight tabular-nums text-slate-800">
                    {stat.count}
                  </span>
                  <span className="block truncate text-[10px] font-semibold text-slate-400">
                    {t("ops.dashboard.approvals.pending_unit")}
                  </span>
                </span>

                {/* Readable custom tooltip — opens BELOW the tile (the strip
                    sits at page top, where an upward bubble would clip). */}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute top-[calc(100%+6px)] z-[70] w-max max-w-[230px] rounded-lg bg-slate-900 px-3 py-2 text-left text-[11.5px] font-medium leading-snug text-white opacity-0 shadow-xl shadow-slate-900/25 transition-opacity duration-75 ease-out delay-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100 motion-reduce:transition-none ${stat.tipClass}`}
                >
                  <span className="flex items-start gap-1.5">
                    <span
                      className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${stat.dot}`}
                    />
                    <span>
                      <span className="block text-[12px] font-bold text-white">
                        {stat.count} {t(stat.labelKey)}
                      </span>
                      <span className="block text-slate-300">
                        {tipLine(stat)}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`absolute -top-1 h-2 w-2 rotate-45 rounded-[2px] bg-slate-900 ${stat.arrowClass}`}
                  />
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
