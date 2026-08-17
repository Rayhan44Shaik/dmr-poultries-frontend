import { useEffect, useMemo, useState } from 'react';
import { eachWeekOfInterval, endOfMonth, format, getWeek, startOfMonth } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import type { Vehicle } from '../../masters/vehicles/types/vehicle';
import useTrips from '../../operations/vehicle-trips/hooks/useTrips';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import { useFuelExpenses } from '../../operations/fuel-expenses/hooks/useFuelExpenses';
import type { FuelExpense } from '../../operations/fuel-expenses/types/fuelExpense';
import { handleApiError } from '../../../api/errors';
import { maintenanceApi, mapMaintenanceToEvent } from '../services/maintenanceApi';
import emiApi from '../services/emiApi';
import type { EmiSchedule, MaintenanceEvent } from '../types';

interface VehicleStat extends Vehicle {
  dist: number; fuel: number; fuelCost: number; maintenance: number; maintCost: number;
  emiCost: number; tollCost: number; otherCost: number; expense: number; totalExpense: number; mileage: number;
}

const numberOf = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const dayMs = (value: unknown): number | null => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
};
const dateString = (date: Date) => format(date, 'yyyy-MM-dd');
const tripOtherExpense = (trips: Trip[]) => trips.reduce((sum, trip) => sum + numberOf(trip.meals) + numberOf(trip.mealsTiffin) + numberOf(trip.loading) + numberOf(trip.vehicleMaintenance) + numberOf(trip.othersRC) + numberOf(trip.others1Amt) + numberOf(trip.others2Amt) + numberOf(trip.others3Amt) + numberOf(trip.others4Amt) + numberOf(trip.others5Amt), 0);
const tripTolls = (trips: Trip[]) => trips.reduce((sum, trip) => sum + numberOf(trip.pickupTolls) + numberOf(trip.deliveryTolls) + numberOf(trip.destinationTolls), 0);

