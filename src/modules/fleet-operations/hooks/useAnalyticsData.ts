import { useEffect, useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, eachWeekOfInterval, getWeek, format } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import type { Vehicle } from '../../masters/vehicles/types/vehicle';
import useTrips from '../../operations/vehicle-trips/hooks/useTrips';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import { useFuelExpenses } from '../../operations/fuel-expenses/hooks/useFuelExpenses';
import type { FuelExpense } from '../../operations/fuel-expenses/types/fuelExpense';
import { maintenanceApi, mapMaintenanceToEvent } from '../services/maintenanceApi';
import { getFastagTransactions, getFastags } from '../services/storage';
import type { MaintenanceEvent } from '../types';

interface FastagTransaction {
  fastagId: string;
  date: string;
  amount: number;
}

interface FastagRecord {
  id: string | number;
  vehicleId: string | number;
}

interface VehicleStat extends Vehicle {
  dist: number;
  fuel: number;
  fuelCost: number;
  maintenance: number;
  maintCost: number;
  tollCost: number;
  otherCost: number;
  expense: number;
  totalExpense: number;
  mileage: number;
}

const dummyNotify = () => {};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Trip cash spent that isn't diesel (that's fuel_expenses) or tolls (own
 *  cost centre): driver bata, meals, loading, on-road maintenance, etc. */
const tripOtherExpense = (trips: Trip[]): number =>
  trips.reduce(
    (sum: number, t: Trip) =>
      sum +
      toNumber(t.meals) +
      toNumber(t.mealsTiffin) +
      toNumber(t.loading) +
      toNumber(t.vehicleMaintenance) +
      toNumber(t.othersRC) +
      toNumber(t.others1Amt) +
      toNumber(t.others2Amt) +
      toNumber(t.others3Amt) +
      toNumber(t.others4Amt) +
      toNumber(t.others5Amt),
    0
  );

const tripTollExpense = (trips: Trip[]): number =>
  trips.reduce(
    (sum: number, t: Trip) =>
      sum +
      toNumber(t.pickupTolls) +
      toNumber(t.deliveryTolls) +
      toNumber(t.destinationTolls),
    0
  );

const sumOf = <T,>(items: T[], key: keyof T): number =>
  items.reduce((sum: number, item: T) => sum + toNumber(item[key]), 0);

/** Normalize any date-ish value (YYYY-MM-DD or ISO datetime) to a local
 *  midnight millisecond timestamp. Used for inclusive business-date filtering. */
const dayMs = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const toDateStr = (d: Date): string => format(d, 'yyyy-MM-dd');

