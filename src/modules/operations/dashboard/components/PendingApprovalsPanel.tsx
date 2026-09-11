// -----------------------------------------------------------------------------
// PENDING APPROVALS — compact KPI card for the dashboard.
// A header line plus four clean stat tiles: coloured icon, big number, short
// label. Nothing else. Each tile deep-links to that module's work page.
// Live API data via the same snapshot store as the header bell.
// -----------------------------------------------------------------------------

import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  Truck,
  Wrench,
} from "lucide-react";
import { usePendingApprovals } from "../../../approvals/hooks/usePendingApprovals";

interface Stat {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  count: number;
  chip: string; // coloured icon tile (literal classes so Tailwind keeps them)
  hover: string; // hover ring/border tint
}

export default function PendingApprovalsPanel() {
  const q = usePendingApprovals();
  const loading = !q.loaded;
  const allClear = q.loaded && q.total === 0;

  const stats: Stat[] = [
    {
      key: "trips",
      label: "Trips",
      href: "/operations?tab=trip-entry&status=Pending",
      icon: Truck,
      count: q.trips.count,
      chip: "bg-sky-100 text-sky-600 ring-sky-200/70",
      hover: "hover:border-sky-300 hover:shadow-sky-100",
    },
    {
      key: "rates",
      label: "Rate entries",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      chip: "bg-indigo-100 text-indigo-600 ring-indigo-200/70",
      hover: "hover:border-indigo-300 hover:shadow-indigo-100",
    },
    {
      key: "maintenance",
      label: "Maintenance",
      href: "/fleet?tab=entry",
      icon: Wrench,
      count: q.maintenance.count,
      chip: "bg-violet-100 text-violet-600 ring-violet-200/70",
      hover: "hover:border-violet-300 hover:shadow-violet-100",
    },
    {
      key: "payments",
      label: "Payments",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      chip: "bg-emerald-100 text-emerald-600 ring-emerald-200/70",
      hover: "hover:border-emerald-300 hover:shadow-emerald-100",
    },
  ];

  return (
    <section
      aria-label="Pending approvals"
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5"
    >
      {/* Card header */}
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 ring-1 ring-amber-200/70">
            <ClipboardCheck size={16} strokeWidth={2.3} />
          </span>
          <div className="leading-tight">
            <h2 className="text-sm font-extrabold tracking-tight text-slate-800">
              Pending approvals
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">Items waiting for your review</p>
          </div>
        </div>

        {!loading && !allClear && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-amber-700 ring-1 ring-amber-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
            {q.total} total
          </span>
        )}
      </div>

      {/* Tiles */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : allClear ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3.5 text-emerald-700 ring-1 ring-emerald-200/70">
          <CheckCircle2 size={18} strokeWidth={2.3} className="shrink-0" />
          <p className="text-[13px] font-bold">All caught up — nothing pending for approval</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const empty = stat.count === 0;
            return (
              <Link
                key={stat.key}
                to={stat.href}
                className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200/70 bg-white px-3.5 py-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${stat.hover} ${
                  empty ? "opacity-40 hover:translate-y-0" : ""
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${stat.chip}`}
                >
                  <Icon size={19} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 leading-none">
                  <span className="block text-[22px] font-black tabular-nums tracking-tight text-slate-900">
                    {stat.count}
                  </span>
                  <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </span>
                </span>
                {!empty && (
                  <ArrowUpRight
                    size={15}
                    className="absolute right-2.5 top-2.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
