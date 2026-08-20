import { Wallet, ShoppingCart, Download, Calculator, Clock, Store } from "lucide-react";

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
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <div>
          <span className="text-sm font-medium text-slate-700">{title}</span>
          {subtitle && (
            <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>
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

  return (
    <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header section is always visible */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Calculator size={18} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Outstanding Summary</h2>
        </div>
        {shopName && showSummary && (
          <span className="rounded-full bg-blue-100/80 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">
            {shopName}
          </span>
        )}
      </div>

      {/* Conditional Rendering: Show Empty State OR Data Rows */}
      {!showSummary ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200/50">
            <Store size={28} className="text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">No Shop Selected</h3>
          <p className="mt-1.5 max-w-[220px] text-xs text-slate-500">
            Please select a shop from the ledger to view its account statement and outstanding balance.
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-500">
          <Row
            title="Opening Balance"
            value={openingBalance}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            icon={<Wallet size={18} />}
          />
          <Row
            title="Recent Sales"
            value={weeklySales}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            icon={<ShoppingCart size={18} />}
            subtitle={dateRange}
          />
          <Row
            title="Recent Collections (Approved)"
            value={weeklyCollections}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            icon={<Download size={18} />}
            subtitle={dateRange}
          />
          <Row
            title="Pending Approval"
            value={weeklyPending}
            iconBg="bg-yellow-100"
            iconColor="text-yellow-700"
            icon={<Clock size={18} />}
            subtitle={dateRange}
          />

          <div className="my-4 border-t border-dashed border-slate-200" />

          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-600 text-white shadow-sm">
                <Calculator size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">
                  Current Balance
                </span>
                <span className="text-[11px] font-medium text-green-700">
                  Outstanding Amount
                </span>
              </div>
            </div>
            <span className="text-xl font-extrabold tabular-nums text-green-700">
              {inr(currentPending)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}