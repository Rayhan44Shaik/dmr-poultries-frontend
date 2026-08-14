// src/modules/fleet-operations/hooks/useFleetDashboardData.ts
// Fleet dashboard + fleet overview data.
// Sources: vehicles (PostgreSQL API), trips (PostgreSQL API), fuel expenses,
// maintenance, documents, FASTag and EMI records (existing fleet stores).

import { useMemo } from "react";
import { endOfMonth, format, isWithinInterval, startOfMonth } from "date-fns";
import type {
  EMIRecord,
  FASTag,
  FleetDashboardStats,
  FleetDocumentStatus,
  FleetExpiryState,
  FleetVehicleOverview,
  FleetVehicleStatus,
  MaintenanceEvent,
  VehicleDocument,
} from "../types";
import { useVehicles } from "../../masters/vehicles/hooks/useVehicles";
import useTrips from "../../operations/vehicle-trips/hooks/useTrips";
import { fuelExpenseService } from "../../operations/fuel-expenses/services/fuelExpenseService";
import { getDocuments, getEMIRecords, getFastags, getMaintenance } from "../services/storage";
import type { Trip } from "../../operations/vehicle-trips/types/trip";

export interface FleetOverviewResult {
  /** Per-vehicle status cards for the fleet overview. */
  fleetVehicles: FleetVehicleOverview[];
  fleetCounts: Record<FleetVehicleStatus, number>;
  fleetLoading: boolean;
  fleetError: string | null;
  /** Retries the vehicles API load (used by the error state). */
  fleetReload: () => Promise<unknown>;
}

export type FleetDashboardData = FleetDashboardStats & FleetOverviewResult;

const DUMMY_NOTIFY = () => {};

