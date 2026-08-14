import { z } from 'zod';

// ---------- Enums / Static Lists ----------
export const MaintenanceTypeEnum = [
  'Engine Oil Change', 'Oil Filter Replacement', 'Air Filter Replacement',
  'Brake Service', 'Clutch Plate Replacement', 'Gear Oil Change',
  'Coolant Replacement', 'Battery Replacement', 'Suspension Repair',
  'General Service', 'AC Service', 'Electrical Repair', 'Engine Repair',
  'Tyre Rotation', 'Wheel Alignment', 'Wheel Balancing', 'Greasing',
  'Washing', 'Emergency Breakdown Repair', 'Other Maintenance'
] as const;
export type MaintenanceType = typeof MaintenanceTypeEnum[number];

export const DocumentTypeEnum = ['insurance', 'fitness', 'permit', 'puc', 'rc'] as const;
export type DocumentType = typeof DocumentTypeEnum[number];

export const DocumentStatusEnum = ['valid', 'expiring', 'expired'] as const;
export type DocumentStatus = typeof DocumentStatusEnum[number];

/** The five document types tracked by Fleet → Permits (backed by PostgreSQL). */
export const PermitDocumentTypeEnum = ['insurance', 'fitness', 'permit', 'puc', 'rc'] as const;
export type PermitDocumentType = typeof PermitDocumentTypeEnum[number];

export const FastagStatusEnum = ['good', 'low', 'critical'] as const;
export type FastagStatus = typeof FastagStatusEnum[number];

export const EMIStatusEnum = ['active', 'paid', 'overdue'] as const;
export type EMIStatus = typeof EMIStatusEnum[number];

// ---------- Schemas ----------
export const PartItemSchema = z.object({
  name: z.string().min(1, 'Part name required'),
  specification: z.string().optional(),
  quantity: z.number().int().positive(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

/** Bill / spare-part document attached to a maintenance entry (metadata only —
 * binary contents are served by the backend, never stored in the browser). */
export const MaintenanceDocumentSchema = z.object({
  id: z.number(),
  maintenanceId: z.number().optional(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().optional(),
  createdAt: z.string().optional(),
});

export const MaintenanceEventSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().min(1, 'Vehicle required'),
  /** Snapshot of the registered vehicle number taken from the Vehicle Master at
   * save time. Used as a fallback when the master row no longer exists. */
  vehicleNo: z.string().optional(),
  date: z.string().datetime(),
  billNumber: z.string().optional(),
  currentKM: z.number().nonnegative(),
  maintenanceType: z.string().min(1, 'Maintenance type required'),
  serviceType: z.string().min(1, 'Service type required'),
  garage: z.string().optional(),
  mechanic: z.string().optional(),
  nextServiceKM: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  parts: z.array(PartItemSchema),
  remarks: z.string().optional(),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
  updatedAt: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  deletedAt: z.string().datetime().optional(),
  // CHANGED: Replaced 'paid' with 'approved' to match the new UI logic
  paymentStatus: z.enum(['pending', 'approved']).default('pending').optional(),
  // Bill / spare-part documents attached to the maintenance entry (metadata only).
  documents: z.array(MaintenanceDocumentSchema).optional(),
});

/**
 * A vehicle permit / document expiry record from the backend (Fleet → Permits).
 * One current record per (vehicle, doc_type). The scan binary is served by the
 * backend; this DTO only carries metadata.
 */
export interface PermitDocument {
  id: number;
  vehicleId: number;
  vehicleNo: string;
  docType: PermitDocumentType;
  documentNumber: string;
  validFrom: string | null;
  /** YYYY-MM-DD */
  expiryDate: string;
  remarks: string | null;
  hasDocument: boolean;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export const VehicleDocumentSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().min(1),
  type: z.enum(DocumentTypeEnum),
  documentNumber: z.string().min(1),
  expiryDate: z.string().datetime(),
  status: z.enum(DocumentStatusEnum).default('valid'),
  uploadedFile: z.string().optional(),
});

export const FASTagSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().min(1),
  tagNumber: z.string().min(1),
  provider: z.string().min(1),
  balance: z.number().nonnegative(),
  status: z.enum(FastagStatusEnum).default('good'),
});

export const FASTagTransactionSchema = z.object({
  id: z.string().optional(),
  fastagId: z.string().min(1),
  date: z.string().datetime(),
  plaza: z.string().min(1),
  amount: z.number().positive(),
});

export const EMIRecordSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().min(1),
  financeCompany: z.string().min(1),
  loanAmount: z.number().positive(),
  emiAmount: z.number().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  nextEMIDate: z.string().datetime(),
  status: z.enum(EMIStatusEnum).default('active'),
  paidEMIs: z.number().int().min(0).default(0),
  totalEMIs: z.number().int().positive(),
});

// ---------- Types ----------
export type PartItem = z.infer<typeof PartItemSchema>;
export type MaintenanceDocument = z.infer<typeof MaintenanceDocumentSchema>;
export type MaintenanceEvent = z.infer<typeof MaintenanceEventSchema>;
export type VehicleDocument = z.infer<typeof VehicleDocumentSchema>;
export type FASTag = z.infer<typeof FASTagSchema>;
export type FASTagTransaction = z.infer<typeof FASTagTransactionSchema>;
export type EMIRecord = z.infer<typeof EMIRecordSchema>;

// ---------- Dashboard Types ----------
export interface FleetDashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  underMaintenance: number;
  fuelCostThisMonth: number;
  totalKMThisMonth: number;
  serviceDue: number;
  insuranceExpiring: number;
  fitnessExpiring: number;
  permitExpiring: number;
  fastagLowBalance: number;
  monthlyFuelTrend: { month: string; fuel: number }[];
  vehicleStatusDonut: { name: string; value: number }[];
  topMaintenanceCost: { vehicle: string; cost: number }[];
  kmToday: number;
  fuelToday: number;
  tollToday: number;
  documentsExpiring: number;
  avgFuelEfficiency: number;
}