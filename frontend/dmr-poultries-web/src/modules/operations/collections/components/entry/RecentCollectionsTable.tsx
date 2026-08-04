import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { RecentCollection } from "../../types/collection";

interface Props {
  collections: RecentCollection[];
  statusFilter: string;
  pendingApprovalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  onStatusChange: (status: "Pending" | "Approved" | "All") => void;
  onPageChange: (page: number) => void;
  onApprove: (id: string) => void;
  onEdit: (collection: RecentCollection) => void;
  onDelete: (id: string) => void;
  onViewShop: (shopName: string) => void;
}

const inr = (n: number) =>
  "₹ " + Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function RecentCollectionsTable({
  collections,
  statusFilter,
  pendingApprovalCount,
  currentPage,
  totalPages,
  onStatusChange,
  onPageChange,
  onApprove,
  onEdit,
  onDelete,
  onViewShop,
}: Props) {
  // Local search state
  const [searchQuery, setSearchQuery] = useState("");

  // Filter collections by search query (shop name or collection no)
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase().trim();
    return collections.filter(
      (col) =>
        col.shopName.toLowerCase().includes(q) ||
        col.collectionNo.toLowerCase().includes(q)
    );
  }, [collections, searchQuery]);

  // Compute displayed data based on status filter
  const displayedData = useMemo(() => {
    if (statusFilter === "Pending") {
      return filteredBySearch;
    }

    // For "Approved" or "All": group by shop, take the latest collection
    const shopMap = new Map<string, RecentCollection>();
    filteredBySearch.forEach((col) => {
      if (statusFilter === "Approved" && col.status !== "Approved") return;
      const existing = shopMap.get(col.shopName);
      if (!existing || col.collectionDate > existing.collectionDate) {
        shopMap.set(col.shopName, col);
      }
    });
    return Array.from(shopMap.values());
  }, [filteredBySearch, statusFilter]);

  const isGrouped = statusFilter !== "Pending";

  const clearSearch = () => setSearchQuery("");

  return (
    <div className="mt-2">
      {/* Header with tabs and search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-800">Recent Collections</h3>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Pending: {pendingApprovalCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {(["Pending", "Approved", "All"] as const).map((status) => (
              <button
                key={status}
                onClick={() => onStatusChange(status)}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-green-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shop or collection..."
              className="h-8 w-48 rounded-lg border border-slate-300 pl-8 pr-8 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table with full border */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-600">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {isGrouped ? "Shop" : "Collection No"}
              </th>
              {!isGrouped && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Shop
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                {isGrouped ? "Last Collection" : "Collector"}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                Amount
              </th>
              {!isGrouped && (
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                  Status
                </th>
              )}
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedData.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span>No collections found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayedData.map((col, index) => {
                const isPending = col.status === "Pending";
                return (
                  <tr
                    key={isGrouped ? col.shopName : col.id}
                    className={`border-t border-slate-100 hover:bg-blue-50/50 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    }`}
                  >
                    {isGrouped ? (
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {col.shopName}
                      </td>
                    ) : (
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {col.collectionNo}
                      </td>
                    )}
                    {!isGrouped && (
                      <>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {col.collectionDate}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          {col.shopName}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {isGrouped ? col.collectionDate : col.collectorName}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
                      {inr(col.amount)}
                    </td>
                    {!isGrouped && (
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                            col.status === "Approved"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {col.status}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => onApprove(col.id)}
                              className="rounded-lg bg-green-100 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => onEdit(col)}
                              className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDelete(col.id)}
                              className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onViewShop(col.shopName)}
                            className="rounded-lg bg-blue-100 px-4 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-200"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}