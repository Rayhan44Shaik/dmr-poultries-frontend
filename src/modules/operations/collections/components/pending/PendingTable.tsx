import { Eye, Trash2 } from "lucide-react";
import type { CollectionPendingSummaryRow } from "../../types/collection";
import { usePendingDelete } from "../../../../../hooks/usePendingDelete";
import { PendingDeleteActions } from "../../../../../components/common/PendingDeleteActions";
import { PENDING_DELETE_ACTION_CELL_CLASS, PENDING_DELETE_ROW_CLASS } from "../../../../../shared/ui/pendingDelete";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN");
};

const formatBalance = (amount: number) => {
  const abs = Math.abs(amount);
  const formatted = formatCurrency(abs);
  if (amount > 0) return `+ ${formatted}`;
  if (amount < 0) return `- ${formatted}`;
  return formatted;
};

interface PendingTableProps {
  data: CollectionPendingSummaryRow[];
  selectedShopName: string | null;
  onSelectShop: (shopName: string | null) => void;
  onView: (shopName: string) => void;
  onDelete: (shopName: string) => void;
  grandTotalPending: number;
  grandTotalWeeklySales: number;
  grandTotalWeeklyCollections: number;
}

export function PendingTable({
  data,
  selectedShopName,
  onSelectShop,
  onView,
  onDelete,
  grandTotalPending,
  grandTotalWeeklySales,
  grandTotalWeeklyCollections,
}: PendingTableProps) {
  const { requestDelete, cancel, isPending, secondsLeft, isCommitting } = usePendingDelete(onDelete);
  const handleRowClick = (shopName: string) => {
    if (selectedShopName === shopName) {
      onSelectShop(null);
    } else {
      onSelectShop(shopName);
    }
  };

  const selectedShop = data.find((s) => s.shopName === selectedShopName);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-white p-8 text-center text-slate-500">
        No pending collections found.
      </div>
    );
  }

  const formattedGrandTotal = formatBalance(grandTotalPending);

  return (
    <div>
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-green-200 bg-green-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            {selectedShop ? `Selected: ${selectedShop.shopName}` : "No shop selected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedShop && onView(selectedShop.shopName)}
            disabled={!selectedShop}
            title="View"
            className={`rounded-md p-1.5 transition ${
              selectedShop
                ? "text-blue-600 hover:bg-blue-100"
                : "cursor-not-allowed text-slate-300"
            }`}
          >
            <Eye size={18} />
          </button>
          <button
            onClick={() => selectedShop && requestDelete(selectedShop.shopName)}
            disabled={!selectedShop || (selectedShop ? isPending(selectedShop.shopName) : false)}
            title="Delete"
            className={`rounded-md p-1.5 transition ${
              selectedShop
                ? "text-red-600 hover:bg-red-100"
                : "cursor-not-allowed text-slate-300"
            }`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-lg border border-green-200 bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-green-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Shop Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Last Collection</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Balance</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Recent Sales</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Recent Collections</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Recovery %</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {data.map((shop, idx) => {
              const weeklySales = shop.weeklySales;
              const weeklyCollections = shop.weeklyApprovedCollections;
              const recovery = shop.recoveryPercentage;
              const balance = shop.balance;
              const balanceColor =
                balance > 0 ? "text-red-600" :
                balance < 0 ? "text-blue-600" :
                "text-slate-600";

              return (
                <tr
                  key={shop.shopId}
                  className={`cursor-pointer hover:bg-green-50 ${
                    selectedShopName === shop.shopName ? "bg-green-100" : ""
                  } ${isPending(shop.shopName) ? PENDING_DELETE_ROW_CLASS : ""}`}
                  onClick={() => handleRowClick(shop.shopName)}
                >
                  <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{shop.shopName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(shop.lastCollectionDate)}
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${balanceColor}`}>
                    {formatBalance(balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-blue-600">
                    {formatCurrency(weeklySales)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">
                    {formatCurrency(weeklyCollections)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <span
                      className={
                        recovery >= 80
                          ? "text-green-600"
                          : recovery >= 50
                          ? "text-amber-600"
                          : "text-red-600"
                      }
                    >
                      {recovery.toFixed(1)}%
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-center text-sm ${PENDING_DELETE_ACTION_CELL_CLASS}`}>
                    {isPending(shop.shopName) ? (
                      <PendingDeleteActions
                        secondsLeft={secondsLeft(shop.shopName)}
                        committing={isCommitting(shop.shopName)}
                        onCancel={() => cancel(shop.shopName)}
                      />
                    ) : (
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                      —
                    </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-700">
                Total (All Pages)
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                {formattedGrandTotal}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                {formatCurrency(grandTotalWeeklySales)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                {formatCurrency(grandTotalWeeklyCollections)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