export function useAnalyticsData() {
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const tripsData = useTrips(dummyNotify);
  const allTrips = useMemo(() => tripsData?.allTrips ?? [], [tripsData]);
  const { filteredData: fuelExpenses, loading: fuelLoading } = useFuelExpenses(dummyNotify);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await maintenanceApi.list({ status: 'Approved' });
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        if (!cancelled) setMaintenance(Array.isArray(list) ? list.map(mapMaintenanceToEvent) : []);
      } catch {
        if (!cancelled) setMaintenance([]);
      } finally {
        if (!cancelled) setMaintenanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fastags = useMemo(() => (getFastags() || []) as FastagRecord[], []);
  const fastagTransactions = useMemo(
    () => (getFastagTransactions() || []) as FastagTransaction[],
    []
  );
  const fastagVehicleId = useMemo(() => {
    const map = new Map<string | number, string>();
    fastags.forEach((tag: FastagRecord) => {
      if (tag.id != null) map.set(tag.id, String(tag.vehicleId));
    });
    return map;
  }, [fastags]);

  // ============================================================
  // SHARED FILTER STATE — single source of truth for the page.
  // Department: fromDate / toDate / selectedVehicleId.
  // Every KPI, chart and table derives from these three values only.
  // ============================================================
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [fromDate, setFromDateState] = useState<string>(() => toDateStr(startOfMonth(new Date())));
  const [toDate, setToDateState] = useState<string>(() => toDateStr(endOfMonth(new Date())));

  // Keep the range always valid — clearing one side falls back to default.
  const setFromDate = (value: string) => {
    if (value) {
      setFromDateState(value);
      if (toDate && value > toDate) setToDateState(value);
    }
  };
  const setToDate = (value: string) => {
    if (value) {
      setToDateState(value);
      if (fromDate && value < fromDate) setFromDateState(value);
    }
  };

  const resetDateRange = () => {
    const now = new Date();
    setFromDateState(toDateStr(startOfMonth(now)));
    setToDateState(toDateStr(endOfMonth(now)));
  };
  const clearFilters = () => {
    setSelectedVehicleId(null);
    resetDateRange();
  };

  // Local-midnight boundaries (fromDate/toDate are YYYY-MM-DD).
  const startDate = new Date(`${fromDate}T00:00:00`);
  const endDate = new Date(`${toDate}T00:00:00`);

  /** Inclusive business-date window test used by every source. */
  const inRange = (value: unknown): boolean => {
    const ms = dayMs(value);
    if (ms == null) return false;
    const fromMs = dayMs(fromDate);
    const toMs = dayMs(toDate);
    if (fromMs == null || toMs == null) return false;
    return ms >= fromMs && ms <= toMs;
  };

  const selectedVehicle = useMemo(() => {
    if (selectedVehicleId == null) return null;
    return vehicles.find((v: Vehicle) => String(v.id) === String(selectedVehicleId)) ?? null;
  }, [vehicles, selectedVehicleId]);
  const selectedVehicleNumber = selectedVehicle
    ? String(selectedVehicle.vehicleNumber || '')
    : null;

  // Completed trips only — draft/pending/deleted records never feed analytics.
  // Business date used: tripDate. Optional: restrict to the selected vehicle.
  const periodTrips = useMemo(
    () =>
      allTrips.filter((t: Trip) => {
        if (t.status !== 'Completed') return false;
        if (!inRange(t.tripDate)) return false;
        if (selectedVehicleNumber && String(t.vehicleNo || '') !== selectedVehicleNumber)
          return false;
        return true;
      }),
    [allTrips, fromDate, toDate, selectedVehicleNumber]
  );

  // Business date used: billDate. Optional: restrict to the selected vehicle.
  const periodFuel = useMemo(
    () =>
      (fuelExpenses || []).filter((f: FuelExpense) => {
        if (!inRange(f.date)) return false;
        if (selectedVehicleNumber && String(f.vehicleNo || '') !== selectedVehicleNumber)
          return false;
        return true;
      }),
    [fuelExpenses, fromDate, toDate, selectedVehicleNumber]
  );

  // Business date used: maintenance date. Optional: restrict to the selected vehicle.
  const periodMaintenance = useMemo(
    () =>
      maintenance.filter((m: MaintenanceEvent) => {
        if (!inRange(m.date)) return false;
        if (selectedVehicleId != null && String(m.vehicleId) !== String(selectedVehicleId))
          return false;
        return true;
      }),
    [maintenance, fromDate, toDate, selectedVehicleId]
  );

  // Business date used: FASTag transaction date. Optional: restrict to the selected vehicle.
  const periodToll = useMemo(
    () =>
      fastagTransactions.filter((tx: FastagTransaction) => {
        if (!inRange(tx.date)) return false;
        if (
          selectedVehicleId != null &&
          String(fastagVehicleId.get(tx.fastagId) ?? '') !== String(selectedVehicleId)
        )
          return false;
        return true;
      }),
    [fastagTransactions, fromDate, toDate, selectedVehicleId, fastagVehicleId]
  );

  const totalDistance = useMemo(() => sumOf(periodTrips, 'totalKm'), [periodTrips]);
  const fuelLitres = useMemo(() => sumOf(periodFuel, 'litres'), [periodFuel]);
  const fuelCost = useMemo(() => sumOf(periodFuel, 'amount'), [periodFuel]);
  const maintCost = useMemo(() => sumOf(periodMaintenance, 'totalCost'), [periodMaintenance]);
  const tollCost = useMemo(
    () => sumOf(periodToll, 'amount') + tripTollExpense(periodTrips),
    [periodToll, periodTrips]
  );
  const otherCost = useMemo(() => tripOtherExpense(periodTrips), [periodTrips]);
  const totalExpense = fuelCost + maintCost + tollCost + otherCost;

  // Aggregate KPI stats
  const stats = useMemo(() => {
    const avgMileage = totalDistance > 0 && fuelLitres > 0 ? totalDistance / fuelLitres : 0;
    const costPerKM = totalDistance > 0 ? totalExpense / totalDistance : 0;
    return { totalDistance, totalFuel: fuelLitres, totalExpense, avgMileage, costPerKM };
  }, [totalDistance, fuelLitres, totalExpense]);

  // Weekly fuel (litres) and mean mileage for charts — weeks and records are
  // both bounded by the selected date range.
  const weeklyData = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
    return weeks.map((week: Date) => {
      const weekStart = week.getTime();
      const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
      const weekTrips = periodTrips.filter((t: Trip) => {
        const ms = dayMs(t.tripDate);
        return ms != null && ms >= weekStart && ms < weekEnd;
      });
      const weekFuel = periodFuel.filter((f: FuelExpense) => {
        const ms = dayMs(f.date);
        return ms != null && ms >= weekStart && ms < weekEnd;
      });
      const fuel = weekFuel.reduce((sum: number, f: FuelExpense) => sum + toNumber(f.litres), 0);
      const dist = weekTrips.reduce((sum: number, t: Trip) => sum + toNumber(t.totalKm), 0);
      return {
        week: `W${getWeek(week)}`,
        fuel,
        mileage: dist > 0 && fuel > 0 ? dist / fuel : 0,
      };
    });
  }, [periodTrips, periodFuel, startDate, endDate]);

  // Cost centre allocations — each real cost appears exactly once.
  const expenseBreakdown = useMemo(
    () => [
      { name: 'Fuel', value: fuelCost },
      { name: 'Maintenance', value: maintCost },
      { name: 'Toll', value: tollCost },
      { name: 'Other', value: otherCost },
    ],
    [fuelCost, maintCost, tollCost, otherCost]
  );

  // Per-vehicle stats restricted to the selected vehicle (when one is chosen).
  const vehicleStats = useMemo((): VehicleStat[] => {
    return vehicles
      .filter((v: Vehicle) => selectedVehicleId == null || String(v.id) === String(selectedVehicleId))
      .map((v: Vehicle) => {
        const vNumber = String(v.vehicleNumber || '');
        const vTrips = periodTrips.filter((t: Trip) => String(t.vehicleNo || '') === vNumber);
        const vFuel = periodFuel.filter((f: FuelExpense) => String(f.vehicleNo || '') === vNumber);
        const vMaint = periodMaintenance.filter(
          (m: MaintenanceEvent) => String(m.vehicleId) === String(v.id)
        );
        const vToll = periodToll.filter(
          (tx: FastagTransaction) => String(fastagVehicleId.get(tx.fastagId) ?? '') === String(v.id)
        );

        const dist = vTrips.reduce((sum: number, t: Trip) => sum + toNumber(t.totalKm), 0);
        const fuel = vFuel.reduce((sum: number, f: FuelExpense) => sum + toNumber(f.litres), 0);
        const fuelCost = vFuel.reduce((sum: number, f: FuelExpense) => sum + toNumber(f.amount), 0);
        const maintCost = vMaint.reduce(
          (sum: number, m: MaintenanceEvent) => sum + toNumber(m.totalCost),
          0
        );
        const tollCost =
          vToll.reduce((sum: number, tx: FastagTransaction) => sum + toNumber(tx.amount), 0) +
          tripTollExpense(vTrips);
        const otherCost = tripOtherExpense(vTrips);
        const expense = fuelCost + maintCost + tollCost + otherCost;
        const mileage = dist > 0 && fuel > 0 ? dist / fuel : 0;

        return {
          ...v,
          dist,
          fuel,
          fuelCost,
          maintenance: maintCost,
          maintCost,
          tollCost,
          otherCost,
          expense,
          totalExpense: expense,
          mileage,
        };
      });
  }, [vehicles, selectedVehicleId, periodTrips, periodFuel, periodMaintenance, periodToll, fastagVehicleId]);

  const topPerformers = useMemo(() => {
    return [...vehicleStats]
      .sort((a: VehicleStat, b: VehicleStat) => (b.mileage || 0) - (a.mileage || 0))
      .slice(0, 5);
  }, [vehicleStats]);

  const highestExpense = useMemo(() => {
    return [...vehicleStats]
      .sort((a: VehicleStat, b: VehicleStat) => (b.expense || 0) - (a.expense || 0))
      .slice(0, 5);
  }, [vehicleStats]);

  const loading = vehiclesLoading || fuelLoading || maintenanceLoading;

  return {
    stats,
    weeklyData,
    expenseBreakdown,
    topPerformers,
    highestExpense,
    // ---- shared filter state (single source of truth) ----
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    selectedVehicleId,
    setSelectedVehicleId,
    vehicles,
    clearFilters,
    loading,
  };
}