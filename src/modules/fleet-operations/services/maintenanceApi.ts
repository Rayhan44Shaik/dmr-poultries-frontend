// Backend API client for Fleet Maintenance + bill/spare-part documents.
// The maintenance records and the document binaries live in PostgreSQL — this
// layer talks to the backend; binary data is never kept in browser storage.
import apiClient from '../../../api/client';
import { saveAs } from 'file-saver';
import type { MaintenanceDocument, MaintenanceEvent } from '../types';

const BASE = '/fleet/maintenance';

export interface MaintenanceDocumentMetadata {
  id: number;
  maintenanceId: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt?: string | null;
}

export interface MaintenanceListParams {
  vehicleId?: number | string;
  driverId?: number | string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  search?: string;
  includeDeleted?: boolean;
  /** Approved tab: return only the latest approved record per vehicle (backend). */
  latestApproved?: boolean;
  page?: number;
  limit?: number;
}

export interface LatestVehicleMeter {
  vehicleId: number;
  sourceType: 'TRIP_START' | 'TRIP_END' | 'FUEL' | 'MAINTENANCE';
  recordId: string;
  ref: string;
  meter: number;
  eventDate: string;
  eventInstant: string;
  tripStatus?: string;
}

/**
 * Server-generated bill number format, e.g. MNT-20260813-0045.
 *
 * The seeded quarter rows and the entry form both use `MNT-YYYYMMDD-NNNN` — a
 * running 4-digit sequence — so the validator accepts 3 or 4 digits and never
 * rejects a bill number the API actually issues.
 */
export const isServerBillNo = (billNo?: string | null): boolean =>
  /^MNT-\d{8}-\d{3,4}$/.test(billNo ?? '');

type RawMaintenanceRecord = Record<string, unknown>;
type MaintenancePart = MaintenanceEvent['parts'][number];
type MaintenanceDocumentRow = NonNullable<MaintenanceEvent['documents']>[number];

const text = (value: unknown): string => typeof value === 'string' ? value : value == null ? '' : String(value);
const optionalText = (value: unknown): string | undefined => {
  const valueText = text(value).trim();
  return valueText || undefined;
};
const objectValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/**
 * Normalize a backend maintenance timestamp without changing its business-day
 * portion. Backends commonly send a local `YYYY-MM-DDTHH:mm:ss` value; passing
 * that through `toISOString()` would turn midnight in India into the previous
 * UTC day and make an inclusive From/To filter lose a record. Noon UTC is a
 * stable internal representation for this calendar business date.
 */
function maintenanceBusinessTimestamp(value: unknown): string {
  const dateKey = /^(\d{4}-\d{2}-\d{2})/.exec(text(value))?.[1];
  if (dateKey) {
    const calendarDate = new Date(`${dateKey}T12:00:00.000Z`);
    if (!Number.isNaN(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === dateKey) {
      return calendarDate.toISOString();
    }
  }
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function mapParts(value: unknown): MaintenancePart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): MaintenancePart[] => {
    const part = objectValue(raw);
    if (!part) return [];
    return [{
      name: text(part.name),
      specification: text(part.specification),
      quantity: Number(part.quantity) || 0,
      rate: Number(part.rate) || 0,
      amount: Number(part.amount) || 0,
    }];
  });
}

function mapDocuments(value: unknown): MaintenanceDocumentRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): MaintenanceDocumentRow[] => {
    const document = objectValue(raw);
    if (!document) return [];
    const id = Number(document.id);
    if (!Number.isFinite(id)) return [];
    return [{
      id,
      maintenanceId: Number(document.maintenanceId) || undefined,
      fileName: text(document.fileName),
      mimeType: text(document.mimeType),
      fileSize: Number(document.fileSize) || undefined,
      createdAt: optionalText(document.createdAt),
    }];
  });
}

