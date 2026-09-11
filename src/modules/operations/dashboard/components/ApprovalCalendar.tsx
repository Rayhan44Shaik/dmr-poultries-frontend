import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, CreditCard, Route, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

type ApprovalCalendarProps = {
  startDate?: Date;
  endDate?: Date;
};

type ApprovalItem = {
  label: string;
  count: number;
  href: string;
  icon: typeof Route;
  tone: string;
  hint: string;
};

const readRows = (key: string): Record<string, unknown>[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const isPending = (value: unknown): boolean => {
  const status = String(value ?? "").trim().toLowerCase();
  return status === "pending" || status === "draft" || status === "submitted";
};

function getApprovalItems(startDate?: Date, endDate?: Date): ApprovalItem[] {
  const inRange = (row: Record<string, unknown>) => {
    if (!startDate || !endDate) return true;
    const raw = row.tripDate ?? row.date ?? row.paymentDate ?? row.createdAt;
    if (!raw) return true;
    const date = new Date(String(raw));
    if (Number.isNaN(date.getTime())) return true;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };
  const trips = readRows("vehicleTrips").filter(inRange);
  const maintenance = readRows("dmr-vehicle-maintenance").filter(inRange);
  const payments = readRows("dmr-payments").filter(inRange);

  // Rate Entry is completed from trip details. Only count active trips that
  // still have no usable rate, without changing any persisted data.
  const rateEntries = trips.filter((trip) => {
    const status = String(trip.status ?? "").toLowerCase();
    const rate = trip.rate ?? trip.ratePerKg ?? trip.marketRate ?? trip.saleRate;
    return !trip.deleted && (status === "pending" || status === "completed") && (rate === undefined || rate === null || rate === "");
  });

  return [
    {
      label: "Trips to approve",
      count: trips.filter((trip) => !trip.deleted && isPending(trip.status)).length,
      href: "/operations?tab=vehicle-trips",
      icon: Route,
      tone: "border-blue-100 bg-blue-50 text-blue-700",
      hint: "Pending trip approvals",
    },
    {
      label: "Maintenance bills",
      count: maintenance.filter((bill) => !bill.deletedAt && bill.paymentStatus !== "approved").length,
      href: "/fleet?tab=history",
      icon: Wrench,
      tone: "border-amber-100 bg-amber-50 text-amber-700",
      hint: "Bills awaiting approval",
    },
    {
      label: "Rate entries",
      count: rateEntries.length,
      href: "/operations?tab=rate-entry",
      icon: CheckCircle2,
      tone: "border-violet-100 bg-violet-50 text-violet-700",
      hint: "Trip rates still to enter",
    },
    {
      label: "Payments to approve",
      count: payments.filter((payment) => isPending(payment.status)).length,
      href: "/accounts?tab=payment-book",
      icon: CreditCard,
      tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
      hint: "Payment bills awaiting approval",
    },
  ];
}

export default function ApprovalCalendar({ startDate, endDate }: ApprovalCalendarProps) {
  const [items, setItems] = useState<ApprovalItem[]>(() => getApprovalItems(startDate, endDate));
  const refresh = useCallback(() => setItems(getApprovalItems(startDate, endDate)), [startDate, endDate]);

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm" aria-label="Approval calendar">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <CalendarDays size={16} />
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-800">Approval calendar</h2>
            <p className="text-[11px] font-medium text-slate-400">
              {startDate && endDate
                ? `Synced to ${startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                : "Synced to selected dashboard range"}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${total ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {total} pending
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.href}
              className={`group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${item.tone}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] font-medium opacity-70">{item.hint}</span>
              </span>
              <span className="text-xl font-black tabular-nums">{item.count}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
