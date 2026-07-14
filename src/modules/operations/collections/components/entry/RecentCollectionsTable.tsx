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
}: Props) {
  return (
    <div className="mt-2">
      {/* Header with larger, cleaner design */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-800">Recent Collections</h3>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Pending: {pendingApprovalCount}
          </span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as any)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        >
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="All">All</option>
        </select>
      </div>

      {/* Table with improved styling */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-600">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Collection No
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Shop
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Collector
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span>No collections found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              collections.map((col, index) => (
                <tr
                  key={col.id}
                  className={`border-t border-slate-100 hover:bg-blue-50/50 transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                >
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">
                    {col.collectionNo}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {col.collectionDate}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {col.shopName}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {col.collectorName}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
                    {inr(col.amount)}
                  </td>
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
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {col.status === "Pending" && (
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
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - cleaner */}
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