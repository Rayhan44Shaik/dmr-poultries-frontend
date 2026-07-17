import { MaintenanceTypeEnum, DocumentTypeEnum, FastagStatusEnum, EMIStatusEnum } from '../types';

// Maintenance Types
export const MAINTENANCE_TYPES = [...MaintenanceTypeEnum] as string[];

// Document Types
export const DOCUMENT_TYPES = [...DocumentTypeEnum] as string[];

export const DOCUMENT_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  fitness: 'Fitness',
  permit: 'Permit',
  puc: 'PUC',
  rc: 'RC',
};

// FASTag Statuses
export const FASTAG_STATUSES = [...FastagStatusEnum] as string[];

export const FASTAG_STATUS_LABELS: Record<string, string> = {
  good: 'Good',
  low: 'Low Balance',
  critical: 'Critical',
};

// EMI Statuses
export const EMI_STATUSES = [...EMIStatusEnum] as string[];

export const EMI_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paid: 'Paid',
  overdue: 'Overdue',
};

// Default pagination
export const DEFAULT_PAGE_SIZE = 15;

// Date formats
export const DATE_FORMAT = 'yyyy-MM-dd';
export const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';
export const DATE_TIME_DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm';

// API Keys (localStorage)
export const FLEET_STORAGE_KEYS = {
  MAINTENANCE: 'dmr-vehicle-maintenance',
  DOCUMENTS: 'dmr-vehicle-documents',
  FASTAG: 'dmr-vehicle-fastag',
  FASTAG_TRANSACTIONS: 'dmr-vehicle-fastag-transactions',
  EMI: 'dmr-vehicle-emi',
} as const;