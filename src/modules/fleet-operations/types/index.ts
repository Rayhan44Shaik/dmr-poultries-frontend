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

export const MaintenanceEventSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().min(1, 'Vehicle required'),
  date: z.string().datetime(),
  currentKM: z.number().nonnegative(),
  maintenanceType: z.enum(MaintenanceTypeEnum),
  serviceType: z.string().min(1, 'Service type required'),
  garage: z.string().optional(),
  mechanic: z.string().optional(),
  nextServiceKM: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  parts: z.array(PartItemSchema),
  remarks: z.string().optional(),
  createdAt: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
});

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