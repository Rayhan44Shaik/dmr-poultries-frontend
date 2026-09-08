import { Pencil, Trash2 } from "lucide-react";
import type { Farm } from "../types/farm";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";

type FarmTableProps = {
  farms: Farm[];
  onEdit: (farm: Farm) => void;
  onDelete: (id: number) => void;
  /** Message shown when the list is empty (e.g. active search with no matches). */
  emptyMessage?: string;
};

function FarmTable({ farms, onEdit, onDelete, emptyMessage }: FarmTableProps) {
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Farm No</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Farm Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Owner</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Supervisor</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Village</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Phone</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {[...farms]
            .sort((a, b) => (a.farmNo > b.farmNo ? 1 : -1))
            .map((farm) => (
            <tr key={farm.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-sm text-slate-600">{farm.farmNo}</td>
              <td className="px-4 py-3 text-sm font-medium text-slate-800">{farm.farmName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{farm.ownerName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{farm.supervisorName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{farm.village}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{farm.phoneNumber}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                    farm.status === "Active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {farm.status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => onEdit(farm)}
                    className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit Farm"
                    aria-label={`Edit farm ${farm.farmName}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => requestDelete(farm.id, { label: `Deleting Farm "${farm.farmName}"` })}
                    className="rounded p-1 text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete Farm"
                    aria-label={`Delete farm ${farm.farmName}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {farms.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                {emptyMessage ?? "No farms found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <PendingDeleteNotification items={pendingItems} onCancel={cancel} />
    </div>
  );
}

export default FarmTable;