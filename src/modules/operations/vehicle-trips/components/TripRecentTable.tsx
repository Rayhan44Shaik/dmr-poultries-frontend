import React, { useState } from "react";
import { Eye, Pencil, RefreshCw, History, Trash2 } from "lucide-react";
import type { Trip } from "../types/trip";
import {
  canEditTrip,
  canDeleteTrip,
  isTripCompleted,
  isTripPending,
} from "../services/tripFormService";

interface Props {
  trips?: Trip[];
  onRefresh: () => void;
  onView: (trip: Trip) => void;
  onEdit: (trip: Trip) => void;
  onDelete?: (trip: Trip) => void;
  onStatusChange?: (trip: Trip, status: "Pending" | "Completed") => void;
}

function TripRecentTable({
  trips = [],
  onRefresh,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}: Props) {
  const safeTrips = Array.isArray(trips) ? trips : [];
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Completed">("Pending");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // ✅ Changed from 5 to 10

  const sortedTrips = [...safeTrips].sort((a, b) => b.id - a.id);

  // ---- Filter & Count ----
  let filteredTrips: Trip[] = [];
  let pendingCount = 0;
  let completedCount = 0;

  if (statusFilter === "All") {
    const pending = sortedTrips.filter((t) => isTripPending(t.status));
    const completed = sortedTrips.filter((t) => isTripCompleted(t.status));
    filteredTrips = [...pending, ...completed];
    pendingCount = pending.length;
    completedCount = completed.length;
  } else if (statusFilter === "Pending") {
    filteredTrips = sortedTrips.filter((t) => isTripPending(t.status));
    pendingCount = filteredTrips.length;
  } else {
    filteredTrips = sortedTrips.filter((t) => isTripCompleted(t.status));
    completedCount = filteredTrips.length;
  }

  // ---- Pagination ----
  const totalPages = Math.ceil(filteredTrips.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTrips = filteredTrips.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const selectedTrip = safeTrips.find((t) => t.id === selectedTripId) || null;

  const canEdit = selectedTrip
    ? canEditTrip(selectedTrip.createdAt || "") && isTripPending(selectedTrip.status)
    : false;
  const canDelete = selectedTrip
    ? canDeleteTrip(selectedTrip.createdAt || "") && isTripPending(selectedTrip.status) && !!onDelete
    : false;

  const handleRowClick = (trip: Trip) => {
    setSelectedTripId(trip.id === selectedTripId ? null : trip.id);
  };

  const handleEditClick = () => {
    if (selectedTrip) onEdit(selectedTrip);
  };

  const handleDeleteClick = () => {
    if (selectedTrip && onDelete) onDelete(selectedTrip);
  };

  const label =
    statusFilter === "All"
      ? `(${pendingCount} pending, ${completedCount} completed)`
      : statusFilter === "Pending"
      ? `(${pendingCount} pending)`
      : `(${completedCount} completed)`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-3">
          <History className="w-4 h-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-700">Recent Trip List</h3>
          <span className="text-xs text-slate-400">{label}</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "All" | "Pending" | "Completed")
            }
            className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium bg-white"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEditClick}
            disabled={!canEdit}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              canEdit
                ? "bg-green-50 hover:bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            title="Edit selected trip"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={handleDeleteClick}
            disabled={!canDelete}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              canDelete
                ? "bg-red-50 hover:bg-red-100 text-red-600"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            title="Delete selected trip"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => onRefresh()}
            className="h-8 w-8 rounded-lg border bg-white hover:bg-slate-100 flex items-center justify-center"
            title="Refresh list"
          >
            <RefreshCw size={14} className="text-slate-600" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-slate-700">
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Trip No</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Date</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Vehicle</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Driver</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Supervisor</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Source Farm</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Shops</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Birds</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Weight (KG)</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Mortality</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">View</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTrips.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-6 text-center text-sm text-slate-400">
                  No trips available.
                </td>
              </tr>
            ) : (
              paginatedTrips.map((trip) => {
                const isSelected = trip.id === selectedTripId;
                const isCompleted = isTripCompleted(trip.status);

                return (
                  <tr
                    key={trip.id}
                    onClick={() => handleRowClick(trip)}
                    className={`border-t cursor-pointer transition-colors duration-150 ${
                      isSelected ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-blue-50"
                    }`}
                  >
                    <td className="px-3 py-2 font-semibold text-green-700 text-xs">
                      {trip.tripNo}
                    </td>
                    <td className="px-3 py-2 text-xs">{trip.tripDate}</td>
                    <td className="px-3 py-2 text-xs">{trip.vehicleNo}</td>
                    <td className="px-3 py-2 text-xs">{trip.driverName}</td>
                    <td className="px-3 py-2 text-xs">{trip.supervisorName}</td>
                    <td className="px-3 py-2 text-xs">{trip.sourceFarm}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold">
                      {trip.totalShops}
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-blue-700">
                      {trip.totalBirds.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-orange-600">
                      {trip.totalWeight.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-red-600">
                      {trip.totalMortality}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {onStatusChange && !isCompleted ? (
                        <select
                          value={trip.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onStatusChange(
                              trip,
                              e.target.value as "Pending" | "Completed"
                            )
                          }
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold border bg-white ${
                            trip.status === "Completed"
                              ? "text-green-600 border-green-300"
                              : "text-yellow-600 border-yellow-300"
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                            trip.status === "Completed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {trip.status}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(trip);
                        }}
                        className="h-7 w-7 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center mx-auto transition-colors"
                        title="View Trip"
                      >
                        <Eye size={14} className="text-blue-700" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Pagination Controls ---- */}
      {filteredTrips.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
          <div className="text-xs text-slate-500">
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, filteredTrips.length)} of {filteredTrips.length}
          </div>
          <div className="flex gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1 rounded-lg border disabled:opacity-40 hover:bg-slate-100 text-xs"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 w-7 rounded-lg border text-xs transition ${
                    page === currentPage
                      ? "bg-blue-600 text-white border-blue-600"
                      : "hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            {totalPages > 5 && <span className="px-2 text-slate-400">…</span>}
            {totalPages > 5 && (
              <button
                onClick={() => setCurrentPage(totalPages)}
                className="h-7 w-7 rounded-lg border text-xs hover:bg-slate-100"
              >
                {totalPages}
              </button>
            )}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg border disabled:opacity-40 hover:bg-slate-100 text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TripRecentTable);