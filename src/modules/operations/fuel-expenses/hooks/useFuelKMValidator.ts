// modules/fleet-operations/hooks/useFuelKMValidator.ts
import { useEffect, useMemo, useState } from 'react';
import { useFuelExpenses } from './useFuelExpenses';
import type { FuelExpense } from '../types/fuelExpense';
import { apiGet } from '../../../../api';

interface FuelKMValidator {
  /** The vehicle's latest accepted meter reading across Trips, Fuel, AND
   * Maintenance (backend/src/utils/vehicleMeterLedger.ts) — or null if none
   * exists yet. Advisory only: the backend re-validates and is the real gate. */
  latestApprovedKM: number | null;
  /** True if there is at least one pending fuel bill for the vehicle */
  hasPendingFuel: boolean;
  /**
   * Validates if a given KM is >= the vehicle's latest recorded reading.
   * Returns { valid: boolean; message?: string }
   */
  validateKM: (km: number) => { valid: boolean; message?: string };
  /** Returns a warning message if there is a pending fuel bill, else null */
  getPendingWarning: () => string | null;
}

/**
 * Hook to validate KM inputs against the vehicle's universal latest meter
 * reading (Trips + Fuel + Maintenance) and to warn about pending fuel bills.
 * @param vehicleId - The vehicle's numeric id (masters.vehicles.id)
 * @param vehicleNumber - The vehicle number, only used for display copy
 */
export function useFuelKMValidator(vehicleId: number | null | undefined, vehicleNumber: string): FuelKMValidator {
  // Dummy notification function – the hook doesn't need to show notifications itself
  const dummyNotify = () => {};
  const { filteredData: fuelExpenses } = useFuelExpenses(dummyNotify);

  const [latestApprovedKM, setLatestApprovedKM] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!vehicleId) {
      setLatestApprovedKM(null);
      return;
    }
    apiGet<{ meter: number } | null>(`/fleet/vehicles/${vehicleId}/latest-meter`)
      .then((res) => {
        if (!cancelled) setLatestApprovedKM(res.data?.meter ?? null);
      })
      .catch(() => {
        if (!cancelled) setLatestApprovedKM(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  // Filter expenses for this vehicle
  const vehicleExpenses = useMemo(
    () => (fuelExpenses || []).filter((e: FuelExpense) => e.vehicleNo === vehicleNumber),
    [fuelExpenses, vehicleNumber]
  );

  // Check for pending bills
  const hasPendingFuel = useMemo(() => {
    return vehicleExpenses.some((e: FuelExpense) => e.status === 'Pending Approval' || e.status === 'Draft');
  }, [vehicleExpenses]);

  // Validation function
  const validateKM = (km: number): { valid: boolean; message?: string } => {
    if (latestApprovedKM === null) {
      return { valid: true }; // No reference KM – any value is acceptable
    }
    if (km < latestApprovedKM) {
      return {
        valid: false,
        message: `Meter reading cannot be less than the vehicle's latest recorded reading of ${latestApprovedKM.toLocaleString()} KM.`,
      };
    }
    return { valid: true };
  };

  // Warning message for pending fuel
  const getPendingWarning = (): string | null => {
    if (hasPendingFuel) {
      return `There is a pending fuel bill for ${vehicleNumber}. Please approve it before recording a new trip or maintenance.`;
    }
    return null;
  };

  return {
    latestApprovedKM,
    hasPendingFuel,
    validateKM,
    getPendingWarning,
  };
}