// src/modules/staff/types/performance.ts
// Read-only Driver / Supervisor performance view models. The backend computes
// every figure inside PostgreSQL from authoritative trip sources. Driver
// maintenance is the expense explicitly attributed to that trip; general
// fleet-ledger maintenance is intentionally not assigned to a person without
// an auditable driver link. These types mirror the endpoint payloads
// exactly so the browser renders what the API returns.

export interface DriverPerformanceKpis {
  drivers: number;
  trips: number;
  distance: number;
  avgDistancePerTrip: number;
  fuelLitres: number;
  fuelCost: number;
  maintenanceCost: number;
  tollCost: number;
  otherCost: number;
  totalCost: number;
  costPerKm: number;
  mileage: number;
}

export interface DriverPerformanceRow {
  driverId: number;
  driverName: string;
  employeeStatus: string;
  trips: number;
  distance: number;
  avgDistancePerTrip: number;
  vehicles: number;
  vehicleNos: string[];
  fuelLitres: number;
  fuelCost: number;
  maintenanceCost: number;
  tollCost: number;
  otherCost: number;
  totalCost: number;
  costPerKm: number;
  mileage: number;
}

export interface DriverVehicleDetail {
  vehicleNo: string;
  trips: number;
  distance: number;
  avgDistancePerTrip: number;
  fuelLitres: number;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
  mileage: number;
}

export interface PerformanceRecentTrip {
  tripNo: string;
  tripDate: string;
  vehicleNo: string;
  totalShops: number;
  totalBirdsDelivered: number;
  totalDeliveredWeight: number;
  totalMortality: number;
  weightLoss: number;
  totalKm: number;
}

export interface DriverPerformanceDetail {
  avgDistancePerTrip: number;
  vehicles: DriverVehicleDetail[];
  recentTrips: PerformanceRecentTrip[];
}

export interface DriverPerformanceResponse {
  fromDate: string;
  toDate: string;
  kpis: DriverPerformanceKpis;
  weekly: { week: string; trips: number; distance: number; fuelLitres: number }[];
  rows: DriverPerformanceRow[];
  detail: DriverPerformanceDetail | null;
}

export interface SupervisorPerformanceKpis {
  supervisors: number;
  trips: number;
  shops: number;
  birds: number;
  weight: number;
  mortality: number;
  mortalityRate: number;
  weightLoss: number;
}

export interface SupervisorPerformanceRow {
  supervisorId: number;
  supervisorName: string;
  employeeStatus: string;
  trips: number;
  shops: number;
  birds: number;
  weight: number;
  mortality: number;
  mortalityRate: number;
  weightLoss: number;
}

export interface SupervisorPerformanceDetail {
  recentTrips: PerformanceRecentTrip[];
}

export interface SupervisorPerformanceResponse {
  fromDate: string;
  toDate: string;
  kpis: SupervisorPerformanceKpis;
  /**
   * Weekly Mon–Sat buckets. `mortality` (birds) and `weightLoss` (kg) are
   * part of the agreed chart contract — the endpoint must aggregate them per
   * week from the same trip sources used for the KPIs.
   */
  weekly: {
    week: string;
    trips: number;
    birds: number;
    weight: number;
    mortality: number;
    weightLoss: number;
  }[];
  rows: SupervisorPerformanceRow[];
  detail: SupervisorPerformanceDetail | null;
}

export type StaffPerformanceKind = 'drivers' | 'supervisors';
