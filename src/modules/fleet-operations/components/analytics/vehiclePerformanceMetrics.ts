// src/modules/fleet-operations/components/analytics/vehiclePerformanceMetrics.ts
// -----------------------------------------------------------------------------
// Metric definitions for the Vehicle Performance chart live here — NOT in the
// component file — so the page can render the metric switch on the card
// heading without breaking react-refresh's "components only" rule.
// -----------------------------------------------------------------------------
import type { AnalyticsVehicleStat } from '../../types/analytics';
import { formatNumberCompact } from '../../utils/formatters';

export type VehicleMetricKey = 'distance' | 'trips' | 'fuel' | 'mileage' | 'costPerKm';

export interface MetricDef {
  key: VehicleMetricKey;
  label: string;
  unit: string;
  color: string;
  pick: (row: AnalyticsVehicleStat) => number;
  format: (value: number) => string;
}

export const METRICS: MetricDef[] = [
  {
    key: 'distance',
    label: 'Distance',
    unit: 'km',
    color: '#2563eb',
    pick: (row) => row.distance,
    format: (value) => `${formatNumberCompact(value)} km`,
  },
  {
    key: 'trips',
    label: 'Trips',
    unit: 'trips',
    color: '#6366f1',
    pick: (row) => row.trips,
    format: (value) => `${formatNumberCompact(value)} trips`,
  },
  {
    key: 'fuel',
    label: 'Fuel',
    unit: 'L',
    color: '#f59e0b',
    pick: (row) => row.fuelLitres,
    format: (value) => `${formatNumberCompact(value)} L`,
  },
  {
    key: 'mileage',
    label: 'Mileage',
    unit: 'km/l',
    color: '#10b981',
    pick: (row) => row.mileage,
    format: (value) => `${value.toFixed(2)} km/l`,
  },
  {
    key: 'costPerKm',
    label: 'Cost/KM',
    unit: '₹',
    color: '#f43f5e',
    pick: (row) => (row.distance > 0 ? row.totalExpense / row.distance : 0),
    format: (value) => `₹${value.toFixed(2)}/km`,
  },
];
