// src/modules/operations/vehicle-trips/components/TripRecentTable.tsx

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Eye, Pencil, RefreshCw, History, Trash2, Clock, AlertCircle, Search, FileText, CheckCircle } from "lucide-react";
import type { Trip } from "../types/trip";
import { canEditItem, canDeleteItem } from "../../../../utils/dateUtils";
import { formatTripRecentDateWithDay } from "../utils/formatTripListDay";
import TripPagination from "./TripPagination";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { getNextIncompleteTripStep, isTripWizardComplete, isValidTripStatusTransition, getValidNextStatuses, type TripStatus } from "../../../../shared/trip";
import { useI18n } from "../../../../i18n";
import { notify as globalNotify } from "../../../../ui/notifications/notificationStore";
import { uniqueTripsById } from "../services/tripHeaderApiService";

interface Props {
  trips?: Trip[];
  onRefresh: () => void;
  onView: (trip: Trip) => void;
  onEdit: (trip: Trip) => void;
  onResume?: (trip: Trip) => void;
  onDelete?: (trip: Trip, reason: string) => void;
  // ✅ Updated: accept optional approvedBy parameter - now supports all valid status transitions
  onStatusChange?: (trip: Trip, status: TripStatus, approvedBy?: string) => void;
}

function TripRecentTable({
  trips = [],
  onRefresh,
  onView,
  onEdit,
  onResume,
  onDelete,
  onStatusChange,
}: Props) {
  const { t } = useI18n();
  const safeTrips = uniqueTripsById(Array.isArray(trips) ? trips : []);

  /** Translate, but never surface a raw i18n key: returns "" when the key is missing. */
  const tSafe = (key: string, params?: Record<string, string | number>) => {
    const value = t(key, params);
    return value === key ? "" : value;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"Draft" | "Pending" | "Deleted">("Draft");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const pendingDeletesRef = useRef<Map<number, { trip: Trip; reason: string }>>(new Map());
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const { requestDelete, cancel, isPending, pendingItems } = usePendingDelete<number>(async (id) => {
    const pending = pendingDeletesRef.current.get(id);
    pendingDeletesRef.current.delete(id);
    const trip = pending?.trip ?? safeTrips.find((t) => Number(t.id) === Number(id)) ?? ({ id } as Trip);
    const reason = pending?.reason ?? "";
    const deleteFn = onDeleteRef.current;
    if (deleteFn) await Promise.resolve(deleteFn(trip, reason));
    setSelectedTripId(null);
  });

  const tableRef = useRef<HTMLDivElement>(null);

  // ✅ Get current user name (or fallback to "Admin")
  const getCurrentUser = () => {
    try {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user).name : "Admin";
    } catch {
      return "Admin";
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setSelectedTripId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filterBySearch = (trips: Trip[]) => {
    if (!searchTerm.trim()) return trips;
    const lower = searchTerm.toLowerCase();
    return trips.filter((t) =>
      t.tripNo.toLowerCase().includes(lower) ||
      t.tripDate.includes(lower) ||
      t.vehicleNo.toLowerCase().includes(lower) ||
      t.driverName.toLowerCase().includes(lower) ||
      t.supervisorName.toLowerCase().includes(lower) ||
      t.sourceFarm.toLowerCase().includes(lower)
    );
  };

  const sortedTrips = useMemo(() => {
    const filtered = filterBySearch(safeTrips);
    return [...filtered].sort((a, b) => {
      if (a.tripDate !== b.tripDate) return a.tripDate < b.tripDate ? 1 : -1;
      return b.id - a.id;
    });
  }, [safeTrips, searchTerm]);

  const allDraft = sortedTrips.filter((t) => !t.deleted && t.status === "Draft");
  const allPending = sortedTrips.filter((t) => !t.deleted && t.status === "Pending");
  const allDeleted = sortedTrips.filter((t) => t.deleted === true || t.status === "Deleted");

  /** Count beside “Recent Trip Activity” follows the selected tab (Draft/Pending/Deleted). */
  const selectedTabCount =
    statusFilter === "Draft" ? allDraft.length : statusFilter === "Pending" ? allPending.length : allDeleted.length;

  let filteredTrips: Trip[] = [];
  if (statusFilter === "Draft") filteredTrips = allDraft;
  else if (statusFilter === "Pending") filteredTrips = allPending;
  else filteredTrips = allDeleted;

  const totalPages = Math.ceil(filteredTrips.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTrips = filteredTrips.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  const selectedTrip = safeTrips.find((t) => t.id === selectedTripId) || null;

  const canEdit = selectedTrip
    ? canEditItem(selectedTrip.createdAt || "") && !selectedTrip.deleted
    : false;
  const canDelete = selectedTrip
    ? canDeleteItem(selectedTrip.createdAt || "") && !selectedTrip.deleted && !!onDelete && !isPending(Number(selectedTrip.id))
    : false;

  const handleRowClick = (trip: Trip) => {
    if (trip.deleted) return;
    if (isPending(Number(trip.id))) return;
    setSelectedTripId(trip.id === selectedTripId ? null : trip.id);
  };

  const handleEditClick = () => {
    if (selectedTrip) onEdit(selectedTrip);
  };

  const openDeleteModal = () => {
    if (!selectedTrip) return;
    setTripToDelete(selectedTrip);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!tripToDelete || deleteReason.trim() === "") {
      // Was `return alert(...)`. The early-return guard is preserved exactly;
      // only the blocking native dialog became a shared toast.
      globalNotify.warning(t("ops.trip.delete_reason_required"));
      return;
    }
    const id = Number(tripToDelete.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const reason = deleteReason.trim();
    const trip = tripToDelete;
    setShowDeleteModal(false);
    setTripToDelete(null);
    setDeleteReason("");
    if (isPending(id)) return;
    pendingDeletesRef.current.set(id, { trip, reason });
    requestDelete(id, { label: t("ops.trip.deleting_trip", { no: trip.tripNo }) });
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTripToDelete(null);
    setDeleteReason("");
  };

  const getStepBadge = (trip: Trip) => {
    // Completed may still exist on older sample rows — show label only (no status change option).
    if (trip.status === "Completed") {
      return { label: t("status.completed"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle size={12} />, resume: false };
    }
    if (trip.status === "Pending") {
      return { label: t("status.pending"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={12} />, resume: false };
    }
    // Defensive: wizard fully submitted but status still Draft → treat as Pending
    // (Step 5 submit should have moved it; never show Completed from Draft).
    if (isTripWizardComplete(trip)) {
      return { label: t("status.pending"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={12} />, resume: false };
    }
    // A Draft trip always has Step 1 submitted (trips are created on Step 1
    // submit), so it is always mid-workflow: show ONLY which step is pending
    // next — no step name / farm detail.
    const nextStep = getNextIncompleteTripStep(trip);
    return {
      label: t("ops.trip.step_label", { step: nextStep + 1 }),
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <FileText size={12} />,
      resume: true,
    };
  };

  // Status control: Draft→Pending happens automatically on Step 5 submit.
  // Completed is NOT offered on Trip Entry. `Pending → Draft` never exists.
  // Deletion goes exclusively through the Delete action + 10s undo.
  const handleStatusChange = (trip: Trip, newStatus: TripStatus) => {
    if (newStatus === "Completed") return; // never offered / never accepted here
    if (!isValidTripStatusTransition(trip.status, newStatus)) {
      return; // Invalid transition - silently ignore (backend will also reject)
    }
    if (newStatus === "Pending") {
      if (onStatusChange) onStatusChange(trip, newStatus);
    }
  };

  // Valid next statuses for Trip Entry — Completed is never in the list.
  const getValidStatusOptions = (currentStatus: TripStatus): TripStatus[] => {
    return getValidNextStatuses(currentStatus).filter((s) => s !== "Completed");
  };

  return (
    <>
      <div ref={tableRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden mt-8 transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.trip.recent_trip_activity")}</h3>
            </div>

            {/* Selected-tab count beside the title (updates when Draft/Pending/Deleted is clicked) */}
            <span
              className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums"
              title={statusFilter}
            >
              {selectedTabCount}
            </span>

            {/* Status toggle — labels only (no per-tab counts); height unchanged, still wide */}
            <div className="flex items-center p-0.5 ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 shadow-sm">
              {(["Draft", "Pending", "Deleted"] as const).map((tab) => {
                const isActive = statusFilter === tab;
                const activeClass =
                  tab === "Draft"
                    ? "bg-emerald-100 text-emerald-700 shadow-sm"
                    : tab === "Pending"
                    ? "bg-orange-100 text-orange-700 shadow-sm"
                    : "bg-rose-100 text-rose-700 shadow-sm";
                const label = (() => {
                  const k = "status." + tab.toLowerCase();
                  const v = t(k);
                  return v === k ? tab : v;
                })();
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center px-5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      isActive
                        ? activeClass
                        : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder={t("ops.trip.search_trips_short")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-1">
              <button onClick={handleEditClick} disabled={!canEdit} className={`h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${canEdit ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 active:scale-95" : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"}`} title={t("ops.trip.edit_selected_trip")}>
                <Pencil size={13} />
                <span className="hidden md:inline">{t("common.edit")}</span>
              </button>
              <button onClick={openDeleteModal} disabled={!canDelete} className={`h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${canDelete ? "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 active:scale-95" : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"}`} title={t("ops.trip.delete_selected_trip")}>
                <Trash2 size={13} />
                <span className="hidden md:inline">{t("common.delete")}</span>
              </button>
              <button onClick={() => onRefresh()} className="h-8 w-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all shadow-sm active:scale-95 hover:border-slate-300" title={t("common.refresh")}>
                <RefreshCw size={13} className="text-slate-600 transition-transform active:rotate-180" />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("operations.trip_no")}</th>
                <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("ops.trip.day")}</th>
                <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("common.vehicle")}</th>
                <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("common.driver")}</th>
                <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("common.supervisor")}</th>
                <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("ops.trip.source_farm")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("ops.trip.shops")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("common.birds")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("ops.trip.weight_kg")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("operations.mortality_count")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("common.status")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("common.view")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTrips.length === 0 ? (
                <tr><td colSpan={12} className="py-16 text-center text-slate-400"><History size={24} className="mx-auto mb-2" /> {t("empty.no_trips")}</td></tr>
              ) : (
                paginatedTrips.map((trip) => {
                  const isSelected = trip.id === selectedTripId;
                  const isDeleted = trip.deleted === true;
                  const isApproved = trip.status === "Completed";

                  return (
                    <tr key={trip.id} onClick={() => handleRowClick(trip)} className={`cursor-pointer transition-all duration-150 group ${isDeleted ? "bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-400" : isSelected ? "bg-blue-50/80 shadow-inner border-l-4 border-l-blue-600" : "hover:bg-slate-50/80"}`}>
                      <td className="px-4 py-3 font-bold text-emerald-700 text-xs">
                        <span className={`bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/80 ${isDeleted ? "opacity-60 line-through" : ""}`}>{trip.tripNo}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">{formatTripRecentDateWithDay(trip.tripDate)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{trip.vehicleNo}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{trip.driverName}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{trip.supervisorName}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">{trip.sourceFarm}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{trip.totalShops}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-blue-700">{trip.totalBirds.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-amber-600">{trip.totalWeight.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-rose-600">{trip.totalMortality}</td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm bg-rose-100 text-rose-700 border border-rose-200/80"><AlertCircle size={12} /> {t("status.deleted")}</span>
                        ) : (() => {
                          // Part B: a Draft (in-progress) trip shows its first
                          // unsubmitted step as a clickable resume badge — never a
                          // status dropdown. Part N: only Pending offers a manual
                          // forward transition (→ Completed); deletion always goes
                          // through the Delete button + 10s undo (Part O), so it is
                          // never offered here. Completed stays Completed.
                          const validOptions = getValidStatusOptions(trip.status).filter(
                            (s) => s !== "Deleted"
                          );
                          const showDropdown =
                            !isDeleted &&
                            onStatusChange &&
                            trip.status === "Pending" &&
                            validOptions.length > 0;
                          if (showDropdown) {
                            return (
                              <div className="relative inline-block w-32">
                                <select
                                  value={trip.status}
                                  onChange={(e) => handleStatusChange(trip, e.target.value as TripStatus)}
                                  className={`w-full appearance-none rounded-xl px-3 py-1.5 text-xs font-bold border transition-all shadow-sm cursor-pointer pr-8 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                    trip.status === "Completed"
                                      ? "text-emerald-700 border-emerald-300 bg-emerald-50/80 focus:ring-emerald-500"
                                      : trip.status === "Pending"
                                      ? "text-amber-700 border-amber-300 bg-amber-50/80 focus:ring-amber-500"
                                      : "text-blue-700 border-blue-300 bg-blue-50/80 focus:ring-blue-500"
                                  }`}
                                >
                                  {[trip.status, ...validOptions].map((status) => (
                                    <option key={status} value={status} className={`font-semibold bg-white ${status === "Completed" ? "text-emerald-700" : status === "Pending" ? "text-amber-700" : status === "Draft" ? "text-blue-700" : "text-rose-700"}`}>
                                      {status === "Completed" && "✅ "}
                                      {status === "Pending" && "⏳ "}
                                      {status === "Draft" && "📝 "}
                                      {status === "Deleted" && "🗑️ "}
                                      {tSafe(`status.${status.toLowerCase()}`) || status}
                                    </option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            );
                          }
                          return (() => {
                            const badge = getStepBadge(trip);
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (badge.resume && onResume) onResume(trip);
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm border ${badge.resume ? "cursor-pointer hover:shadow-md hover:scale-105 active:scale-95" : "cursor-default"} transition-all duration-200 ${badge.color}`}
                              >
                                {badge.icon}
                                {badge.label}
                              </button>
                            );
                          })();
                        })()}
                      </td>
                      <td className="text-center px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); onView(trip); }} className="h-8 w-8 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center mx-auto transition-all shadow-sm active:scale-95 group-hover:border-blue-200" title={t("ops.trip.view_trip_details")}><Eye size={14} /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {shouldShowPagination(filteredTrips.length) && (
          <TripPagination
            currentPage={currentPage}
            totalPages={Math.max(totalPages, 1)}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <PendingDeleteNotification
        items={pendingItems}
        onCancel={(id) => {
          pendingDeletesRef.current.delete(id);
          cancel(id);
        }}
      />

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600"><Trash2 size={20} /></div>
              <div className="flex-1"><h3 className="text-lg font-bold text-slate-800">{t("ops.trip.delete_trip")}</h3><p className="text-sm text-slate-500 mt-1">{t("ops.trip.delete_trip_about", { no: tripToDelete?.tripNo ?? "" })}</p></div>
              <button onClick={cancelDelete} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="mt-4">
              <label htmlFor="deleteReason" className="block text-sm font-medium text-slate-700">{t("ops.trip.reason")} <span className="text-rose-500">*</span></label>
              <textarea id="deleteReason" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder={t("ops.trip.delete_reason_placeholder")} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm text-slate-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">{t("common.cancel")}</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-medium text-white transition-all shadow-sm active:scale-95">{t("ops.trip.confirm_delete")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(TripRecentTable);