/** Map a backend FleetMaintenance row into the frontend MaintenanceEvent shape. */
export function mapMaintenanceToEvent(value: unknown): MaintenanceEvent {
  const record: RawMaintenanceRecord = objectValue(value) || {};
  const deleted = Boolean(record.deleted || record.deletedAt);
  const normalizedStatus = text(record.paymentStatus || record.status).toLowerCase();
  const rawNextServiceByType = objectValue(record.nextServiceByType);
  const nextServiceByType = (() => {
    if (!rawNextServiceByType) return undefined;
    const map: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawNextServiceByType)) {
      const num = Number(value);
      if (key && Number.isFinite(num) && num > 0) map[key] = num;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  })();

  return {
    id: text(record.id),
    vehicleId: record.vehicleId != null ? text(record.vehicleId) : '',
    vehicleNo: record.vehicleNo != null ? text(record.vehicleNo) : '',
    date: maintenanceBusinessTimestamp(record.date),
    billNumber: text(record.billNo || record.billNumber),
    currentKM: Number(record.currentKM) || 0,
    maintenanceType: text(record.maintenanceType),
    serviceType: text(record.serviceType),
    garage: text(record.garage),
    mechanic: text(record.mechanic),
    driverId: record.driverId != null ? text(record.driverId) : '',
    driverName: text(record.driverName),
    nextServiceKM: Number(record.nextServiceKM) || 0,
    nextServiceByType,
    totalCost: Number(record.totalCost) || 0,
    parts: mapParts(record.parts),
    remarks: text(record.remarks),
    createdAt: optionalText(record.createdAt),
    createdBy: optionalText(record.createdBy),
    updatedAt: optionalText(record.updatedAt),
    approvedBy: optionalText(record.approvedBy),
    approvedAt: optionalText(record.approvedAt),
    paymentStatus: normalizedStatus === 'approved' ? 'approved' : 'pending',
    deletedAt: deleted ? optionalText(record.deletedAt || record.updatedAt) : undefined,
    documents: mapDocuments(record.documents),
  };
}

export const maintenanceApi = {
  /** Universal latest accepted reading (trip, fuel, or maintenance). */
  async latestVehicleMeter(vehicleId: string | number): Promise<LatestVehicleMeter | null> {
    const res = await apiClient.get<LatestVehicleMeter | null>(`/fleet/vehicles/${vehicleId}/latest-meter`);
    return res.data;
  },

  /** GET /fleet/maintenance — history list (array or { data, meta }). */
  async list(params: MaintenanceListParams = {}) {
    const res = await apiClient.get(BASE, { params });
    return res.data;
  },

  /** POST /fleet/maintenance — create with documents (multipart). */
  async create(formData: FormData) {
    const res = await apiClient.post(BASE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
    return res.data;
  },

  /** PUT /fleet/maintenance/:id — update with documents (multipart). */
  async update(id: string | number, formData: FormData) {
    const res = await apiClient.put(`${BASE}/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
    return res.data;
  },

  /** DELETE /fleet/maintenance/:id — soft delete. */
  async remove(id: string | number, reason?: string) {
    const res = await apiClient.delete(`${BASE}/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      data: reason ? { reason } : undefined,
    });
    return res.data;
  },

  /** POST /fleet/maintenance/:id/approve — approve a pending maintenance record
   * (status-only change; documents are never touched). */
  async approve(id: string | number, approvedBy?: string) {
    const res = await apiClient.post(`${BASE}/${id}/approve`, {
      approvedBy: approvedBy || 'system',
    });
    return res.data;
  },

  /** GET /fleet/maintenance/:id/documents — metadata list. */
  async listDocuments(maintenanceId: string | number): Promise<MaintenanceDocument[]> {
    const res = await apiClient.get(`${BASE}/${maintenanceId}/documents`);
    return res.data;
  },

  /** Raw binary URL for <img> / <iframe> / download links. */
  documentUrl(maintenanceId: string | number, documentId: number): string {
    const base = (apiClient.defaults.baseURL || '').replace(/\/+$/, '');
    return `${base}${BASE}/${maintenanceId}/documents/${documentId}`;
  },

  /** DELETE /fleet/maintenance/:id/documents/:documentId — remove one document. */
  async removeDocument(maintenanceId: string | number, documentId: number) {
    const res = await apiClient.delete(`${BASE}/${maintenanceId}/documents/${documentId}`);
    return res.data;
  },

  /** Fetch a document binary and save it locally. */
  async downloadDocument(maintenanceId: string | number, doc: MaintenanceDocument) {
    const res = await apiClient.get(`${BASE}/${maintenanceId}/documents/${doc.id}`, {
      responseType: 'blob',
    });
    saveAs(res.data as Blob, doc.fileName || 'maintenance-document');
  },
};

export default maintenanceApi;
