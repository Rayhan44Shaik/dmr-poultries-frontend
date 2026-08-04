import { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, subMonths, eachWeekOfInterval, getWeek } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import useTrips from '../../operations/vehicle-trips/hooks/useTrips';
import { getMaintenance, getFastagTransactions } from '../services/storage';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  currentKM: number;
  maintenanceType: string;
  serviceType: string;
  garage?: string;
  mechanic?: string;
  nextServiceKM?: number;
  totalCost: number;
  parts: any[];
  remarks?: string;
}

const dummyNotify = () => {};

export function useAnalyticsData() {
  const { vehicles } = useVehicles();
  const tripsData = useTrips(dummyNotify);
  const allTrips = tripsData?.allTrips || [];
  const maintenance = useMemo(() => getMaintenance() as MaintenanceRecord[], []);
  const fastagTransactions = useMemo(() => getFastagTransactions(), []);
  const [period, setPeriod] = useState<'thisMonth' | 'lastMonth' | 'quarter'>('thisMonth');

  const now = new Date();
  let startDate: Date, endDate: Date;
  if (period === 'thisMonth') {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else if (period === 'lastMonth') {
    const lastMonth = subMonths(now, 1);
    startDate = startOfMonth(lastMonth);
    endDate = endOfMonth(lastMonth);
  } else {
    startDate = subMonths(now, 3);
    endDate = now;
  }

  const filteredTrips = useMemo(() => {
    return allTrips.filter((t: any) => {
      const d = new Date(t.tripDate);
      return d >= startDate && d <= endDate;
    });
  }, [allTrips, startDate, endDate]);

  const stats = useMemo(() => {
    const totalDistance = filteredTrips.reduce((sum: number, t: any) => sum + (t.totalKm || 0), 0);
    const totalFuel = filteredTrips.reduce((sum: number, t: any) => sum + (t.fuel || 0), 0);
    const totalExpense = filteredTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
    const avgMileage = totalFuel > 0 ? totalDistance / totalFuel : 0;
    const costPerKM = totalDistance > 0 ? totalExpense / totalDistance : 0;
    return { totalDistance, totalFuel, totalExpense, avgMileage, costPerKM };
  }, [filteredTrips]);

  const weeklyData = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
    return weeks.map((week: Date) => {
      const weekTrips = filteredTrips.filter((t: any) => {
        const d = new Date(t.tripDate);
        return d >= week && d < new Date(week.getTime() + 7 * 24 * 60 * 60 * 1000);
      });
      const fuel = weekTrips.reduce((sum: number, t: any) => sum + (t.fuel || 0), 0);
      const dist = weekTrips.reduce((sum: number, t: any) => sum + (t.totalKm || 0), 0);
      return {
        week: `W${getWeek(week)}`,
        fuel,
        mileage: dist > 0 ? dist / fuel : 0,
      };
    });
  }, [filteredTrips, startDate, endDate]);

  const expenseBreakdown = useMemo(() => {
    const fuelTotal = filteredTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
    const tollTotal = fastagTransactions
      .filter((t: any) => new Date(t.date) >= startDate && new Date(t.date) <= endDate)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const maintTotal = maintenance
      .filter((m: MaintenanceRecord) => new Date(m.date) >= startDate && new Date(m.date) <= endDate)
      .reduce((sum: number, m: MaintenanceRecord) => sum + m.totalCost, 0);
    const otherTotal = Math.max(0, stats.totalExpense - fuelTotal - tollTotal - maintTotal);
    return [
      { name: 'Fuel', value: fuelTotal },
      { name: 'Maintenance', value: maintTotal },
      { name: 'Toll', value: tollTotal },
      { name: 'Other', value: otherTotal },
    ];
  }, [filteredTrips, fastagTransactions, maintenance, startDate, endDate, stats.totalExpense]);

  const vehicleStats = useMemo(() => {
    return vehicles.map((v: any) => {
      const vTrips = filteredTrips.filter((t: any) => t.vehicleNo === v.vehicleNumber);
      const dist = vTrips.reduce((sum: number, t: any) => sum + (t.totalKm || 0), 0);
      const fuel = vTrips.reduce((sum: number, t: any) => sum + (t.fuel || 0), 0);
      const expense = vTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
      const mileage = fuel > 0 ? dist / fuel : 0;
      return { ...v, dist, fuel, expense, mileage };
    });
  }, [vehicles, filteredTrips]);

  const topPerformers = useMemo(() => {
    return [...vehicleStats]
      .sort((a: any, b: any) => b.mileage - a.mileage)
      .slice(0, 5);
  }, [vehicleStats]);

  const highestExpense = useMemo(() => {
    return [...vehicleStats]
      .sort((a: any, b: any) => b.expense - a.expense)
      .slice(0, 5);
  }, [vehicleStats]);

  return {
    stats,
    weeklyData,
    expenseBreakdown,
    topPerformers,
    highestExpense,
    period,
    setPeriod,
  };
}