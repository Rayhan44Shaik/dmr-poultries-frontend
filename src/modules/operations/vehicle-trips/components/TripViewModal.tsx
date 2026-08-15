// src/modules/operations/vehicle-trips/components/TripViewModal.tsx

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  X,
  FileText,
  Download,
  Pencil,
  UserCheck,
  Clock,
  Truck,
  User,
  Users,
  Gauge,
  Wallet,
  MapPin,
  Building2,
  Scale,
  Bird,
  Box,
  Package,
  Search,
  AlertCircle,
  LayoutGrid,
  BarChart3,
  HardHat,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip, ShopDelivery, BoxDetail } from "../types/trip";

// --- Steps / shared UI reused inside the View Modal ---
import TripWizardStepper from "./TripWizardStepper";
import StepEnd from "./Step_5/StepEnd";
import TripFinalKPI from "./TripFinalKPI";
import TripPagination from "./TripPagination";
import ShopDeliveryCard from "./Step_4/ShopDeliveryCard";
import BoxWeightAnalysis from "./Step_4/BoxWeightAnalysis";
import type { ShopDeliveryWithExtra } from "./Step_4/useShopDeliveryForm";
import { generateShopPDF } from "../utils/generateShopPDF";
import { loadTripById } from "../services/tripHeaderApiService";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  shops: any[];
  birdTypes: any[];
  onEdit?: (trip: Trip) => void;
}

const SHOPS_PER_PAGE = 6;

/* ────────────────────────────────────────────────────────────────
   Small presentational helpers
   ──────────────────────────────────────────────────────────────── */

