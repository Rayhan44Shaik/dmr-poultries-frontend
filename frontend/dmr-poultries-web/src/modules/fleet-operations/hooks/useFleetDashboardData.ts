import { useMemo } from 'react';
import { startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';
import type { FleetDashboardStats } from '../types';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import useTrips from '../../operations/vehicle-trips/hooks/useTrips';
import { getMaintenance, getDocuments, getFastags, getEMIRecords } from '../services/storage';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  currentKM: number;
  maintenanceType: string;
  serviceType: string;
  garage?: string;
  mechanic?: string;
  nextServiceKM: number;
  totalCost: number;
  parts: any[];
  remarks?: string;
}

const dummyNotify = () => {};

export function useFleetDashboardData(): FleetDashboardStats {
  const { vehicles } = useVehicles();
  const tripsData = useTrips(dummyNotify);
  const allTrips = tripsData?.allTrips || [];
  
  const maintenance = useMemo(() => {
    const raw = getMaintenance() as any[];
    return raw.map((item: any) => ({
      ...item,
      nextServiceKM: item.nextServiceKM ?? 0,
    })) as MaintenanceRecord[];
  }, []);
  
  const documents = useMemo(() => getDocuments(), []);
  const fastags = useMemo(() => getFastags(), []);
  const emiRecords = useMemo(() => getEMIRecords(), []);

  return useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter((v: any) => v.status === 'Active').length;
    const underMaintenance = vehicles.filter((v: any) => v.status === 'Maintenance').length;

    const thisMonthTrips = allTrips.filter((t: any) => 
      t.tripDate && isWithinInterval(new Date(t.tripDate), { start: monthStart, end: monthEnd })
    );
    const fuelCostThisMonth = thisMonthTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
    const totalKMThisMonth = thisMonthTrips.reduce((sum: number, t: any) => sum + (t.totalKm || 0), 0);

    const now2 = new Date();
    const thirtyDaysLater = new Date(now2.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringDocs = documents.filter((d: any) => 
      d.expiryDate && isWithinInterval(new Date(d.expiryDate), { start: now2, end: thirtyDaysLater })
    );
    const insuranceExpiring = expiringDocs.filter((d: any) => d.type === 'insurance').length;
    const fitnessExpiring = expiringDocs.filter((d: any) => d.type === 'fitness').length;
    const permitExpiring = expiringDocs.filter((d: any) => d.type === 'permit').length;
    const fastagLowBalance = fastags.filter((f: any) => f.status === 'low' || f.status === 'critical').length;

    const serviceDue = vehicles.filter((v: any) => {
      const lastMaint = maintenance
        .filter((m: MaintenanceRecord) => m.vehicleId === v.id)
        .sort((a: MaintenanceRecord, b: MaintenanceRecord) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
      const nextServiceKM = lastMaint?.nextServiceKM ?? 0;
      const currentKM = v.currentKM ?? 0;
      return lastMaint && nextServiceKM > 0 && nextServiceKM <= currentKM;
    }).length;

    const monthlyFuel: Record<string, number> = {};
    allTrips.forEach((t: any) => {
      if (t.tripDate && t.expense) {
        const d = new Date(t.tripDate);
        const key = format(d, 'yyyy-MM');
        monthlyFuel[key] = (monthlyFuel[key] || 0) + t.expense;
      }
    });
    const monthlyFuelTrend = Object.entries(monthlyFuel)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, fuel]) => ({ month, fuel }));

    const statusCounts = {
      'In Operation': vehicles.filter((v: any) => v.status === 'Active').length,
      'Maintenance': vehicles.filter((v: any) => v.status === 'Maintenance').length,
      'Not Operational': vehicles.filter((v: any) => v.status !== 'Active' && v.status !== 'Maintenance').length,
    };
    const vehicleStatusDonut = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    const maintCosts: Record<string, number> = {};
    maintenance
      .filter((m: MaintenanceRecord) => 
        isWithinInterval(new Date(m.date), { start: monthStart, end: monthEnd })
      )
      .forEach((m: MaintenanceRecord) => {
        maintCosts[m.vehicleId] = (maintCosts[m.vehicleId] || 0) + m.totalCost;
      });
    const topMaintenanceCost = Object.entries(maintCosts)
      .map(([vehicleId, cost]) => {
        const vehicle = vehicles.find((v: any) => v.id === vehicleId);
        return { vehicle: vehicle?.vehicleNumber || vehicleId, cost };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    const todayTrips = allTrips.filter((t: any) => 
      t.tripDate && isWithinInterval(new Date(t.tripDate), { start: todayStart, end: now })
    );
    const kmToday = todayTrips.reduce((sum: number, t: any) => sum + (t.totalKm || 0), 0);
    const fuelToday = todayTrips.reduce((sum: number, t: any) => sum + (t.fuel || 0), 0);
    const tollToday = 0;
    const documentsExpiring = expiringDocs.length;

    const totalKM = allTrips.reduce((sum: number, t: any) => sum + (t.totalKm || 0), 0);
    const totalFuel = allTrips.reduce((sum: number, t: any) => sum + (t.fuel || 0), 0);
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
      tollToday,
      documentsExpiring,
      avgFuelEfficiency,
    };
  }, [vehicles, allTrips, maintenance, documents, fastags, emiRecords]);
}