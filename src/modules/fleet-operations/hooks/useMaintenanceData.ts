import { useMemo, useState, useCallback, useEffect } from 'react';
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
  const [approvedMaintenance, setApprovedMaintenance] = useState<MaintenanceEvent[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Active + soft-deleted maintenance come from the backend (PostgreSQL).
  // The Approved tab must show ONLY the latest approved maintenance per vehicle,
  // which the backend computes with DISTINCT ON (status=Approved&latestApproved=true).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [activeData, approvedData, allData] = await Promise.all([
          maintenanceApi.list(),
          maintenanceApi.list({ status: 'Approved', latestApproved: true }),
          maintenanceApi.list({ includeDeleted: true }),
        ]);
        if (cancelled) return;
        const activeList = Array.isArray(activeData) ? activeData : (activeData?.data ?? []);
        const approvedList = Array.isArray(approvedData) ? approvedData : (approvedData?.data ?? []);
        const allList = Array.isArray(allData) ? allData : (allData?.data ?? []);
        const active: MaintenanceEvent[] = activeList.map(mapMaintenanceToEvent);
        const approved: MaintenanceEvent[] = approvedList.map(mapMaintenanceToEvent);
        const all: MaintenanceEvent[] = allList.map(mapMaintenanceToEvent);
        setMaintenance(active);
        setApprovedMaintenance(approved);
        setDeletedRecords(all.filter((m) => Boolean(m.deletedAt)));
      } catch {
        if (!cancelled) {
          setMaintenance([]);
          setApprovedMaintenance([]);
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
  const [selectedMaintenanceType, setSelectedMaintenanceType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Full approved history — the source for the maintenance log timeline.
  const approvedHistory = useMemo(
    () => maintenance.filter((m: MaintenanceEvent) => m.paymentStatus === 'approved'),
    [maintenance]
  );

  // Unique maintenance details/types derived dynamically from the actual approved records.
  const maintenanceTypes = useMemo(() => {
    const set = new Set<string>();
    approvedHistory.forEach((m: MaintenanceEvent) => {
      if (m.serviceType && String(m.serviceType).trim()) set.add(String(m.serviceType).trim());
      if (m.maintenanceType && String(m.maintenanceType).trim()) set.add(String(m.maintenanceType).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [approvedHistory]);

  // Vehicle number lookup by id for search + canonical display.
  const vehicleNumberById = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((v: any) => map.set(String(v.id), String(v.vehicleNumber || '')));
    return map;
  }, [vehicles]);

  const matchesSearch = useCallback((m: MaintenanceEvent, query: string): boolean => {
    if (!query) return true;
    const needle = query.toLowerCase();
    const vehicleNo = vehicleNumberById.get(String(m.vehicleId)) || m.vehicleNo || '';
    return [
      m.billNumber,
      vehicleNo,
      m.serviceType,
      m.maintenanceType,
      m.garage,
      m.mechanic,
      m.driverName,
      m.remarks,
    ].some((value) => value && String(value).toLowerCase().includes(needle));
  }, [vehicleNumberById]);

  // Approved-only history, then vehicle filter → maintenance details filter →
  // search. Pending / Rejected / Deleted records are never part of this dataset.
  const filtered = useMemo(() => {
    return approvedHistory.filter((m: MaintenanceEvent) => {
      if (!matchesSearch(m, searchQuery)) return false;

      if (selectedMaintenanceType && selectedMaintenanceType !== 'all') {
        const typeMatch = selectedMaintenanceType.toLowerCase();
        const service = String(m.serviceType || '').trim().toLowerCase();
        const maint = String(m.maintenanceType || '').trim().toLowerCase();
        if (service !== typeMatch && maint !== typeMatch) return false;
      }

      if (!selectedVehicle || selectedVehicle === 'all') return true;
      const linkedVehicle = vehicles.find(v => String(v.id) === String(m.vehicleId));
      return (
        String(m.vehicleId) === String(selectedVehicle) ||
        (linkedVehicle && linkedVehicle.vehicleNumber === selectedVehicle)
      );
    });
  }, [approvedHistory, selectedVehicle, selectedMaintenanceType, searchQuery, vehicles, matchesSearch]);

  const upcomingServices = useMemo((): UpcomingService[] => {
    // Baselines come strictly from APPROVED maintenance — a pending/rejected/
    // deleted record must never act as the last completed service.
    const list = vehicles
      .map((v: any) => {
        const vehicleMaintenances = approvedHistory.filter((m: MaintenanceEvent) => String(m.vehicleId) === String(v.id));
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

    // Sync the Upcoming Action Schedules with the shared selected vehicle state.
    if (selectedVehicle && selectedVehicle !== 'all') {
      return list.filter((s: UpcomingService) =>
        String(s.vehicle.id) === String(selectedVehicle) ||
        String(s.vehicle.vehicleNumber) === String(selectedVehicle)
      );
    }

    // When the search clearly identifies one or more vehicles, keep the schedule
    // panel synchronized to those vehicles only; otherwise never randomly hide it.
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const matched = list.filter((s: UpcomingService) =>
        String(s.vehicle.vehicleNumber || '').toLowerCase().includes(query)
      );
      if (matched.length > 0) return matched;
    }

    return list;
  }, [vehicles, approvedHistory, fuelExpenses, selectedVehicle, searchQuery]);

  const hasActiveFilters = useMemo(
    () =>
      (selectedVehicle !== 'all' && selectedVehicle !== '' && selectedVehicle !== null) ||
      (selectedMaintenanceType !== 'all' && selectedMaintenanceType !== '' && selectedMaintenanceType !== null) ||
      searchQuery !== '',
    [selectedVehicle, selectedMaintenanceType, searchQuery]
  );

  const resetFilters = useCallback(() => {
    setSelectedVehicle('all');
    setSelectedMaintenanceType('all');
    setSearchQuery('');
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return {
    vehicles,
    maintenance,
    approvedMaintenance,
    approvedHistory,
    maintenanceTypes,
    filtered,
    upcomingServices,
    selectedVehicle,
    setSelectedVehicle,
    selectedMaintenanceType,
    setSelectedMaintenanceType,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,
    resetFilters,
    deletedRecords,
    loading,
    refresh,
  };
}
