// -----------------------------------------------------------------------------
// PENDING APPROVALS — simple, single-row KPI strip for the dashboard.
// Four plain stats (trips, rate entries, maintenance bills, payments) with a
// live count each. Clicking a stat opens that module's work page.
// Live API data via the same snapshot store as the header bell.
// `bare` renders the strip without its own card (to sit inside another card).
// -----------------------------------------------------------------------------

import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  Truck,
  Wrench,
} from "lucide-react";
import { usePendingApprovals } from "../../../approvals/hooks/usePendingApprovals";
import { inr } from "../../../approvals/approvalsUtils";

interface Stat {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  count: number;
  sub?: string;
  iconClass: string;
}

export default function PendingApprovalsPanel({ bare = false }: { bare?: boolean }) {
  const q = usePendingApprovals();
  const loading = !q.loaded;

  const stats: Stat[] = [
    {
      key: "trips",
      label: "Trips",
      href: "/operations?tab=trip-entry&status=Pending",
      icon: Truck,
      count: q.trips.count,
      sub: `${q.trips.birds.toLocaleString("en-IN")} birds`,
      iconClass: "bg-sky-50 text-sky-600",
    },
    {
      key: "rates",
      label: "Rate entries",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      sub: "shop rates to enter",
      iconClass: "bg-cyan-50 text-cyan-600",
    },
    {
      key: "maintenance",
      label: "Maintenance bills",
      href: "/fleet?tab=entry",
      icon: Wrench,
      count: q.maintenance.count,
      sub: inr.format(q.maintenance.value),
      iconClass: "bg-violet-50 text-violet-600",
    },
    {
      key: "payments",
      label: "Payments",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      sub: inr.format(q.payments.value),
      iconClass: "bg-emerald-50 text-emerald-600",
    },
  ];

  const strip = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
      {/* Label */}
      <div className="flex items-center gap-2 pr-1">
        <ClipboardCheck size={17} className="shrink-0 text-amber-600" />
        <span className="whitespace-nowrap text-[13px] font-bold text-slate-700">
          Pending approvals
        </span>
        {!loading && q.total > 0 && (
          <span
            className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-extrabold tabular-nums text-white"
            title={`${q.total} items waiting for approval`}
          >
            {q.total}
          </span>
        )}
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-28 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : q.total === 0 ? (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
          <CheckCircle2 size={15} />
          All caught up — nothing pending
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:divide-x sm:divide-slate-100">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const empty = stat.count === 0;
            return (
              <Link
                key={stat.key}
                to={stat.href}
                title={`${stat.count} ${stat.label} pending approval`}
                className={`group flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50 ${
                  empty ? "opacity-45" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.iconClass}`}
                >
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[17px] font-extrabold tabular-nums text-slate-900">
                    {stat.count}
                    <span className="ml-1.5 text-[12.5px] font-bold text-slate-500">
                      {stat.label}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] font-medium text-slate-400">
                    {stat.sub}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  if (bare) return strip;

  return (
    <section
      aria-label="Pending approvals"
      className="flex flex-wrap items-center rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
    >
      {strip}
    </section>
  );
}
