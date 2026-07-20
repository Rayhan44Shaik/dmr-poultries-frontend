import { useMemo, useState, useCallback } from 'react';
import { addDays, isBefore, isAfter } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { getDocuments } from '../services/storage';
import { DocumentTypeEnum } from '../types';

export function useDocumentsData() {
  // --- State for refreshing data ---
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Vehicles from master hook ---
  const { vehicles } = useVehicles();

  // --- Documents: re‑computed when refreshKey changes ---
  const documents = useMemo(() => getDocuments(), [refreshKey]);

  // --- Filter state (preserved) ---
  const [filterType, setFilterType] = useState<string>('all');

  // --- Date helpers ---
  const now = new Date();
  const thirtyDaysLater = addDays(now, 30);
  const sixtyDaysLater = addDays(now, 60);

  // --- Expiring counts ---
  const expiringCounts = useMemo(() => {
    const counts: Record<string, number> = { insurance: 0, fitness: 0, permit: 0, puc: 0, rc: 0 };
    documents.forEach((d: any) => {
      const expDate = new Date(d.expiryDate);
      if (isBefore(expDate, thirtyDaysLater) && isAfter(expDate, now)) {
        counts[d.type] = (counts[d.type] || 0) + 1;
      }
    });
    return counts;
  }, [documents, now, thirtyDaysLater]);

  // --- Document matrix (one row per vehicle) ---
  const matrix = useMemo(() => {
    return vehicles.map((vehicle: any) => {
      const docMap: Record<string, any> = {};
      DocumentTypeEnum.forEach((type) => {
        const doc = documents.find((d: any) => d.vehicleId === vehicle.id && d.type === type);
        docMap[type] = doc;
      });
      return { vehicle, docMap };
    });
  }, [vehicles, documents]);

  // --- Status color helper ---
  const getStatusColor = (expiryDate?: string): string => {
    if (!expiryDate) return 'text-gray-400';
    const d = new Date(expiryDate);
    if (isBefore(d, now)) return 'bg-red-100 text-red-800';
    if (isBefore(d, thirtyDaysLater)) return 'bg-amber-100 text-amber-800';
    if (isBefore(d, sixtyDaysLater)) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  // --- Refetch function (force data refresh) ---
  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // --- Return all values (including filterType and setFilterType) ---
  return {
    documents,
    expiringCounts,
    matrix,
    filterType,       // ✅ defined
    setFilterType,    // ✅ defined
    getStatusColor,
    refetch,          // ✅ new function
  };
}