/* ------------------------------------------------------------------ */
/*  Date helpers (documents store mixes dd/MM/yyyy and ISO formats)    */
/* ------------------------------------------------------------------ */
function parseDateLike(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  if (iso) {
    const date = new Date(`${value.trim().slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const ddMmYyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (ddMmYyyy) {
    const date = new Date(Number(ddMmYyyy[3]), Number(ddMmYyyy[2]) - 1, Number(ddMmYyyy[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function expiryState(value: string | null | undefined): FleetExpiryState {
  const date = parseDateLike(value);
  if (!date) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return "expired";
  const soon = new Date(today.getTime() + 30 * 86400000);
  if (date <= soon) return "expiring";
  return "safe";
}

function formatExpiry(value: string | null | undefined): string | null {
  const date = parseDateLike(value);
  if (!date) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function docStatus(value: string | null | undefined): FleetDocumentStatus {
  return { expiry: formatExpiry(value), state: expiryState(value) };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */
export function useFleetDashboardData(): FleetDashboardData {
  const { vehicles, loading: vehiclesLoading, error: vehiclesError, reload: vehiclesReload } = useVehicles();
  const tripsData = useTrips(DUMMY_NOTIFY);
  const allTrips = useMemo(() => tripsData?.allTrips || [], [tripsData?.allTrips]);

  const maintenance = useMemo<MaintenanceEvent[]>(() => getMaintenance() as MaintenanceEvent[], []);
  const documents = useMemo<VehicleDocument[]>(() => getDocuments(), []);
  const fastags = useMemo<FASTag[]>(() => getFastags() as FASTag[], []);
  const emiRecords = useMemo<EMIRecord[]>(() => getEMIRecords() as EMIRecord[], []);
  const fuelExpenses = useMemo(() => {
    try {
      return fuelExpenseService.getAll();
    } catch {
      return [];
    }
  }, []);

  return useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    /* ----- Vehicle ↔ trip maps ----- */
    const byVehicleNo = (trip: Trip) => trip.vehicleNo;
    const activeTrips = allTrips.filter((t) => t.status === "Pending" && !t.deleted);
    const activeTripByVehicle = new Map<string, Trip>();
    activeTrips.forEach((t) => {
      const key = byVehicleNo(t);
      if (key && !activeTripByVehicle.has(key)) activeTripByVehicle.set(key, t);
    });

    const latestTripByVehicle = new Map<string, Trip>();
    [...allTrips]
      .filter((t) => !t.deleted && t.vehicleNo)
      .sort((a, b) => b.tripDate.localeCompare(a.tripDate) || b.id - a.id)
      .forEach((t) => {
        const key = byVehicleNo(t);
        if (!latestTripByVehicle.has(key)) latestTripByVehicle.set(key, t);
      });

    /** Odometer from the latest trip (closing meter, else opening + distance). */
    const odometerFor = (vehicleNumber: string): number | null => {
      const trip = latestTripByVehicle.get(vehicleNumber);
      if (!trip) return null;
      if (trip.closingMeter > 0) return trip.closingMeter;
      if (trip.openingMeter > 0 && trip.totalKm > 0) return trip.openingMeter + trip.totalKm;
      if (trip.openingMeter > 0) return trip.openingMeter;
      return null;
    };

    /* ----- Maintenance per vehicle ----- */
    const maintenanceFor = (vehicleId: number): MaintenanceEvent[] =>
      maintenance
        .filter((m) => String(m.vehicleId) === String(vehicleId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const documentsFor = (vehicleId: number, type: string): VehicleDocument | undefined =>
      documents.find((d) => d.type === type && String(d.vehicleId) === String(vehicleId));

    /* ----- Fuel per vehicle ----- */
    const fuelFor = (vehicleNumber: string) =>
      fuelExpenses.filter((f) => f.vehicleNo === vehicleNumber);

    /* ----- Fleet overview (per-vehicle cards) ----- */
    const fleetVehicles: FleetVehicleOverview[] = vehicles
      .map((v) => {
        const vehicleNumber = v.vehicleNumber;
        const activeTrip = activeTripByVehicle.get(vehicleNumber);
        const latestTrip = latestTripByVehicle.get(vehicleNumber);
        const odometerKm = odometerFor(vehicleNumber);

        const vehicleMaintenance = maintenanceFor(v.id);
        const lastService = vehicleMaintenance[0];
        const lastServiceDate = lastService ? lastService.date.slice(0, 10) : null;
        const nextServiceKm =
          lastService?.nextServiceKM && lastService.nextServiceKM > 0 ? lastService.nextServiceKM : null;
        const serviceDue = nextServiceKm != null && odometerKm != null && odometerKm >= nextServiceKm;
        const recentlyServiced =
          lastServiceDate != null &&
          parseDateLike(lastServiceDate) != null &&
          new Date(lastServiceDate).getTime() >= now.getTime() - 30 * 86400000;

        let status: FleetVehicleStatus;
        if (v.status !== "Active") {
          status = "Inactive";
        } else if (activeTrip) {
          status = "On Trip";
        } else if (recentlyServiced || serviceDue) {
          status = "Maintenance";
        } else {
          status = "Available";
        }

        const monthFuel = fuelFor(vehicleNumber)
          .filter((f) => {
            const date = parseDateLike(f.date);
            return date != null && isWithinInterval(date, { start: monthStart, end: monthEnd });
          })
          .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

        const lastFuelEntry = [...fuelFor(vehicleNumber)].sort((a, b) => b.date.localeCompare(a.date))[0];

        const emiCandidates = emiRecords
          .filter((e) => String(e.vehicleId) === String(v.id) && e.status !== "paid")
          .sort((a, b) => (a.nextEMIDate || "").localeCompare(b.nextEMIDate || ""));
        const activeEmi = emiCandidates[0];
        const emiDueDate = parseDateLike(activeEmi?.nextEMIDate);

        const fastag = fastags.find((f) => String(f.vehicleId) === String(v.id));

        return {
          id: v.id,
          vehicleNo: v.vehicleNo,
          vehicleNumber,
          vehicleType: v.vehicleType,
          status,
          driverName: activeTrip?.driverName || latestTrip?.driverName || "—",
          currentTripNo: activeTrip?.tripNo || "",
          odometerKm,
          fuelThisMonth: monthFuel,
          lastFuel: lastFuelEntry
            ? {
                date: lastFuelEntry.date.slice(0, 10),
                amount: Number(lastFuelEntry.amount) || 0,
                litres: Number(lastFuelEntry.litres) || 0,
              }
            : null,
          maintenance: {
            lastServiceDate: lastServiceDate
              ? formatExpiry(lastServiceDate)
              : null,
            nextServiceKm,
            serviceDue,
          },
          documents: {
            insurance: docStatus(v.insuranceExpiry || documentsFor(v.id, "insurance")?.expiryDate),
            permit: docStatus(v.permitExpiry || documentsFor(v.id, "permit")?.expiryDate),
            fitness: docStatus(v.fitnessExpiry || documentsFor(v.id, "fitness")?.expiryDate),
          },
          emi: activeEmi
            ? {
                financeCompany: activeEmi.financeCompany,
                emiAmount: Number(activeEmi.emiAmount) || 0,
                nextDueDate: emiDueDate ? formatExpiry(activeEmi.nextEMIDate) ?? activeEmi.nextEMIDate : activeEmi.nextEMIDate,
                overdue: emiDueDate != null && emiDueDate.getTime() < now.getTime(),
              }
            : null,
          fastag: fastag
            ? {
                provider: fastag.provider,
                balance: Number(fastag.balance) || 0,
                lowBalance: fastag.status !== "good",
              }
            : null,
        };
      })
      .sort((a, b) => {
        const order: Record<FleetVehicleStatus, number> = { "On Trip": 0, Maintenance: 1, Available: 2, Inactive: 3 };
        return order[a.status] - order[b.status] || a.vehicleNumber.localeCompare(b.vehicleNumber);
      });

    const fleetCounts: Record<FleetVehicleStatus, number> = {
      "On Trip": fleetVehicles.filter((v) => v.status === "On Trip").length,
      Maintenance: fleetVehicles.filter((v) => v.status === "Maintenance").length,
      Available: fleetVehicles.filter((v) => v.status === "Available").length,
      Inactive: fleetVehicles.filter((v) => v.status === "Inactive").length,
    };

    /* ----- Existing dashboard stats ----- */
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter((v) => v.status === "Active").length;
    const underMaintenance = fleetCounts.Maintenance;

    const thisMonthTrips = allTrips.filter(
      (t) => t.tripDate && isWithinInterval(new Date(t.tripDate), { start: monthStart, end: monthEnd })
    );
    const fuelCostThisMonth = thisMonthTrips.reduce((sum, t) => sum + (t.expense || 0), 0);
    const totalKMThisMonth = thisMonthTrips.reduce((sum, t) => sum + (t.totalKm || 0), 0);

    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);
    const expiringDocs = documents.filter((d) => {
      const date = parseDateLike(d.expiryDate);
      return date != null && date >= now && date <= thirtyDaysLater;
    });
    const insuranceExpiring = expiringDocs.filter((d) => d.type === "insurance").length;
    const fitnessExpiring = expiringDocs.filter((d) => d.type === "fitness").length;
    const permitExpiring = expiringDocs.filter((d) => d.type === "permit").length;
    const fastagLowBalance = fastags.filter((f) => f.status === "low" || f.status === "critical").length;

    const serviceDue = fleetVehicles.filter((v) => v.maintenance.serviceDue).length;

    const monthlyFuel: Record<string, number> = {};
    allTrips.forEach((t) => {
      if (t.tripDate && t.expense) {
        const key = format(new Date(t.tripDate), "yyyy-MM");
        monthlyFuel[key] = (monthlyFuel[key] || 0) + t.expense;
      }
    });
    const monthlyFuelTrend = Object.entries(monthlyFuel)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, fuel]) => ({ month, fuel }));

    const statusCounts = {
      "On Trip": fleetCounts["On Trip"],
      Available: fleetCounts.Available,
      Maintenance: fleetCounts.Maintenance,
      Inactive: fleetCounts.Inactive,
    };
    const vehicleStatusDonut = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    const maintCosts: Record<string, number> = {};
    maintenance
      .filter((m) => isWithinInterval(new Date(m.date), { start: monthStart, end: monthEnd }))
      .forEach((m) => {
        maintCosts[String(m.vehicleId)] = (maintCosts[String(m.vehicleId)] || 0) + m.totalCost;
      });
    const topMaintenanceCost = Object.entries(maintCosts)
      .map(([vehicleId, cost]) => {
        const vehicle = vehicles.find((v) => String(v.id) === vehicleId);
        return { vehicle: vehicle?.vehicleNumber || vehicleId, cost };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    const todayTrips = allTrips.filter(
      (t) => t.tripDate && isWithinInterval(new Date(t.tripDate), { start: todayStart, end: now })
    );
    const kmToday = todayTrips.reduce((sum, t) => sum + (t.totalKm || 0), 0);
    const fuelToday = todayTrips.reduce((sum, t) => sum + (t.fuel || 0), 0);
    const documentsExpiring = expiringDocs.length;

    const totalKM = allTrips.reduce((sum, t) => sum + (t.totalKm || 0), 0);
    const totalFuel = allTrips.reduce((sum, t) => sum + (t.fuel || 0), 0);
    const avgFuelEfficiency = totalFuel > 0 ? totalKM / totalFuel : 0;

    return {
      totalVehicles,
      activeVehicles,
      underMaintenance,
      fuelCostThisMonth,
      totalKMThisMonth,
      serviceDue,
      insuranceExpiring,
      fitnessExpiring,
      permitExpiring,
      fastagLowBalance,
      monthlyFuelTrend,
      vehicleStatusDonut,
      topMaintenanceCost,
      kmToday,
      fuelToday,
      tollToday: 0,
      documentsExpiring,
      avgFuelEfficiency,
      // Fleet overview
      fleetVehicles,
      fleetCounts,
      fleetLoading: vehiclesLoading,
      fleetError: vehiclesError,
      fleetReload: vehiclesReload,
    };
  }, [vehicles, vehiclesLoading, vehiclesError, vehiclesReload, allTrips, maintenance, documents, fastags, emiRecords, fuelExpenses]);
}
