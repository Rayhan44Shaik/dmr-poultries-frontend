import { useMemo, useState } from 'react';
import { addDays, isBefore, isAfter } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { getDocuments } from '../services/storage';
import { DocumentTypeEnum } from '../types';

export function useDocumentsData() {
  const { vehicles } = useVehicles();
  const documents = useMemo(() => getDocuments(), []);
  const [filterType, setFilterType] = useState<string>('all');

  const now = new Date();
  const thirtyDaysLater = addDays(now, 30);
  const sixtyDaysLater = addDays(now, 60);

  // Expiring counts by document type
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

  // Document matrix: one row per vehicle, columns for each document type
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

  // Get status color based on expiry date
  const getStatusColor = (expiryDate?: string): string => {
    if (!expiryDate) return 'text-gray-400';
    const d = new Date(expiryDate);
    if (isBefore(d, now)) return 'bg-red-100 text-red-800';
    if (isBefore(d, thirtyDaysLater)) return 'bg-amber-100 text-amber-800';
    if (isBefore(d, sixtyDaysLater)) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return {
    documents,
    expiringCounts,
    matrix,
    filterType,
    setFilterType,
    getStatusColor,
  };
}