export function useAnalyticsData() {
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const tripsState = useTrips(() => {});
  const allTrips = useMemo(() => tripsState?.allTrips ?? [], [tripsState]);
  const { filteredData: fuelExpenses, loading: fuelLoading } = useFuelExpenses(() => {});
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [emiSchedules, setEmiSchedules] = useState<EmiSchedule[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [fromDate, setFromDateState] = useState(() => dateString(startOfMonth(new Date())));
  const [toDate, setToDateState] = useState(() => dateString(endOfMonth(new Date())));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRemoteLoading(true); setError(null);
      try {
        const [maintenancePayload, emiPayload] = await Promise.all([
          maintenanceApi.list({ status: 'Approved', fromDate, toDate, vehicleId: selectedVehicleId || undefined, limit: 500 }),
          emiApi.list({ vehicleId: selectedVehicleId || undefined, fromDate, toDate, limit: 500 }),
        ]);
        if (cancelled) return;
        const rows = Array.isArray(maintenancePayload) ? maintenancePayload : maintenancePayload?.data ?? [];
        setMaintenance(rows.map(mapMaintenanceToEvent));
        setEmiSchedules(emiPayload);
      } catch (cause) {
        if (!cancelled) { setMaintenance([]); setEmiSchedules([]); setError(handleApiError(cause)); }
      } finally { if (!cancelled) setRemoteLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [fromDate, selectedVehicleId, toDate]);

  const setFromDate = (value: string) => { if (value) { setFromDateState(value); if (value > toDate) setToDateState(value); } };
  const setToDate = (value: string) => { if (value) { setToDateState(value); if (value < fromDate) setFromDateState(value); } };
  const clearFilters = () => { setSelectedVehicleId(null); setFromDateState(dateString(startOfMonth(new Date()))); setToDateState(dateString(endOfMonth(new Date()))); };
  const inRange = (value: unknown) => { const point = dayMs(value); const start = dayMs(fromDate); const end = dayMs(toDate); return point != null && start != null && end != null && point >= start && point <= end; };
  const selectedVehicle = vehicles.find((vehicle) => selectedVehicleId == null || vehicle.id === selectedVehicleId);
  const selectedNumber = selectedVehicleId == null ? null : selectedVehicle?.vehicleNumber;

  const periodTrips = useMemo(() => allTrips.filter((trip) => trip.status === 'Completed' && !trip.deleted && inRange(trip.tripDate) && (!selectedNumber || trip.vehicleNo === selectedNumber)), [allTrips, fromDate, selectedNumber, toDate]);
  const periodFuel = useMemo(() => (fuelExpenses || []).filter((entry: FuelExpense) => inRange(entry.date) && (!selectedNumber || entry.vehicleNo === selectedNumber)), [fuelExpenses, fromDate, selectedNumber, toDate]);
  const periodMaintenance = useMemo(() => maintenance.filter((record) => inRange(record.date) && (selectedVehicleId == null || String(record.vehicleId) === String(selectedVehicleId))), [fromDate, maintenance, selectedVehicleId, toDate]);
  const periodEmi = useMemo(() => emiSchedules.filter((schedule) => !schedule.nextEmiDate || inRange(schedule.nextEmiDate)), [emiSchedules, fromDate, toDate]);

  const totalDistance = periodTrips.reduce((sum, trip) => sum + numberOf(trip.totalKm), 0);
  const totalFuel = periodFuel.reduce((sum, entry) => sum + numberOf(entry.litres), 0);
  const fuelCost = periodFuel.reduce((sum, entry) => sum + numberOf(entry.amount), 0);
  const maintenanceCost = periodMaintenance.reduce((sum, record) => sum + numberOf(record.totalCost), 0);
  const emiCost = periodEmi.filter((schedule) => schedule.status !== 'paid' && schedule.status !== 'closed').reduce((sum, schedule) => sum + numberOf(schedule.emiAmount), 0);
  const tollCost = tripTolls(periodTrips);
  const otherCost = tripOtherExpense(periodTrips);
  const totalExpense = fuelCost + maintenanceCost + emiCost + tollCost + otherCost;
  const stats = { totalTrips: periodTrips.length, totalDistance, totalFuel, fuelCost, maintenanceCost, emiCost, totalExpense, avgMileage: totalFuel > 0 ? totalDistance / totalFuel : 0, costPerKM: totalDistance > 0 ? totalExpense / totalDistance : 0 };

  const weeklyData = useMemo(() => eachWeekOfInterval({ start: new Date(`${fromDate}T00:00:00`), end: new Date(`${toDate}T00:00:00`) }).map((week) => {
    const start = week.getTime(); const end = start + 7 * 86400000;
    const trips = periodTrips.filter((trip) => { const point = dayMs(trip.tripDate); return point != null && point >= start && point < end; });
    const fuel = periodFuel.filter((entry) => { const point = dayMs(entry.date); return point != null && point >= start && point < end; }).reduce((sum, entry) => sum + numberOf(entry.litres), 0);
    const distance = trips.reduce((sum, trip) => sum + numberOf(trip.totalKm), 0);
    return { week: `W${getWeek(week)}`, fuel, mileage: fuel > 0 ? distance / fuel : 0 };
  }), [fromDate, periodFuel, periodTrips, toDate]);

  const expenseBreakdown = [
    { name: 'Fuel', value: fuelCost }, { name: 'Maintenance', value: maintenanceCost },
    { name: 'EMI', value: emiCost }, { name: 'Toll', value: tollCost }, { name: 'Other', value: otherCost },
  ];

  const vehicleStats = useMemo((): VehicleStat[] => vehicles.filter((vehicle) => selectedVehicleId == null || vehicle.id === selectedVehicleId).map((vehicle) => {
    const trips = periodTrips.filter((trip) => trip.vehicleNo === vehicle.vehicleNumber);
    const fuelRows = periodFuel.filter((entry) => entry.vehicleNo === vehicle.vehicleNumber);
    const maintenanceRows = periodMaintenance.filter((record) => String(record.vehicleId) === String(vehicle.id));
    const emiRows = periodEmi.filter((record) => String(record.vehicleId) === String(vehicle.id));
    const dist = trips.reduce((sum, trip) => sum + numberOf(trip.totalKm), 0);
    const fuel = fuelRows.reduce((sum, entry) => sum + numberOf(entry.litres), 0);
    const vehicleFuelCost = fuelRows.reduce((sum, entry) => sum + numberOf(entry.amount), 0);
    const maintCost = maintenanceRows.reduce((sum, record) => sum + numberOf(record.totalCost), 0);
    const vehicleEmiCost = emiRows.filter((record) => record.status !== 'paid' && record.status !== 'closed').reduce((sum, record) => sum + numberOf(record.emiAmount), 0);
    const tollCost = tripTolls(trips); const otherCost = tripOtherExpense(trips);
    const expense = vehicleFuelCost + maintCost + vehicleEmiCost + tollCost + otherCost;
    return { ...vehicle, dist, fuel, fuelCost: vehicleFuelCost, maintenance: maintCost, maintCost, emiCost: vehicleEmiCost, tollCost, otherCost, expense, totalExpense: expense, mileage: fuel > 0 ? dist / fuel : 0 };
  }), [periodEmi, periodFuel, periodMaintenance, periodTrips, selectedVehicleId, vehicles]);

  return {
    stats, weeklyData, expenseBreakdown,
    topPerformers: [...vehicleStats].sort((a, b) => b.mileage - a.mileage).slice(0, 5),
    highestExpense: [...vehicleStats].sort((a, b) => b.expense - a.expense).slice(0, 5),
    fromDate, toDate, setFromDate, setToDate, selectedVehicleId, setSelectedVehicleId,
    vehicles, clearFilters, loading: vehiclesLoading || fuelLoading || remoteLoading, error,
  };
}
