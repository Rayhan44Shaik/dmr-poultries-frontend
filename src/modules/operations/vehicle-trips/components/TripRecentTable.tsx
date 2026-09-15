// src/modules/operations/vehicle-trips/components/TripRecentTable.tsx

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Pencil, History, Trash2, Clock, AlertCircle, Search, FileText, CheckCircle, X } from "lucide-react";
import type { Trip } from "../types/trip";
import { canEditItem, canDeleteItem } from "../../../../utils/dateUtils";
import { formatTripListDay } from "../utils/formatTripListDay";
import { localizeTripViewText } from "../utils/tripViewLocalization";
import { formatVehicleNumber } from "../../../../utils/format";
import TripPagination from "./TripPagination";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { getNextIncompleteTripStep, isTripWizardComplete, isValidTripStatusTransition, getValidNextStatuses, type TripStatus } from "../../../../shared/trip";
import { useI18n } from "../../../../i18n";
import { notify as globalNotify } from "../../../../ui/notifications/notificationStore";
import { uniqueTripsById } from "../services/tripHeaderApiService";
import { BrandRefreshButton } from "../../../../ui";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { isOrderContainer } from "../../orders/ordersUtils";

interface Props {
  trips?: Trip[];
  /** True while the server-backed Recent Trip Activity data is refreshing. */
  isLoading?: boolean;
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
  isLoading = false,
  onRefresh,
  onView,
  onEdit,
  onResume,
  onDelete,
  onStatusChange,
}: Props) {
  const { t, language } = useI18n();
  // Recent Trips lists REAL vehicle trips (TRP-*) only. The trips feed also
  // carries Orders collection containers (ORD-*): rows with no vehicle that
  // exist purely to hold a day's order plan. They are not trips, so they must
  // never appear here. Filtered by isOrderContainer rather than by matching the
  // "ORD-" prefix, so the rule stays tied to the actual data shape.
  const safeTrips = useMemo(
    () => uniqueTripsById((Array.isArray(trips) ? trips : []).filter((trip) => !isOrderContainer(trip))),
    [trips]
  );

  /** Translate, but never surface a raw i18n key: returns "" when the key is missing. */
  const tSafe = (key: string, params?: Record<string, string | number>) => {
    const value = t(key, params);
    return value === key ? "" : value;
  };

  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const initialStatus: "Draft" | "Pending" | "Deleted" = requestedStatus === "Pending" || requestedStatus === "Deleted" ? requestedStatus : "Draft";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"Draft" | "Pending" | "Deleted">(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const pendingDeletesRef = useRef<Map<number, { trip: Trip; reason: string }>>(new Map());
  const onDeleteRef = useRef(onDelete);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

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
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());

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


  /** Effective list status: Step 5 fully submitted must never stay under Draft. */
  const listStatus = useCallback((t: Trip): "Draft" | "Pending" | "Completed" | "Deleted" => {
    if (t.deleted === true || t.status === "Deleted") return "Deleted";
    if (t.status === "Completed") return "Completed";
    // Wizard done (end/expenses submitted) OR explicit Pending → Pending tab
    if (t.status === "Pending" || isTripWizardComplete(t)) return "Pending";
    return "Draft";
  }, []);

  const getStepBadge = (trip: Trip) => {
    // Completed may still exist on older sample rows — show label only (no status change option).
    if (trip.status === "Completed") {
      return { label: t("status.completed"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle size={12} />, resume: false };
    }
    if (trip.status === "Pending") {
      return { label: t("status.pending"), color: "bg-orange-50 text-orange-700 border-orange-200", icon: <Clock size={12} />, resume: false };
    }
    // Defensive: wizard fully submitted but status still Draft → treat as Pending
    // (Step 5 submit should have moved it; never show Completed from Draft).
    if (isTripWizardComplete(trip)) {
      return { label: t("status.pending"), color: "bg-orange-50 text-orange-700 border-orange-200", icon: <Clock size={12} />, resume: false };
    }
    // A Draft trip always has Step 1 submitted (trips are created on Step 1
    // submit), so it is always mid-workflow: show ONLY which step is pending
    // next — no step name / farm detail.
    const nextStep = getNextIncompleteTripStep(trip);
    return {
      label: t("ops.trip.step_label", { step: nextStep + 1 }),
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <FileText size={12} />,
      resume: true,
    };
  };

  const sortedTrips = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    const squashed = lower.replace(/\s+/g, "");

    const filtered = !lower
      ? safeTrips
      : safeTrips.filter((trip) => {
          const effectiveStatus = listStatus(trip);
          const statusKey = `status.${effectiveStatus.toLowerCase()}`;
          const translatedStatus = t(statusKey);
          const statusLabel = translatedStatus === statusKey ? effectiveStatus : translatedStatus;
          const nextStep = effectiveStatus === "Draft" ? getNextIncompleteTripStep(trip) + 1 : null;
          const stepLabel = nextStep ? t("ops.trip.step_label", { step: nextStep }) : "";
          const searchValues = [
            trip.tripNo,
            trip.tripDate,
            trip.vehicleNo,
            trip.driverName,
            trip.supervisorName,
            trip.sourceFarm,
            trip.status,
            effectiveStatus,
            statusLabel,
            stepLabel,
            nextStep ? `Step ${nextStep}` : "",
            nextStep ? `Step${nextStep}` : "",
          ];

          return searchValues.some((value) => {
            const text = String(value ?? "").toLowerCase();
            return text.includes(lower) || text.replace(/\s+/g, "").includes(squashed);
          });
        });

    return [...filtered].sort((a, b) => {
      if (a.tripDate !== b.tripDate) return a.tripDate < b.tripDate ? 1 : -1;
      return b.id - a.id;
    });
  }, [safeTrips, searchTerm, t, listStatus]);

  const statusBuckets = useMemo(() => ({
    draft: sortedTrips.filter((trip) => listStatus(trip) === "Draft"),
    pending: sortedTrips.filter((trip) => listStatus(trip) === "Pending"),
    deleted: sortedTrips.filter((trip) => listStatus(trip) === "Deleted"),
  }), [sortedTrips, listStatus]);

  /** Count beside “Recent Trip Activity” follows the selected tab (Draft/Pending/Deleted). */
  const selectedTabCount =
    statusFilter === "Draft" ? statusBuckets.draft.length : statusFilter === "Pending" ? statusBuckets.pending.length : statusBuckets.deleted.length;

  const filteredTrips = statusFilter === "Draft" ? statusBuckets.draft : statusFilter === "Pending" ? statusBuckets.pending : statusBuckets.deleted;

  const totalPages = Math.ceil(filteredTrips.length / pageSize);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedTrips = filteredTrips.slice(startIndex, startIndex + pageSize);

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

  const selectRowFromKeyboard = useCallback((trip: Trip) => {
    if (trip.deleted || isPending(Number(trip.id))) return;
    setSelectedTripId(trip.id);
  }, [isPending]);

  const handleRowKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
    // Do not hijack arrow/Enter keys from a row's select or View button.
    if (event.target !== event.currentTarget) return;
    const currentTrip = paginatedTrips[rowIndex];
    if (!currentTrip) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectRowFromKeyboard(currentTrip);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    let nextIndex = rowIndex + step;
    while (nextIndex >= 0 && nextIndex < paginatedTrips.length && paginatedTrips[nextIndex]?.deleted) {
      nextIndex += step;
    }
    const nextTrip = paginatedTrips[nextIndex];
    if (!nextTrip) return;
    selectRowFromKeyboard(nextTrip);
    requestAnimationFrame(() => rowRefs.current.get(nextTrip.id)?.focus());
  }, [paginatedTrips, selectRowFromKeyboard]);

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

  // Status control:
  //   Draft → Pending  : automatic on Step 5 submit
  //   Pending → Completed : manual approve on Pending tab (then leaves Pending list)
  //   Pending → Draft never exists. Deletion = Delete action + 10s undo only.
  const handleStatusChange = (trip: Trip, newStatus: TripStatus) => {
    const from = listStatus(trip) === "Pending" && trip.status !== "Completed" ? "Pending" : trip.status;
    if (!isValidTripStatusTransition(from, newStatus) && !(from === "Pending" && newStatus === "Completed")) {
      return;
    }
    if (newStatus === "Completed") {
      if (onStatusChange) onStatusChange(trip, "Completed", getCurrentUser());
      return;
    }
    if (newStatus === "Pending") {
      if (onStatusChange) onStatusChange(trip, newStatus);
    }
  };

  // Pending tab offers Pending → Completed only.
  const getValidStatusOptions = (currentStatus: TripStatus): TripStatus[] => {
    if (currentStatus === "Pending") return ["Completed"];
    return getValidNextStatuses(currentStatus).filter((s) => s !== "Deleted");
  };

  return (
    <>
      <div ref={tableRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden mt-8 transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.trip.recent_trip_activity")}</h3>
            </div>

            {/* Selected-tab count beside the title (updates when Draft/Pending/Deleted is clicked) */}
            <span
              className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums"
            >
              {selectedTabCount}
            </span>

            {/* Status toggle — labels only (no per-tab counts); height unchanged, still wide */}
            <div className="flex items-center p-0.5 ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 shadow-sm">
              {(["Draft", "Pending", "Deleted"] as const).map((tab) => {
                const isActive = statusFilter === tab;
                const activeClass =
                  tab === "Draft"
                    ? "bg-emerald-50/80 text-emerald-500 shadow-sm"
                    : tab === "Pending"
                    ? "bg-orange-50/80 text-orange-500 shadow-sm"
                    : "bg-rose-50/80 text-rose-500 shadow-sm";
                const label = (() => {
                  const k = "status." + tab.toLowerCase();
                  const v = t(k);
                  return v === k ? tab : v;
                })();
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setStatusFilter(tab); setCurrentPage(1); }}
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
              <input type="text" placeholder={t("ops.trip.search_trips_short")} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all" />
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-1">
              <button type="button" onClick={handleEditClick} disabled={!canEdit} className={`group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${canEdit ? "bg-emerald-50/70 hover:bg-emerald-50/80 text-emerald-500 border border-emerald-200/60 active:scale-95" : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"}`} aria-label={t("ops.trip.edit_selected_trip")}>
                <span className={`inline-flex ${canEdit ? uiActionIconMotionClass.edit : ""}`}><Pencil size={13} /></span>
                <span className="hidden md:inline">{t("common.edit")}</span>
              </button>
              <button type="button" onClick={openDeleteModal} disabled={!canDelete} className={`group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${canDelete ? "bg-rose-50/70 hover:bg-rose-50/80 text-rose-500 border border-rose-200/60 active:scale-95" : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"}`} aria-label={t("ops.trip.delete_selected_trip")}>
                <span className={`inline-flex ${canDelete ? uiActionIconMotionClass.delete : ""}`}><Trash2 size={13} /></span>
                <span className="hidden md:inline">{t("common.delete")}</span>
              </button>
              <BrandRefreshButton onClick={() => onRefresh()} />
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
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("ops.trip.mortality_short")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("common.status")}</th>
                <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("common.view")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-sm font-medium text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />
                      {t("ops.trip.loading_recent")}
                    </span>
                  </td>
                </tr>
              ) : paginatedTrips.length === 0 ? (
                <tr><td colSpan={12} className="py-16 text-center text-slate-400"><History size={24} className="mx-auto mb-2" /> {t("empty.no_trips")}</td></tr>
              ) : (
                paginatedTrips.map((trip, index) => {
                  const isSelected = trip.id === selectedTripId;
                  const isDeleted = trip.deleted === true;
                  return (
                    <tr
                      key={trip.id}
                      ref={(element) => {
                        if (element) rowRefs.current.set(trip.id, element);
                        else rowRefs.current.delete(trip.id);
                      }}
                      tabIndex={isDeleted ? -1 : 0}
                      onClick={() => handleRowClick(trip)}
                      onKeyDown={(event) => handleRowKeyDown(event, index)}
                      aria-selected={isSelected}
                      className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${isDeleted ? "bg-red-50/50 hover:bg-red-50/80 border-l-4 border-l-red-400" : isSelected ? "bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50/80"}`}
                    >
                      <td className={`px-4 py-3 font-bold text-emerald-500 text-xs whitespace-nowrap ${isDeleted ? "opacity-60 line-through" : ""}`}>
                        {localizeTripViewText(trip.tripNo, language)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(trip.tripDate, language)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{localizeTripViewText(formatVehicleNumber(trip.vehicleNo), language)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{localizeTripViewText(trip.driverName, language)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{localizeTripViewText(trip.supervisorName, language)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">{localizeTripViewText(trip.sourceFarm, language)}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{trip.totalShops}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-blue-500">{trip.totalBirds.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-amber-500">{trip.totalWeight.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-rose-500">{trip.totalMortality}</td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm bg-red-50 text-red-700 border border-red-200"><AlertCircle size={12} /> {t("status.deleted")}</span>
                        ) : (() => {
                          // Draft: resume badge. Pending: dropdown to move → Completed
                          // (then leaves Pending tab). Deletion = Delete + 10s undo.
                          const effectiveStatus =
                            trip.status === "Pending" || isTripWizardComplete(trip)
                              ? "Pending"
                              : trip.status;
                          const validOptions = getValidStatusOptions(
                            effectiveStatus === "Pending" ? "Pending" : trip.status
                          ).filter((s) => s !== "Deleted");
                          const showDropdown =
                            !isDeleted &&
                            onStatusChange &&
                            effectiveStatus === "Pending" &&
                            validOptions.includes("Completed");
                          if (showDropdown) {
                            return (
                              <div className="group relative inline-block w-[8.5rem]">
                                <select
                                  value="Pending"
                                  onChange={(e) => handleStatusChange(trip, e.target.value as TripStatus)}
                                  className="w-full appearance-none rounded-xl px-3 py-1.5 text-xs font-bold border transition-all shadow-sm cursor-pointer pr-8 focus:outline-none focus:ring-2 focus:ring-offset-1 text-orange-700 border-orange-200 bg-orange-50 focus:ring-orange-500"
                                >
                                  <option value="Pending" className="font-semibold bg-white text-orange-700">
                                    ⏳ {tSafe("status.pending") || "Pending"}
                                  </option>
                                  <option value="Completed" className="font-semibold bg-white text-emerald-700">
                                    ✅ {tSafe("status.completed") || "Completed"}
                                  </option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 px-2 text-slate-500">
                                  <span className={`inline-flex text-emerald-600 ${uiActionIconMotionClass.approve}`} aria-hidden="true"><CheckCircle size={13} /></span>
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
                        <button type="button" onClick={(e) => { e.stopPropagation(); onView(trip); }} className="group relative h-8 w-8 rounded-xl bg-violet-50 hover:bg-violet-500 text-violet-600 hover:text-white flex items-center justify-center mx-auto transition-all shadow-sm active:scale-95" aria-label={t("ops.trip.view_trip_details")}><span className={`inline-flex ${uiActionIconMotionClass.view}`}><Eye size={14} /></span></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Show the footer whenever the tab has rows — not only past the
            10-row threshold. The bar also hosts rows-per-page, which must stay
            reachable on small tabs (Pending/Deleted hold well under 10 rows,
            and shouldShowPagination() was hiding the control there entirely). */}
        {filteredTrips.length > 0 && (
          <TripPagination
            currentPage={safeCurrentPage}
            totalPages={Math.max(totalPages, 1)}
            totalItems={filteredTrips.length}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1); // a new page size invalidates the current page
            }}
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
              <div className="h-10 w-10 rounded-xl bg-rose-50/70 border border-rose-100 flex items-center justify-center text-rose-500"><Trash2 size={20} /></div>
              <div className="flex-1"><h3 className="text-lg font-bold text-slate-800">{t("ops.trip.delete_trip")}</h3><p className="text-sm text-slate-500 mt-1">{t("ops.trip.delete_trip_about", { no: tripToDelete?.tripNo ?? "" })}</p></div>
              <button type="button" onClick={cancelDelete} className="group relative h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500" aria-label={t("common.close")}><X size={18} className={uiActionIconMotionClass.close} /></button>
            </div>
            <div className="mt-4">
              <label htmlFor="deleteReason" className="block text-sm font-medium text-slate-700">{t("ops.trip.reason")} <span className="text-rose-500">*</span></label>
              <textarea id="deleteReason" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder={t("ops.trip.delete_reason_placeholder")} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm text-slate-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20 outline-none" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={cancelDelete} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">{t("common.cancel")}</button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-sm font-medium text-white transition-all shadow-sm active:scale-95">{t("ops.trip.confirm_delete")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(TripRecentTable);