function InfoCard({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs ${className}`}
    >
      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
        {icon} {label}
      </span>
      <span className="text-xs font-bold text-slate-800 break-words">{value}</span>
    </div>
  );
}

function PeopleCard({
  icon,
  label,
  people,
  chipClass,
}: {
  icon: React.ReactNode;
  label: string;
  people: string[];
  chipClass: string;
}) {
  return (
    <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
          {icon} {label}
        </span>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
          {people.length}
        </span>
      </div>
      {people.length === 0 ? (
        <span className="text-xs font-semibold text-slate-400">--</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {people.map((name, idx) => (
            <span
              key={`${name}-${idx}`}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${chipClass}`}
              title={name}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepShell({
  step,
  title,
  actions,
  children,
}: {
  step: number;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
            {step}
          </span>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
            View Only
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyStepNotice({ message }: { message: string }) {
  return (
    <div className="mt-2 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
      {message}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Utils
   ──────────────────────────────────────────────────────────────── */

/** Backend stores capture time as ISO — show something readable. */
function formatCaptureTime(value?: string | null): string {
  if (!value) return "";
  const raw = String(value);
  if (!/\d{4}-\d{2}-\d{2}T/.test(raw)) return raw; // already a display string
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Normalise a delivery row coming from the API into the shape the cards expect. */
function toDeliveryRow(row: ShopDelivery): ShopDeliveryWithExtra {
  const extra = row as ShopDeliveryWithExtra;
  const selectedBoxIds = Array.isArray(extra.selectedBoxIds)
    ? [...extra.selectedBoxIds].sort((a, b) => a - b)
    : [];
  const perBoxData = Array.isArray(extra.perBoxData) ? extra.perBoxData : [];

  return {
    ...extra,
    boxNo: extra.boxNo || selectedBoxIds.length || perBoxData.length || 0,
    birds: extra.birds || 0,
    weight: extra.weight || 0,
    mortality: extra.mortality || 0,
    deliveryMode: extra.deliveryMode || (selectedBoxIds.length > 0 ? "box" : "weight"),
    selectedBoxIds,
    perBoxData,
    autoCaptureTime: formatCaptureTime(extra.autoCaptureTime),
  };
}

/** Group any list into rows of `size` (used by the box-wise pickup table). */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ────────────────────────────────────────────────────────────────
   STEP 1 — Trip Start (helpers + loaders included)
   ──────────────────────────────────────────────────────────────── */

function ViewStepStart({ trip }: { trip: Trip }) {
  const helpers = (trip.helpers || []).filter(Boolean);
  const loaders = (trip.loaders || []).filter(Boolean);

  return (
    <StepShell step={1} title="TRIP START (AT OFFICE)">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoCard
          icon={<Clock size={12} className="text-slate-500" />}
          label="Start Time"
          value={trip.startTime || "--"}
        />
        <InfoCard
          icon={<Truck size={12} className="text-blue-500" />}
          label="Vehicle No."
          value={trip.vehicleNo || "--"}
        />
        <InfoCard
          icon={<FileText size={12} className="text-slate-500" />}
          label="Trip No."
          value={trip.tripNo || "--"}
        />
        <InfoCard
          icon={<User size={12} className="text-indigo-500" />}
          label="Supervisor"
          value={trip.supervisorName || "--"}
        />
        <InfoCard
          icon={<User size={12} className="text-emerald-500" />}
          label="Driver"
          value={trip.driverName || "--"}
        />
        <InfoCard
          icon={<Gauge size={12} className="text-purple-500" />}
          label="Opening Meter"
          value={trip.openingMeter ? `${trip.openingMeter} KM` : "--"}
        />
        <InfoCard
          icon={<Wallet size={12} className="text-amber-500" />}
          label="Advance / Expenses"
          value={`₹${(trip.advanceAmount ?? 0).toLocaleString()}`}
        />
        <InfoCard
          icon={<Clock size={12} className="text-slate-500" />}
          label="Trip Date"
          value={trip.tripDate || "--"}
        />
        <InfoCard
          icon={<FileText size={12} className="text-slate-500" />}
          label="Status"
          value={trip.status || "--"}
        />
      </div>

      {/* ── CREW: Helpers & Loaders ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PeopleCard
          icon={<Users size={12} className="text-slate-500" />}
          label="Helpers"
          people={helpers}
          chipClass="bg-slate-50 text-slate-700 border-slate-200"
        />
        <PeopleCard
          icon={<HardHat size={12} className="text-amber-500" />}
          label="Loaders"
          people={loaders}
          chipClass="bg-amber-50 text-amber-800 border-amber-200"
        />
      </div>

      {trip.remarks ? (
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Remarks</span>
          <p className="text-xs text-slate-700 font-medium mt-1">{trip.remarks}</p>
        </div>
      ) : null}
    </StepShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   STEP 2 — Farm
   ──────────────────────────────────────────────────────────────── */

function ViewStepFarm({ trip }: { trip: Trip }) {
  return (
    <StepShell step={2} title="REACHED FARM">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoCard
          icon={<Clock size={12} className="text-slate-500" />}
          label="Reached Time"
          value={trip.reachedTime || "--"}
        />
        <InfoCard
          icon={<Building2 size={12} className="text-emerald-500" />}
          label="Source Farm"
          value={trip.sourceFarm || "--"}
        />
        <InfoCard
          icon={<MapPin size={12} className="text-rose-500" />}
          label="Farm Address"
          value={trip.farmAddress || "--"}
        />
        <InfoCard
          icon={<Gauge size={12} className="text-purple-500" />}
          label="Destination Meter"
          value={trip.destMeter ? `${trip.destMeter} KM` : "--"}
        />
        <InfoCard
          icon={<Wallet size={12} className="text-amber-500" />}
          label="Pickup Tolls"
          value={`₹${(trip.pickupTolls ?? 0).toLocaleString()}`}
        />
        <InfoCard
          icon={<Scale size={12} className="text-blue-500" />}
          label="Avg Bird Weight"
          value={trip.avgBirdWeight ? `${trip.avgBirdWeight} Kg` : "--"}
        />
      </div>
    </StepShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   STEP 3 — Pickup (BOX-WISE)
   ──────────────────────────────────────────────────────────────── */

function ViewStepPickup({ trip }: { trip: Trip }) {
  const [boxSearch, setBoxSearch] = useState("");

  const boxDetails: BoxDetail[] = useMemo(
    () => (Array.isArray(trip.boxDetails) ? [...trip.boxDetails].sort((a, b) => a.boxNo - b.boxNo) : []),
    [trip.boxDetails]
  );

  const filteredBoxes = useMemo(() => {
    const query = boxSearch.trim().toLowerCase();
    if (!query) return boxDetails;
    return boxDetails.filter((b) => String(b.boxNo).toLowerCase().includes(query));
  }, [boxDetails, boxSearch]);

  const totals = useMemo(
    () =>
      boxDetails.reduce(
        (acc, b) => ({
          boxes: acc.boxes + 1,
          birds: acc.birds + (b.birds || 0),
          weight: acc.weight + (b.weight || 0),
        }),
        { boxes: 0, birds: 0, weight: 0 }
      ),
    [boxDetails]
  );

  const grouped = useMemo(() => chunk(filteredBoxes, 3), [filteredBoxes]);

  return (
    <StepShell step={3} title="PICKUP KPI (BOX-WISE)">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <InfoCard
          icon={<Clock size={12} className="text-slate-500" />}
          label="Load Time"
          value={trip.pickupLoadTime || "--"}
        />
        <InfoCard
          icon={<Scale size={12} className="text-emerald-500" />}
          label="DC Wt"
          value={`${(trip.dcWeight || 0).toFixed(2)} Kg`}
        />
        <InfoCard
          icon={<Bird size={12} className="text-blue-500" />}
          label="Birds"
          value={trip.totalBirds || 0}
        />
        <InfoCard
          icon={<Box size={12} className="text-amber-500" />}
          label="Boxes"
          value={trip.boxes || totals.boxes}
        />
        <InfoCard
          icon={<Gauge size={12} className="text-purple-500" />}
          label="Avg Wt"
          value={`${trip.avgWeight || 0} Kg`}
        />
      </div>

      {/* Box-wise table */}
      {boxDetails.length === 0 ? (
        <EmptyStepNotice message="No box-wise pickup details were recorded for this trip." />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Package size={14} className="text-emerald-600" />
              Box-wise Loading Sheet
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                {filteredBoxes.length}/{boxDetails.length}
              </span>
            </div>
            <div className="relative w-full sm:w-56">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={14} />
              </div>
              <input
                type="text"
                value={boxSearch}
                onChange={(e) => setBoxSearch(e.target.value)}
                placeholder="Search box no..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
              />
              {boxSearch && (
                <button
                  onClick={() => setBoxSearch("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[13.33%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[10px] uppercase sticky top-0 z-10 border-b border-slate-200">
                  {[1, 2, 3].map((i, idx) => (
                    <React.Fragment key={i}>
                      <th
                        className={`text-center px-3 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200 ${
                          idx > 0 ? "pl-5" : ""
                        }`}
                      >
                        BOX
                      </th>
                      <th className="text-center px-3 py-2 font-bold bg-slate-50 text-slate-600 border-r border-slate-200">
                        BIRDS
                      </th>
                      <th
                        className={`text-center px-3 py-2 font-bold bg-slate-50 text-slate-600 ${
                          idx < 2 ? "border-r-2 border-slate-300 pr-5" : ""
                        }`}
                      >
                        WT(KG)
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {grouped.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center px-3 py-8 text-slate-400">
                      No box matched “{boxSearch}”.
                    </td>
                  </tr>
                ) : (
                  grouped.map((group, idx) => (
                    <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                      {group.map((r, colIdx) => (
                        <React.Fragment key={r.boxNo}>
                          <td
                            className={`text-center px-3 py-2 font-semibold text-slate-800 border-r border-slate-200 ${
                              colIdx > 0 ? "pl-5" : ""
                            }`}
                          >
                            {r.boxNo}
                          </td>
                          <td className="text-center px-3 py-2 font-bold text-slate-800 border-r border-slate-200">
                            {r.birds}
                          </td>
                          <td
                            className={`text-center px-3 py-2 font-semibold text-slate-800 ${
                              colIdx < 2 ? "border-r-2 border-slate-300 pr-5" : ""
                            }`}
                          >
                            {(r.weight || 0).toFixed(2)}
                          </td>
                        </React.Fragment>
                      ))}
                      {group.length < 3 &&
                        Array.from({ length: 3 - group.length }).map((_, i) => {
                          const emptyIdx = group.length + i;
                          return (
                            <React.Fragment key={`empty-${i}`}>
                              <td
                                className={`text-center px-3 py-2 text-slate-300 border-r border-slate-200 ${
                                  emptyIdx > 0 ? "pl-5" : ""
                                }`}
                              >
                                —
                              </td>
                              <td className="text-center px-3 py-2 text-slate-300 border-r border-slate-200">—</td>
                              <td
                                className={`text-center px-3 py-2 text-slate-300 ${
                                  emptyIdx < 2 ? "border-r-2 border-slate-300 pr-5" : ""
                                }`}
                              >
                                —
                              </td>
                            </React.Fragment>
                          );
                        })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Box totals */}
          <div className="grid grid-cols-3 gap-3">
            <InfoCard
              icon={<Box size={12} className="text-amber-500" />}
              label="Total Boxes"
              value={totals.boxes}
            />
            <InfoCard
              icon={<Bird size={12} className="text-blue-500" />}
              label="Total Birds (Boxes)"
              value={totals.birds}
            />
            <InfoCard
              icon={<Scale size={12} className="text-emerald-500" />}
              label="Total Weight (Boxes)"
              value={`${totals.weight.toFixed(2)} Kg`}
            />
          </div>
        </>
      )}
    </StepShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   STEP 4 — Deliveries (SHOP-WISE + SEARCH + BOXES PER SHOP)
   ──────────────────────────────────────────────────────────────── */

function ViewStepDeliveries({ trip }: { trip: Trip }) {
  const [viewMode, setViewMode] = useState<"shops" | "analysis">("shops");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const boxDetails: BoxDetail[] = useMemo(
    () => (Array.isArray(trip.boxDetails) ? trip.boxDetails : []),
    [trip.boxDetails]
  );

  const rows = useMemo<ShopDeliveryWithExtra[]>(
    () => (Array.isArray(trip.deliveries) ? trip.deliveries.map(toDeliveryRow) : []),
    [trip.deliveries]
  );

  // KPI totals — identical logic to the delivery (Step 4) page.
  const kpi = useMemo(() => {
    const shops = rows.length;
    const birds = rows.reduce((acc, r) => acc + (r.birds || 0), 0);
    const weight = rows.reduce((acc, r) => acc + (r.weight || 0), 0);
    const mortality = rows.reduce((acc, r) => acc + (r.mortality || 0), 0);
    const mortKg = rows.reduce((acc, r) => acc + (r.mortKg || 0), 0);
    const lastCaptureTime = rows.reduce((latest, r) => r.autoCaptureTime || latest, "");
    return { shops, birds, weight, mortality, mortKg, lastCaptureTime };
  }, [rows]);

  // Boxes actually delivered vs pending (based on the box ids attached to shops).
  const boxSummary = useMemo(() => {
    const delivered = new Set<number>();
    rows.forEach((r) => (r.selectedBoxIds || []).forEach((id) => delivered.add(id)));
    const pending = boxDetails.filter((b) => !delivered.has(b.boxNo));
    return { deliveredCount: delivered.size, pending };
  }, [rows, boxDetails]);

  const displayRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (!query) return true;
      const shopNameMatch = (r.shopName || "").toLowerCase().includes(query);
      const birdTypeMatch = (r.birdType || "").toLowerCase().includes(query);
      const remarksMatch = (r.remarks || "").toLowerCase().includes(query);
      const boxMatch = (r.selectedBoxIds || []).some((id) => String(id) === query);
      return shopNameMatch || birdTypeMatch || remarksMatch || boxMatch;
    });
    return [...filtered].sort((a, b) => b.id - a.id);
  }, [rows, searchTerm]);

  const totalPages = Math.max(Math.ceil(displayRows.length / SHOPS_PER_PAGE), 1);

  const currentRows = useMemo(() => {
    const startIndex = (currentPage - 1) * SHOPS_PER_PAGE;
    return displayRows.slice(startIndex, startIndex + SHOPS_PER_PAGE);
  }, [displayRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const handleDownloadShopPDF = useCallback(
    async (row: ShopDeliveryWithExtra) => {
      try {
        await generateShopPDF(
          row,
          boxDetails,
          trip.tripNo,
          trip.vehicleNo,
          trip.supervisorName,
          "",
          trip.tripDate,
          undefined,
          undefined,
          row.autoCaptureTime
        );
      } catch (error) {
        console.error("Shop PDF download failed:", error);
      }
    },
    [boxDetails, trip.tripNo, trip.vehicleNo, trip.supervisorName, trip.tripDate]
  );

  return (
    <StepShell
      step={4}
      title="SHOP DELIVERIES"
      actions={
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60">
          <button
            type="button"
            onClick={() => setViewMode("shops")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "shops"
                ? "bg-white text-blue-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid size={13} /> Shop View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("analysis")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "analysis"
                ? "bg-white text-blue-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 size={13} /> Box Analysis
          </button>
        </div>
      }
    >
      {viewMode === "analysis" ? (
        <BoxWeightAnalysis
          boxDetails={boxDetails}
          deliveries={rows}
          dcWeight={trip.dcWeight || 0}
          totalFarmBirds={trip.totalBirds || 0}
          tripNo={trip.tripNo}
          vehicleNo={trip.vehicleNo}
          supervisorName={trip.supervisorName}
          tripDate={trip.tripDate}
        />
      ) : (
        <>
          {/* ── SEARCH + BOX COUNTERS ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={14} />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search shop name, bird type, box no..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold rounded-full shadow-xs">
                <Package size={14} className="text-emerald-600" />
                Boxes Delivered ({boxSummary.deliveredCount}
                {boxDetails.length ? `/${boxDetails.length}` : ""})
              </span>
              {boxSummary.pending.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold rounded-full shadow-xs">
                  <AlertCircle size={14} className="text-amber-600" />
                  Pending ({boxSummary.pending.length})
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-full shadow-xs">
                <Building2 size={14} className="text-slate-500" />
                Shops ({displayRows.length}
                {displayRows.length !== rows.length ? `/${rows.length}` : ""})
              </span>
            </div>
          </div>

          {/* ── KPI SUMMARY (same as delivery page) ───────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
                <Clock size={13} className="text-emerald-600" /> Captured Time
              </span>
              <span
                className="text-xs font-bold text-slate-800 mt-1 truncate"
                title={kpi.lastCaptureTime || "--"}
              >
                {kpi.lastCaptureTime || "--"}
              </span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Building2 size={13} className="text-slate-400" /> Shops
              </span>
              <span className="text-base font-bold text-slate-800">{kpi.shops}</span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Users size={13} className="text-emerald-600" /> Birds
              </span>
              <span className="text-base font-bold text-slate-800">{kpi.birds}</span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Scale size={13} className="text-emerald-600" /> Weight (kg)
              </span>
              <span className="text-base font-bold text-slate-800">{kpi.weight.toFixed(2)}</span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <AlertCircle size={13} className="text-rose-500" /> Mor
              </span>
              <span className="text-base font-bold text-slate-800">{kpi.mortality}</span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Scale size={13} className="text-rose-500" /> Mor (kg)
              </span>
              <span className="text-base font-bold text-slate-800">{kpi.mortKg.toFixed(2)}</span>
            </div>
          </div>

          {/* ── SHOP-WISE CARDS ───────────────────────────────────── */}
          <div className="p-3 sm:p-4 bg-slate-50/40 rounded-2xl border border-slate-200/80">
            {currentRows.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200 border-dashed">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  {searchTerm ? (
                    <>
                      <p className="font-medium text-slate-600">No matching shops found</p>
                      <p className="text-xs text-slate-400">
                        Try another keyword or{" "}
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setCurrentPage(1);
                          }}
                          className="font-semibold text-emerald-600 hover:underline"
                        >
                          clear search
                        </button>
                        .
                      </p>
                    </>
                  ) : (
                    <p className="font-medium text-slate-600">No shop deliveries recorded for this trip.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentRows.map((row) => (
                  <ShopDeliveryCard
                    key={row.id}
                    row={row}
                    readOnly={true}
                    onEdit={() => {}}
                    onPDF={handleDownloadShopPDF}
                    supervisorName={trip.supervisorName}
                    vehicleNo={trip.vehicleNo}
                    tripDate={trip.tripDate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── PAGINATION ────────────────────────────────────────── */}
          {displayRows.length > 0 && (
            <div className="border bg-white px-4 py-3 rounded-2xl border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium text-slate-500">
                  Page <span className="font-bold text-slate-700">{currentPage}</span> of{" "}
                  <span className="font-bold text-slate-700">{totalPages}</span>
                  <span className="ml-2 text-[10px] text-slate-400">({SHOPS_PER_PAGE} per page)</span>
                </div>
                <TripPagination
                  key={totalPages}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  hidePageInfo={true}
                />
              </div>
            </div>
          )}

          {/* ── PENDING BOX LIST (boxes not delivered to any shop) ── */}
          {boxSummary.pending.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Package size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-900">
                  Pending Boxes ({boxSummary.pending.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {boxSummary.pending.map((b) => (
                  <span
                    key={b.boxNo}
                    title={`${b.birds} birds • ${(b.weight || 0).toFixed(2)} kg`}
                    className="px-2 py-0.5 bg-white text-amber-800 font-bold rounded border border-amber-200 text-[10px] shadow-2xs"
                  >
                    #{b.boxNo}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </StepShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   MODAL BODY (hooks live here so the early-return stays safe)
   ──────────────────────────────────────────────────────────────── */

function TripViewModalContent({ trip: incomingTrip, onClose, onEdit }: Omit<Props, "open" | "trip"> & { trip: Trip }) {
  const [viewStepIndex, setViewStepIndex] = useState(0);
  const [hydratedTrip, setHydratedTrip] = useState<Trip | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  /**
   * The recent-trips list can come from the offline localStorage fallback,
   * which does NOT carry crew / box / delivery children. Re-fetch the full
   * trip so Step 1 (helpers & loaders), Step 3 (box-wise) and Step 4
   * (shop-wise) always have their nested data.
   */
  useEffect(() => {
    let cancelled = false;
    setHydratedTrip(null);

    if (!incomingTrip?.id) return;

    const needsHydration =
      !Array.isArray(incomingTrip.helpers) ||
      !Array.isArray(incomingTrip.boxDetails) ||
      !Array.isArray(incomingTrip.deliveries) ||
      (incomingTrip.pickupStepSubmitted && (incomingTrip.boxDetails || []).length === 0) ||
      (incomingTrip.deliveryStepSubmitted && (incomingTrip.deliveries || []).length === 0) ||
      (incomingTrip.startStepSubmitted && (incomingTrip.helpers || []).length === 0);

    if (!needsHydration) return;

    setLoadingDetails(true);
    void (async () => {
      try {
        const full = await loadTripById(incomingTrip.id);
        if (!cancelled && full && full.id === incomingTrip.id) setHydratedTrip(full);
      } catch (error) {
        console.warn("TripViewModal: unable to refresh trip details", error);
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [incomingTrip]);

  // Merge: keep whatever the caller gave us, prefer freshly loaded children.
  const trip = useMemo<Trip>(() => {
    if (!hydratedTrip) return incomingTrip;
    return {
      ...incomingTrip,
      ...hydratedTrip,
      helpers: hydratedTrip.helpers?.length ? hydratedTrip.helpers : incomingTrip.helpers || [],
      loaders: hydratedTrip.loaders?.length ? hydratedTrip.loaders : incomingTrip.loaders || [],
      boxDetails: hydratedTrip.boxDetails?.length ? hydratedTrip.boxDetails : incomingTrip.boxDetails || [],
      deliveries: hydratedTrip.deliveries?.length ? hydratedTrip.deliveries : incomingTrip.deliveries || [],
    };
  }, [incomingTrip, hydratedTrip]);

  const totalKm = (trip.closingMeter || 0) - (trip.openingMeter || 0);

  // ─── STEP STATE FLAGS ───
  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isFarmCompleted = Boolean(trip.farmStepSubmitted);
  const isPickupCompleted = Boolean(trip.pickupStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isEndCompleted = trip.endStepSubmitted === true || trip.status === "Completed";
  const isTripEnded = trip.status === "Completed";

  const currentStep = isTripEnded || isEndCompleted
    ? 4
    : isDeliveryCompleted
    ? 3
    : isPickupCompleted
    ? 2
    : isFarmCompleted
    ? 1
    : 0;

  const noop = useCallback(() => {}, []);
  const noopDispatch = useCallback(() => {}, []) as unknown as React.Dispatch<React.SetStateAction<Trip>>;

  // ─── PDF download (full trip) ──────────────────────────────────
  const downloadPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 16;
    let y = 20;

    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text("Trip Details", margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    doc.text(`Generated on: ${dateStr}`, margin, y);
    y += 6;

    const summaryData: string[][] = [
      ["Trip No", trip.tripNo || "--", "Vehicle", trip.vehicleNo || "--"],
      ["Trip Date", trip.tripDate || "--", "Driver", trip.driverName || "--"],
      ["Supervisor", trip.supervisorName || "--", "Source Farm", trip.sourceFarm || "--"],
      ["Helpers", (trip.helpers || []).join(", ") || "--", "Loaders", (trip.loaders || []).join(", ") || "--"],
      ["Opening KM", String(trip.openingMeter ?? 0), "Closing KM", String(trip.closingMeter ?? 0)],
      ["Total KM", String(totalKm), "Fuel (Ltrs)", String(trip.fuel ?? 0)],
      ["Expense", `₹ ${trip.expense ?? 0}`, "Status", trip.status],
      ["DC Weight", `${trip.dcWeight || 0} KG`, "Total Birds", `${trip.totalBirds || 0}`],
      ...(trip.approvedBy ? [["Approved By", trip.approvedBy, "", ""]] : []),
    ];

    autoTable(doc, {
      body: summaryData,
      startY: y,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold", textColor: [80, 80, 80] },
        1: { cellWidth: 45 },
        2: { cellWidth: 30, fontStyle: "bold", textColor: [80, 80, 80] },
        3: { cellWidth: 45 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Remarks:", margin, y);
    y += 5;
    doc.setTextColor(50, 50, 50);
    doc.text(trip.remarks || "--", margin, y);
    y += 8;

    // ── Box-wise pickup table ──
    const boxDetails = trip.boxDetails || [];
    if (boxDetails.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text("Pickup — Box-wise Details", margin, y);
      doc.setFont("helvetica", "normal");
      y += 4;

      autoTable(doc, {
        head: [["Box", "Birds", "Weight (KG)"]],
        body: boxDetails.map((b) => [String(b.boxNo), String(b.birds), (b.weight || 0).toFixed(2)]),
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: "bold", halign: "center" },
        styles: { fontSize: 8, cellPadding: 1.5, halign: "center" },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── Shop-wise deliveries table ──
    const deliveryRows = (trip.deliveries || []).map(toDeliveryRow);
    if (deliveryRows.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text("Deliveries — Shop-wise Details", margin, y);
      doc.setFont("helvetica", "normal");
      y += 4;

      autoTable(doc, {
        head: [["S.No", "Shop Name", "Bird Type", "Boxes", "Box Nos", "Birds", "Weight (KG)", "Mor"]],
        body: deliveryRows.map((row, index) => [
          String(index + 1),
          row.shopName || "--",
          row.birdType || "--",
          String(row.boxNo || 0),
          (row.selectedBoxIds || []).join(", ") || "--",
          String(row.birds || 0),
          (row.weight || 0).toFixed(2),
          String(row.mortality || 0),
        ]),
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 8, cellPadding: 1.8 },
        columnStyles: {
          0: { halign: "center", cellWidth: 11 },
          1: { halign: "left", cellWidth: 40 },
          2: { halign: "left", cellWidth: 24 },
          3: { halign: "center", cellWidth: 14 },
          4: { halign: "left", cellWidth: 32 },
          5: { halign: "center", cellWidth: 15 },
          6: { halign: "center", cellWidth: 22 },
          7: { halign: "center", cellWidth: 12 },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const totalText = `Total Shops: ${trip.totalShops || deliveryRows.length}   Birds: ${
      trip.totalBirds || 0
    }   Weight: ${(trip.totalWeight || 0).toFixed(2)} KG   Mortality: ${trip.totalMortality || 0}`;
    doc.text(totalText, margin, y);

    const safeVehicleNo = (trip.vehicleNo || "vehicle").replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`${trip.tripNo || "trip"}_${safeVehicleNo}.pdf`);
  };

  // ─── Render the selected step ──────────────────────────────────
  const renderViewStep = () => {
    if (viewStepIndex === 0) {
      return isStartCompleted ? (
        <ViewStepStart trip={trip} />
      ) : (
        <EmptyStepNotice message="Trip start details have not been submitted yet." />
      );
    }
    if (viewStepIndex === 1) {
      return isFarmCompleted ? (
        <ViewStepFarm trip={trip} />
      ) : (
        <EmptyStepNotice message="Farm details have not been submitted yet." />
      );
    }
    if (viewStepIndex === 2) {
      return isPickupCompleted ? (
        <ViewStepPickup trip={trip} />
      ) : (
        <EmptyStepNotice message="Pickup details have not been submitted yet." />
      );
    }
    if (viewStepIndex === 3) {
      return isDeliveryCompleted || (trip.deliveries || []).length > 0 ? (
        <ViewStepDeliveries trip={trip} />
      ) : (
        <EmptyStepNotice message="Shop deliveries have not been submitted yet." />
      );
    }
    if (viewStepIndex === 4) {
      return isEndCompleted ? (
        <StepEnd
          trip={trip}
          setTrip={noopDispatch}
          updateTrip={noop}
          submitExpensesStep={() => false}
          submitStartStep={() => false}
          editable={false}
          canEdit={false}
          onCancel={noop}
          clearForm={noop}
        />
      ) : (
        <EmptyStepNotice message="Trip end / expenses have not been submitted yet." />
      );
    }
    return <EmptyStepNotice message="Select a step to view its details." />;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 sm:px-10 py-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Trip Details</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                {trip.tripNo ? `${trip.tripNo} • ${trip.vehicleNo || "--"}` : "Comprehensive overview"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loadingDetails && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Loader2 size={13} className="animate-spin" />
                Loading details…
              </span>
            )}
            {trip.status === "Completed" && trip.approvedBy && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-sm">
                <UserCheck size={12} />
                {`Approved by: ${trip.approvedBy}`}
              </span>
            )}
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-xs"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────── */}
        <div className="py-8 px-6 sm:px-10 overflow-y-auto space-y-6 flex-1">
          <TripWizardStepper
            steps={["Start", "Farm", "Pickup", "Deliveries", "End"]}
            currentStep={currentStep}
            completedMask={
              {
                start: isStartCompleted,
                farm: isFarmCompleted,
                pickup: isPickupCompleted,
                delivery: isDeliveryCompleted,
                end: isEndCompleted,
              } as any
            }
            onStepClick={setViewStepIndex}
          />

          {/* Manual step tabs — every step stays reachable in view mode */}
          <div className="flex flex-wrap items-center gap-2">
            {["Start", "Farm", "Pickup", "Deliveries", "End"].map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setViewStepIndex(index)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  viewStepIndex === index
                    ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>

          <div className="mt-4">{renderViewStep()}</div>

          <TripFinalKPI trip={trip} deliveries={trip.deliveries} />
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <div className="px-6 sm:px-10 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
          {onEdit && (
            <button
              onClick={() => onEdit(trip)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <Pencil size={15} />
              Edit Trip
            </button>
          )}
          <button
            onClick={downloadPDF}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Download size={15} />
            Download PDF
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TripViewModal({ open, trip, onClose, shops, birdTypes, onEdit }: Props) {
  if (!open || !trip) return null;

  return (
    <TripViewModalContent
      key={trip.id}
      trip={trip}
      onClose={onClose}
      shops={shops}
      birdTypes={birdTypes}
      onEdit={onEdit}
    />
  );
}

export default React.memo(TripViewModal);
