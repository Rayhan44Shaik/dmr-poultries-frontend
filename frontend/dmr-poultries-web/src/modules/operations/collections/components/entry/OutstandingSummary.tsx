import { Wallet, ShoppingCart, Download, Calculator, Clock } from "lucide-react";

interface Props {
  openingBalance: number;
  weeklySales: number;
  weeklyCollections: number;        // Approved collections
  weeklyPending?: number;           // Pending collections (not approved yet)
  currentPending: number;
  showSummary: boolean;
  shopName?: string;
  dateRange: string;
}

const inr = (n: number) =>
  "₹ " + Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface RowProps {
  title: string;
  value: number;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  subtitle?: string;
}

function Row({ title, value, iconBg, iconColor, icon, subtitle }: RowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <div>
          <span className="text-sm font-medium text-slate-600">{title}</span>
          {subtitle && (
            <div className="text-[10px] text-slate-400">{subtitle}</div>
          )}
        </div>
      </div>
      <span className="text-base font-bold tabular-nums text-slate-800">
        {inr(value)}
      </span>
    </div>
  );
}

export default function OutstandingSummary({
  openingBalance,
  weeklySales,
  weeklyCollections,
  weeklyPending = 0,
  currentPending,
  showSummary,
  shopName,
  dateRange,
}: Props) {
  const displayBalance = showSummary ? openingBalance : 0;
  const displayWeeklySales = showSummary ? weeklySales : 0;
  const displayWeeklyCollections = showSummary ? weeklyCollections : 0;
  const displayWeeklyPending = showSummary ? weeklyPending : 0;
  const displayPending = showSummary ? currentPending : 0;

  return (
    <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Calculator size={16} />
          </div>
          <h2 className="text-lg font-semibold text-green-800">Outstanding Summary</h2>
        </div>
        {shopName && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {shopName}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <Row
          title="Opening Balance"
          value={displayBalance}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          icon={<Wallet size={18} />}
        />
        <Row
          title="Recent Sales"
          value={displayWeeklySales}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          icon={<ShoppingCart size={18} />}
          subtitle={dateRange}
        />
        <Row
          title="Recent Collections (Approved)"
          value={displayWeeklyCollections}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          icon={<Download size={18} />}
          subtitle={dateRange}
        />
        {/* ✅ New row for Pending Approval */}
        <Row
          title="Pending Approval"
          value={displayWeeklyPending}
          iconBg="bg-yellow-100"
          iconColor="text-yellow-700"
          icon={<Clock size={18} />}
          subtitle={dateRange}
        />

        <div className="border-t border-dashed border-slate-200" />

        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-white">
              <Calculator size={18} />
            </div>
            <span className="text-sm font-semibold text-slate-700">
              Current Balance (Outstanding)
            </span>
          </div>
          <span className="text-lg font-extrabold tabular-nums text-green-700">
            {inr(displayPending)}
          </span>
        </div>
      </div>
    </div>
  );
}