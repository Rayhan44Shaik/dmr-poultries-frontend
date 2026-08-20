import { IndianRupee, TrendingUp, ShoppingBag, CreditCard } from "lucide-react";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

interface PendingKPICardsProps {
  totalPending: number;
  weeklySales: number;
  weeklyCollections: number;
  weeklyRecovery: number;
}

export function PendingKPICards({
  totalPending,
  weeklySales,
  weeklyCollections,
  weeklyRecovery,
}: PendingKPICardsProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {/* Total Outstanding — sum of authoritative Shop Master balances */}
      <div className="flex min-w-[160px] items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
        <div className="rounded-full bg-red-100 p-2 text-red-600">
          <IndianRupee size={18} />
        </div>
        <div>
          <div className="text-xs font-medium text-red-600">Total Outstanding</div>
          <div className="text-lg font-bold text-red-700">{formatCurrency(totalPending)}</div>
        </div>
      </div>

      {/* Weekly Sales */}
      <div className="flex min-w-[160px] items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
        <div className="rounded-full bg-blue-100 p-2 text-blue-600">
          <ShoppingBag size={18} />
        </div>
        <div>
          <div className="text-xs font-medium text-blue-600">This Week Sales</div>
          <div className="text-lg font-bold text-blue-700">{formatCurrency(weeklySales)}</div>
        </div>
      </div>

      {/* Weekly Collections */}
      <div className="flex min-w-[160px] items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
        <div className="rounded-full bg-green-100 p-2 text-green-600">
          <CreditCard size={18} />
        </div>
        <div>
          <div className="text-xs font-medium text-green-600">This Week Collections</div>
          <div className="text-lg font-bold text-green-700">{formatCurrency(weeklyCollections)}</div>
        </div>
      </div>

      {/* Recovery % */}
      <div className="flex min-w-[160px] items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm">
        <div className="rounded-full bg-purple-100 p-2 text-purple-600">
          <TrendingUp size={18} />
        </div>
        <div>
          <div className="text-xs font-medium text-purple-600">Recovery %</div>
          <div className="text-lg font-bold text-purple-700">
            {weeklyRecovery.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}