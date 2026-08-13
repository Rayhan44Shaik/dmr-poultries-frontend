import { useMemo, useState, useCallback, useEffect } from 'react';
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useFuelExpenses } from '../../operations/fuel-expenses/hooks/useFuelExpenses';
import { maintenanceApi, mapMaintenanceToEvent } from '../services/maintenanceApi';
import type { MaintenanceEvent } from '../types';

interface UpcomingService {
  vehicle: any;
  lastMaint: MaintenanceEvent | null;
  nextKM: number;
  dueKM: number;
  isDue: boolean;
  liveCurrentKM: number;
}

export function useMaintenanceData() {
  const { vehicles } = useVehicles();
  const dummyNotify = () => {};
  const { filteredData: fuelExpenses } = useFuelExpenses(dummyNotify);

  const [refreshKey, setRefreshKey] = useState(0);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Active + soft-deleted maintenance come from the backend (PostgreSQL).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [activeData, allData] = await Promise.all([
          maintenanceApi.list(),
          maintenanceApi.list({ includeDeleted: true }),
        ]);
        if (cancelled) return;
        const activeList = Array.isArray(activeData) ? activeData : (activeData?.data ?? []);
        const allList = Array.isArray(allData) ? allData : (allData?.data ?? []);
        const active: MaintenanceEvent[] = activeList.map(mapMaintenanceToEvent);
        const all: MaintenanceEvent[] = allList.map(mapMaintenanceToEvent);
        setMaintenance(active);
        setDeletedRecords(all.filter((m) => Boolean(m.deletedAt)));
      } catch {
        if (!cancelled) {
          setMaintenance([]);
          setDeletedRecords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');

  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const filtered = useMemo(() => {
    if (!selectedVehicle || selectedVehicle === 'all') return maintenance;
    return maintenance.filter((m: MaintenanceEvent) => {
      const linkedVehicle = vehicles.find(v => String(v.id) === String(m.vehicleId));
      return (
        String(m.vehicleId) === String(selectedVehicle) ||
        (linkedVehicle && linkedVehicle.vehicleNumber === selectedVehicle)
      );
    });
  }, [maintenance, selectedVehicle, vehicles]);

  const stats = useMemo(() => {
    const yearEvents = filtered.filter((m: MaintenanceEvent) =>
      isWithinInterval(new Date(m.date), { start: yearStart, end: yearEnd })
    );
    const total = yearEvents.length;
    const totalCost = yearEvents.reduce((sum: number, m: MaintenanceEvent) => sum + m.totalCost, 0);
    const totalDistance = yearEvents.reduce((sum: number, m: MaintenanceEvent) => sum + m.currentKM, 0);

    const sortedFiltered = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastService = sortedFiltered.length > 0 ? sortedFiltered[0] : null;

    return { total, totalCost, totalDistance, lastService };
  }, [filtered, yearStart, yearEnd]);

  const upcomingServices = useMemo((): UpcomingService[] => {
    return vehicles
      .map((v: any) => {
        const vehicleMaintenances = maintenance.filter((m: MaintenanceEvent) => String(m.vehicleId) === String(v.id));
        const lastMaint = vehicleMaintenances.sort((a: MaintenanceEvent, b: MaintenanceEvent) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0] || null;

        const vehicleFuelLogs = (fuelExpenses || []).filter((f: any) => String(f.vehicleNo) === String(v.vehicleNumber));
        const maxFuelKM = vehicleFuelLogs.reduce((max: number, log: any) => Math.max(max, Number(log.meterReading) || 0), 0);

        const liveCurrentKM = Math.max(Number(v.currentKM) || 0, maxFuelKM, lastMaint?.currentKM || 0);

        const nextKM = lastMaint?.nextServiceKM && lastMaint.nextServiceKM > 0
          ? lastMaint.nextServiceKM
          : liveCurrentKM + 5000;

        const dueKM = nextKM - liveCurrentKM;

        return {
          vehicle: v,
          lastMaint,
          nextKM,
          dueKM,
          isDue: dueKM <= 1000,
          liveCurrentKM
        };
      })
      .sort((a: UpcomingService, b: UpcomingService) => a.dueKM - b.dueKM);
  }, [vehicles, maintenance, fuelExpenses]);

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return {
    vehicles,
    maintenance,
    filtered,
    stats,
    upcomingServices,
    selectedVehicle,
    setSelectedVehicle,
    deletedRecords,
    loading,
    refresh,
  };
}
