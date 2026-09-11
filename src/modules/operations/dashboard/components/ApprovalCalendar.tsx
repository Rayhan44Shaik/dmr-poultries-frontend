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
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-slate-500" aria-label="Approval summary">
      <CalendarDays size={15} className="shrink-0 text-slate-400" />
      <div className="flex shrink-0 items-center">
        {items.map((item, index) => (
          <span key={item.label} className="flex items-center">
            {index > 0 && <span className="mx-2 text-slate-300">•</span>}
            <Link to={item.href} className="rounded-md px-1.5 py-1 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
              <span className="text-blue-600">{item.count}</span> {item.label}
            </Link>
          </span>
        ))}
      </div>
      <span className={`ml-auto hidden shrink-0 border-l border-slate-200 pl-3 font-bold sm:inline ${total ? "text-amber-600" : "text-emerald-600"}`}>
        {total ? `${total} pending` : "All clear"}
      </span>
    </div>
  );
}
