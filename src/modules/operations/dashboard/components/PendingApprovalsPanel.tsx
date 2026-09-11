// -----------------------------------------------------------------------------
// PENDING APPROVALS — slim inline KPI strip for the dashboard / trip entry.
// Just a small coloured logo, the count and a short label per queue — nothing
// else. `actions` (e.g. the date-range filter) sits on the same row, right
// side. Live data via the approval snapshot store.
// -----------------------------------------------------------------------------

import type { ReactNode } from "react";
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

interface Stat {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  count: number;
  chip: string; // coloured icon tile (literal classes so Tailwind keeps them)
  hover: string;
}

export default function PendingApprovalsPanel({ actions }: { actions?: ReactNode }) {
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
      chip: "bg-sky-100 text-sky-600",
      hover: "hover:bg-sky-50",
    },
    {
      key: "rates",
      label: "Rate entries",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      chip: "bg-indigo-100 text-indigo-600",
      hover: "hover:bg-indigo-50",
    },
    {
      key: "maintenance",
      label: "Maintenance",
      href: "/fleet?tab=entry&view=pending",
      icon: Wrench,
      count: q.maintenance.count,
      chip: "bg-violet-100 text-violet-600",
      hover: "hover:bg-violet-50",
    },
    {
      key: "payments",
      label: "Payments",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      chip: "bg-emerald-100 text-emerald-600",
      hover: "hover:bg-emerald-50",
    },
  ];

  return (
    <section
      aria-label="Pending approvals"
      className="flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm"
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
                title={`${stat.count} ${stat.label} pending approval`}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors sm:px-3 ${stat.hover} ${
                  empty ? "opacity-40 hover:bg-transparent" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${stat.chip}`}
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
