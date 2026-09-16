import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import type { Vehicle } from '../../masters/vehicles/types/vehicle';
import { apiGet } from '../../../api';
import { handleApiError } from '../../../api/errors';
import { maintenanceApi, mapMaintenanceToEvent, type MaintenanceListParams } from '../services/maintenanceApi';
import { fleetCacheInvalidate } from '../services/fleetSessionCache';
import type { MaintenanceEvent } from '../types';

type FleetVehicle = Vehicle & { currentKM?: number };

interface UpcomingService {
  vehicle: FleetVehicle;
  /** The maintenance type this upcoming-service row tracks (each type has its
   * own independent next-service schedule). */
  maintenanceType: string;
  lastMaint: MaintenanceEvent | null;
  nextKM: number;
  dueKM: number;
  isDue: boolean;
  liveCurrentKM: number;
}

const HISTORY_PAGE_SIZE = 200;
type MaintenanceListEnvelope = {
  data?: unknown;
  meta?: { totalPages?: unknown; total?: unknown; limit?: unknown; page?: unknown };
};

const rowsOf = (payload: unknown): Record<string, unknown>[] => {
  const rows = Array.isArray(payload)
    ? payload
    : (payload as MaintenanceListEnvelope | null)?.data;
  return Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    : [];
};

/** History totals must be based on every page, not an arbitrary API cap. */
async function listEveryMaintenancePage(params: MaintenanceListParams = {}) {
  const records: Record<string, unknown>[] = [];
  let page = 1;
  let totalPages: number;
  let expectedTotal: number | null = null;
  do {
    const payload = await maintenanceApi.list({ ...params, page, limit: HISTORY_PAGE_SIZE });
    const meta = !Array.isArray(payload)
      ? (payload as MaintenanceListEnvelope | null)?.meta
      : undefined;
    const reportedPage = Number(meta?.page);
    if (Number.isInteger(reportedPage) && reportedPage > 0 && reportedPage !== page) {
      throw new Error('Maintenance API returned an unexpected page.');
    }
    records.push(...rowsOf(payload));

    const reportedPages = Number(meta?.totalPages);
    const reportedTotal = Number(meta?.total);
    const reportedLimit = Number(meta?.limit) || HISTORY_PAGE_SIZE;
    const pagesFromTotal = Number.isFinite(reportedTotal) && reportedTotal >= 0 && reportedLimit > 0
      ? Math.max(1, Math.ceil(reportedTotal / reportedLimit))
      : 1;
    totalPages = Number.isInteger(reportedPages) && reportedPages > 0 ? reportedPages : pagesFromTotal;
    if (page === 1 && Number.isFinite(reportedTotal) && reportedTotal >= 0) {
      expectedTotal = reportedTotal;
    }
    page += 1;
  } while (page <= totalPages);

  // A retried page must not inflate the list, KPIs, or pagination. Conversely,
  // an advertised total that cannot be reconciled must never masquerade as an
  // exact result for the operator.
  const seen = new Set<string>();
  const uniqueRecords = records.filter((record) => {
    const id = String(record?.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (expectedTotal !== null && uniqueRecords.length !== expectedTotal) {
    throw new Error('Maintenance API returned an incomplete result.');
  }
  return uniqueRecords;
}

/** Compare local calendar keys so an inclusive To Date never loses its final day. */
const maintenanceDateKey = (record: MaintenanceEvent) => String(record.date || '').slice(0, 10);

export function useMaintenanceData(scope: 'entry' | 'history' | 'all' = 'all') {
  const { vehicles } = useVehicles();
  const [refreshKey, setRefreshKey] = useState(0);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [approvedMaintenance, setApprovedMaintenance] = useState<MaintenanceEvent[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<MaintenanceEvent[]>([]);
  const [historyRecords, setHistoryRecords] = useState<MaintenanceEvent[]>([]);
  const [latestMeters, setLatestMeters] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(scope !== 'history');
  const [historyLoading, setHistoryLoading] = useState(scope !== 'entry');
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const historyHasLoaded = useRef(false);

  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [selectedMaintenanceType, setSelectedMaintenanceType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Entry workspace datasets: pending/current, latest approved per vehicle and
  // the deleted audit list. These are intentionally independent of History filters.
  useEffect(() => {
    if (scope === 'history') {
      return;
    }
    let cancelled = false;
    (async () => {
      if (!hasLoaded.current) setLoading(true);
      setError(null);
      try {
        const [activeData, approvedData, allData] = await Promise.all([
          maintenanceApi.list({ limit: 500 }),
          maintenanceApi.list({ status: 'Approved', latestApproved: true, limit: 500 }),
          maintenanceApi.list({ includeDeleted: true, limit: 500 }),
        ]);
        if (cancelled) return;
        const active = rowsOf(activeData).map(mapMaintenanceToEvent);
        const approved = rowsOf(approvedData).map(mapMaintenanceToEvent);
        const all = rowsOf(allData).map(mapMaintenanceToEvent);
        hasLoaded.current = true;
        setMaintenance(active);
        setApprovedMaintenance(approved);
        setDeletedRecords(all.filter((record) => Boolean(record.deletedAt)));
      } catch (cause) {
        if (!cancelled) {
          if (!hasLoaded.current) {
            setMaintenance([]);
            setApprovedMaintenance([]);
            setDeletedRecords([]);
          }
          setError(handleApiError(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, scope]);

  useEffect(() => {
    if (scope !== 'history') return;
    let cancelled = false;
    (async () => {
      try {
        // Full list of approved records (not just latestApproved per vehicle) so the
        // Approved Maintenance Timeline can show every approved maintenance event all
        // the time, not only the most recent one per vehicle.
        const approvedData = await listEveryMaintenancePage({ status: 'Approved' });
        if (!cancelled) setApprovedMaintenance(approvedData.map(mapMaintenanceToEvent));
      } catch {
        if (!cancelled) setApprovedMaintenance([]);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, scope]);

  // Upcoming Service meters are History-only. Entry must not load this dataset.
  useEffect(() => {
    if (scope !== 'history') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiGet<Array<{ vehicleId: number; meter: number }>>('/fleet/vehicles/meter-summary')
        .then((response) => {
          if (cancelled) return;
          const map: Record<string, number> = {};
          (response.data || []).forEach((event) => {
            map[String(event.vehicleId)] = Number(event.meter) || 0;
          });
          setLatestMeters(map);
        })
        .catch(() => { if (!cancelled) setLatestMeters({}); });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshKey, scope]);

  // Maintenance type and free-text search are applied locally because those
  // fields are not part of every deployed API contract. Search therefore feels
  // immediate and cannot be overwritten by a late request for an older phrase.
  useEffect(() => {
    if (scope === 'entry') return;
    let cancelled = false;
    // Hide the previous query's rows while this exact filter set loads.
    // A new API query must replace, rather than coexist with, its previous result.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this synchronizes the active query state.
    setHistoryLoading(true);
    setHistoryError(null);
    (async () => {
      try {
        const records = await listEveryMaintenancePage({
          vehicleId: selectedVehicle === 'all' ? undefined : selectedVehicle,
          driverId: selectedDriver === 'all' ? undefined : selectedDriver,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });
        if (!cancelled) {
          historyHasLoaded.current = true;
          setHistoryRecords(records.map(mapMaintenanceToEvent));
        }
      } catch (cause) {
        if (!cancelled) {
          if (!historyHasLoaded.current) setHistoryRecords([]);
          setHistoryError(handleApiError(cause));
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromDate, refreshKey, scope, selectedDriver, selectedVehicle, toDate]);

  const approvedHistory = useMemo(
    () => {
      const source = approvedMaintenance.length ? approvedMaintenance : maintenance;
      return source.filter((record) => record.paymentStatus === 'approved' && !record.deletedAt);
    },
    [approvedMaintenance, maintenance]
  );

  const maintenanceTypes = useMemo(() => {
    const values = new Set<string>();
    historyRecords.forEach((record) => String(record.maintenanceType || '').split(',').forEach((type) => {
      if (type.trim()) values.add(type.trim());
    }));
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [historyRecords]);

  const drivers = useMemo(() => {
    const map = new Map<string, string>();
    historyRecords.forEach((record) => {
      if (record.driverId && record.driverName) map.set(String(record.driverId), record.driverName);
    });
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [historyRecords]);

  const vehicleNumberById = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((vehicle: FleetVehicle) => map.set(String(vehicle.id), String(vehicle.vehicleNumber || '')));
    return map;
  }, [vehicles]);

  const filtered = useMemo(() => historyRecords.filter((record) => {
    // Guard the visible set as well: older API deployments may ignore a query
    // parameter, but the timeline must still reflect the chosen filters.
    if (selectedVehicle !== 'all' && String(record.vehicleId) !== String(selectedVehicle)) return false;
    if (selectedDriver !== 'all' && String(record.driverId) !== String(selectedDriver)) return false;
    const date = maintenanceDateKey(record);
    if (fromDate && (!date || date < fromDate)) return false;
    if (toDate && (!date || date > toDate)) return false;
    if (record.deletedAt) return false;
    if (selectedMaintenanceType !== 'all') {
      // Multi-select stores choices pipe-separated; a record matches when ANY
      // of its comma-separated types is picked.
      const wanted = selectedMaintenanceType.split('|').map((value) => value.trim()).filter(Boolean);
      const recordTypes = String(record.maintenanceType || '').split(',').map((value) => value.trim());
      if (wanted.length > 0 && !recordTypes.some((type) => wanted.includes(type))) return false;
    }
    if (searchQuery.trim()) {
      const needle = searchQuery.trim().toLowerCase();
      const vehicleNo = vehicleNumberById.get(String(record.vehicleId)) || record.vehicleNo || '';
      const values = [record.billNumber, vehicleNo, record.driverName, record.maintenanceType, record.serviceType, record.garage, record.mechanic, record.remarks];
      if (!values.some((value) => String(value || '').toLowerCase().includes(needle))) return false;
    }
    return true;
  }), [fromDate, historyRecords, searchQuery, selectedDriver, selectedMaintenanceType, selectedVehicle, toDate, vehicleNumberById]);

  const upcomingServices = useMemo((): UpcomingService[] => {
    const list: UpcomingService[] = [];
    vehicles.forEach((vehicle: FleetVehicle) => {
      const vehicleId = String(vehicle.id);
      // Approved records for this vehicle, newest first. Only approved records
      // drive upcoming-service schedules (pending entries are not yet effective).
      const records = approvedHistory
        .filter((record) => String(record.vehicleId) === vehicleId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Authoritative latest chronological meter from the backend ledger. The
      // vehicle master `currentKM` is a soft fallback when no meter event exists.
      const backendMeter = Number(latestMeters[vehicleId] || 0);
      const newestRecord = records[0] || null;
      const liveCurrentKM = Math.max(Number(vehicle.currentKM) || 0, backendMeter, newestRecord?.currentKM || 0);

      // Each maintenance type carries its own next-service KM. Walk newest →
      // oldest so the most recent schedule per type wins.
      const typeSchedules = new Map<string, number>();
      records.forEach((record) => {
        const types = String(record.maintenanceType || '')
          .split(',').map((value) => value.trim()).filter(Boolean);
        types.forEach((type) => {
          if (typeSchedules.has(type)) return;
          const perType = record.nextServiceByType?.[type];
          const value = perType && perType > 0
            ? perType
            : (record.nextServiceKM && record.nextServiceKM > 0 ? record.nextServiceKM : 0);
          if (value > 0) typeSchedules.set(type, value);
        });
      });

      // No per-type schedule available → single generic fallback row (the
      // previous behaviour), so every vehicle still surfaces in the panel.
      if (typeSchedules.size === 0) {
        const nextKM = newestRecord?.nextServiceKM && newestRecord.nextServiceKM > 0
          ? newestRecord.nextServiceKM
          : liveCurrentKM + 5000;
        const fallbackType = String(newestRecord?.maintenanceType || '')
          .split(',')[0]?.trim() || 'General Service';
        list.push({
          vehicle,
          maintenanceType: fallbackType,
          lastMaint: newestRecord,
          nextKM,
          dueKM: nextKM - liveCurrentKM,
          isDue: nextKM - liveCurrentKM <= 1000,
          liveCurrentKM,
        });
        return;
      }

      typeSchedules.forEach((nextKM, type) => {
        const lastMaint = records.find((record) =>
          String(record.maintenanceType || '').split(',').map((value) => value.trim()).includes(type)
        ) || null;
        const dueKM = nextKM - liveCurrentKM;
        list.push({
          vehicle,
          maintenanceType: type,
          lastMaint,
          nextKM,
          dueKM,
          isDue: dueKM <= 1000,
          liveCurrentKM,
        });
      });
    });

    list.sort((a, b) => a.dueKM - b.dueKM);
    return selectedVehicle === 'all' ? list : list.filter((item) => String(item.vehicle.id) === selectedVehicle);
  }, [approvedHistory, latestMeters, selectedVehicle, vehicles]);

  const hasActiveFilters = selectedVehicle !== 'all' || selectedDriver !== 'all' ||
    selectedMaintenanceType !== 'all' ||
    Boolean(fromDate || toDate || searchQuery);

  const resetFilters = useCallback(() => {
    setSelectedVehicle('all'); setSelectedDriver('all'); setSelectedMaintenanceType('all');
    setFromDate(''); setToDate(''); setSearchQuery('');
  }, []);

  const refresh = useCallback(() => {
    fleetCacheInvalidate('analytics:');
    setRefreshKey((value) => value + 1);
  }, []);

  return {
    vehicles, maintenance, approvedMaintenance, approvedHistory, deletedRecords,
    filtered, maintenanceTypes, drivers, upcomingServices,
    selectedVehicle, setSelectedVehicle, selectedDriver, setSelectedDriver,
    selectedMaintenanceType, setSelectedMaintenanceType,
    fromDate, setFromDate, toDate, setToDate,
    searchQuery, setSearchQuery, hasActiveFilters, resetFilters,
    loading, historyLoading, error, historyError, refresh,
  };
}
