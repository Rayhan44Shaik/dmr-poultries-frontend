import { Pencil, Trash2 } from "lucide-react";
import type { Route } from "../types/route";

type RouteTableProps = {
  routes: Route[];
  onEdit: (route: Route) => void;
  onDelete: (id: number) => void;
};

function RouteTable({ routes, onEdit, onDelete }: RouteTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">ROUTE NO</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">ROUTE NAME</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">ROUTE CODE</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">DESCRIPTION</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">STATUS</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {[...routes]
            .sort((a, b) => (a.routeNo > b.routeNo ? 1 : -1))
            .map((route) => (
            <tr key={route.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-sm text-slate-600">{route.routeNo}</td>
              <td className="px-4 py-3 text-sm font-medium text-slate-800">{route.routeName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{route.routeCode || "-"}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{route.description || "-"}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                    route.status === "Active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {route.status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => onEdit(route)}
                    className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(route.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {routes.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                No routes found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RouteTable;
