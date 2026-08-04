import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  parse,
  format,
  isBefore,
  isAfter,
  differenceInDays,
  addDays,
} from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { Vehicle } from '../../masters/vehicles/types/vehicle';
import { getDocuments, updateDocumentExpiry, setData, FLEET_KEYS } from '../services/storage';
import { DocumentTypeEnum, VehicleDocument } from '../types';
import { DocumentType } from '../utils/constants';

type DocumentTypeKey = 'insurance' | 'fitness' | 'permit' | 'puc' | 'rc';
type Counts = Record<DocumentTypeKey, number>;

interface MatrixRow {
  vehicle: Vehicle;
  docMap: Partial<Record<DocumentTypeKey, VehicleDocument>>;
}

interface StatusCounts {
  [type: string]: {
    expired: number;
    expiring: number;
    safe: number;
  };
}

// Helpers
const parseDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (dateStr: string | undefined): string => {
  const parsed = parseDate(dateStr);
  return parsed ? format(parsed, 'dd-MMM-yyyy') : '—';
};

const getDefaultExpiry = (): string => {
  const date = addDays(new Date(), 120);
  return format(date, 'dd/MM/yyyy');
};

const toDisplayFormat = (dateStr: string): string => {
  if (!dateStr) return '';
  const yyyyMMdd = /^\d{4}-\d{2}-\d{2}$/;
  if (yyyyMMdd.test(dateStr)) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const ddMMyyyy = /^\d{2}\/\d{2}\/\d{4}$/;
  if (ddMMyyyy.test(dateStr)) {
    return dateStr;
  }
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isNaN(parsed.getTime())) {
    return format(parsed, 'dd/MM/yyyy');
  }
  return dateStr;
};

const normaliseDocuments = (docs: VehicleDocument[]): VehicleDocument[] => {
  return docs.map((doc) => {
    if (doc.expiryDate) {
      doc.expiryDate = toDisplayFormat(doc.expiryDate);
    }
    return doc;
  });
};

export function useDocumentsData() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [version, setVersion] = useState(0);
  const { vehicles } = useVehicles();

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const documents = useMemo(() => {
    let docs = getDocuments();
    docs = normaliseDocuments(docs);

    if (vehicles.length > 0) {
      let needsUpdate = false;
      const newDocs = [...docs];
      vehicles.forEach((v) => {
        DocumentTypeEnum.forEach((type) => {
          const exists = newDocs.some(
            (d) => String(d.vehicleId) === String(v.id) && d.type === type
          );
          if (!exists) {
            needsUpdate = true;
            newDocs.push({
              id: `${v.id}-${type}-${Date.now()}-${Math.random()}`,
              vehicleId: String(v.id),
              type: type as DocumentType,
              documentNumber: '',
              expiryDate: getDefaultExpiry(),
              status: 'valid',
            } as VehicleDocument);
          }
        });
      });
      if (needsUpdate) {
        setData(FLEET_KEYS.DOCUMENTS, newDocs);
        docs = normaliseDocuments(newDocs);
      }
    }
    return docs;
  }, [vehicles, refreshKey, version]);

  const [filterType, setFilterType] = useState<string>('all');
  const now = new Date();
  const thirtyDaysLater = addDays(now, 30);
  const sixtyDaysLater = addDays(now, 60);

  const totalCounts = useMemo<Counts>(() => {
    const counts: Counts = { insurance: 0, fitness: 0, permit: 0, puc: 0, rc: 0 };
    documents.forEach((d) => {
      if (d.expiryDate) {
        counts[d.type as DocumentTypeKey] = (counts[d.type as DocumentTypeKey] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);

  const statusCounts = useMemo<StatusCounts>(() => {
    const result: StatusCounts = {};
    const types = ['insurance', 'fitness', 'permit', 'puc', 'rc'] as const;
    types.forEach((type) => {
      result[type] = { expired: 0, expiring: 0, safe: 0 };
    });
    documents.forEach((d) => {
      const key = d.type as DocumentTypeKey;
      if (!result[key]) return;
      const expDate = parseDate(d.expiryDate);
      if (expDate) {
        const days = differenceInDays(expDate, now);
        if (days < 0) result[key].expired += 1;
        else if (days <= 30) result[key].expiring += 1;
        else result[key].safe += 1;
      }
    });
    return result;
  }, [documents, now]);

  const expiringCounts = useMemo<Counts>(() => {
    const counts: Counts = { insurance: 0, fitness: 0, permit: 0, puc: 0, rc: 0 };
    documents.forEach((d) => {
      const expDate = parseDate(d.expiryDate);
      if (expDate) {
        const daysUntil = differenceInDays(expDate, now);
        if (daysUntil > 0 && daysUntil <= 30) {
          const key = d.type as DocumentTypeKey;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    });
    return counts;
  }, [documents, now]);

  const matrix = useMemo<MatrixRow[]>(() => {
    return vehicles.map((vehicle) => {
      const docMap: Partial<Record<DocumentTypeKey, VehicleDocument>> = {};
      DocumentTypeEnum.forEach((type) => {
        const doc = documents.find(
          (d) => String(d.vehicleId) === String(vehicle.id) && d.type === type
        );
        if (doc) {
          docMap[type as DocumentTypeKey] = doc;
        }
      });
      return { vehicle, docMap };
    });
  }, [vehicles, documents]);

  const getStatusColor = (expiryDate?: string): string => {
    if (!expiryDate) return 'text-gray-400';
    const d = parseDate(expiryDate);
    if (!d) return 'text-gray-400';
    if (isBefore(d, now)) return 'bg-red-100 text-red-800';
    if (isBefore(d, thirtyDaysLater)) return 'bg-amber-100 text-amber-800';
    if (isBefore(d, sixtyDaysLater)) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const formatExpiryDate = formatDate;

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const updateDocument = useCallback(
    async (vehicleId: string | number, updates: Record<string, string | null>) => {
      console.log('💾 Updating documents for vehicle', vehicleId, updates);
      for (const [type, dateValue] of Object.entries(updates)) {
        if (dateValue) {
          const formattedDate = toDisplayFormat(dateValue);
          updateDocumentExpiry(vehicleId.toString(), type, formattedDate);
        }
      }
      setVersion((v) => v + 1);
      refetch();
      return { success: true };
    },
    [refetch]
  );

  return {
    documents,
    totalCounts,
    statusCounts,
    expiringCounts,
    matrix,
    filterType,
    setFilterType,
    getStatusColor,
    formatExpiryDate,
    refetch,
    updateDocument,
  };
}