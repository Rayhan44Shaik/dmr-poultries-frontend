// -----------------------------------------------------------------------------
// PENDING APPROVALS — slim KPI strip for the dashboard and trip entry page.
// Four compact stat tiles: small coloured icon, count + label (same app font)
// and a one-line detail (the record numbers waiting). Clicking a tile opens
// that module's work page. Live data via the approval snapshot store.
// -----------------------------------------------------------------------------

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
import type { ApprovalQueue, ApprovalQueueItem } from "../../../approvals/services/approvalSnapshot";

interface Stat {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  count: number;
  queue: ApprovalQueue;
  chip: string; // coloured icon tile (literal classes so Tailwind keeps them)
  hover: string;
}

/** TRP-20260910-01 → 0910-01 (full reference stays in the tile tooltip). */
function shortRef(ref: string): string {
  const parts = ref.split("-");
  if (parts.length >= 3 && /^\d{8}$/.test(parts[parts.length - 2])) {
    return `${parts[parts.length - 2].slice(4)}-${parts[parts.length - 1]}`;
  }
  return ref;
}

/** One-line detail: two short refs, or the first ref with "+n" when long/many. */
function detailText(queue: ApprovalQueue): string {
  const refs = queue.items.map((i: ApprovalQueueItem) => shortRef(i.ref));
  if (refs.length === 0) return "";
  const pair = refs.slice(0, 2).join(", ");
  if (queue.count === 2 && pair.length <= 18) return pair;
  const extra = queue.count - 1;
  return extra > 0 ? `${refs[0]} +${extra}` : refs[0];
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
      queue: q.trips,
      chip: "bg-sky-100 text-sky-600",
      hover: "hover:border-sky-300 hover:bg-sky-50/40",
    },
    {
      key: "rates",
      label: "Rate entries",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      queue: q.rateEntries,
      chip: "bg-indigo-100 text-indigo-600",
      hover: "hover:border-indigo-300 hover:bg-indigo-50/40",
    },
    {
      key: "maintenance",
      label: "Maintenance",
      href: "/fleet?tab=entry",
      icon: Wrench,
      count: q.maintenance.count,
      queue: q.maintenance,
      chip: "bg-violet-100 text-violet-600",
      hover: "hover:border-violet-300 hover:bg-violet-50/40",
    },
    {
      key: "payments",
      label: "Payments",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      queue: q.payments,
      chip: "bg-emerald-100 text-emerald-600",
      hover: "hover:border-emerald-300 hover:bg-emerald-50/40",
    },
  ];

  return (
    <section
      aria-label="Pending approvals"
      className="rounded-xl border border-slate-200/70 bg-white p-2 shadow-sm"
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[46px] animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : allClear ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-semibold text-emerald-600">
          <CheckCircle2 size={14} strokeWidth={2.4} className="shrink-0" />
          Nothing pending for approval
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const empty = stat.count === 0;
            const detail = detailText(stat.queue);
            return (
              <Link
                key={stat.key}
                to={stat.href}
                title={
                  detail
                    ? `${stat.count} ${stat.label} pending — ${stat.queue.items
                        .map((i) => i.ref)
                        .join(", ")}`
                    : `${stat.count} ${stat.label} pending`
                }
                className={`flex items-center gap-2.5 rounded-lg border border-slate-200/70 px-2.5 py-2 transition-colors ${stat.hover} ${
                  empty ? "opacity-40" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${stat.chip}`}
                >
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[15px] font-extrabold tabular-nums text-slate-900">
                      {stat.count}
                    </span>
                    <span className="truncate text-[11.5px] font-semibold text-slate-500">
                      {stat.label}
                    </span>
                  </span>
                  {detail && (
                    <span className="mt-0.5 block truncate text-[10.5px] font-medium text-slate-400">
                      {detail}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
