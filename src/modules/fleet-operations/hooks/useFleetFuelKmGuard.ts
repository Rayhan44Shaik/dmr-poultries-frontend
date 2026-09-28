import { useCallback, useEffect, useState } from 'react';
import { fuelExpenseService } from '../../operations/fuel-expenses/services/fuelExpenseService';
import { maintenanceApi, type LatestVehicleMeter } from '../services/maintenanceApi';

/**
 * KM / pending-fuel checks for Maintenance Entry.
 * Does not fetch until a vehicle is selected, and never loads the full
 * Operations Fuel Expenses page dataset on Fleet first paint.
 */
export function useFleetFuelKmGuard(vehicleId: string, vehicleNumber: string) {
  const [latestMeter, setLatestMeter] = useState<LatestVehicleMeter | null>(null);
  const [hasPendingFuel, setHasPendingFuel] = useState(false);

  useEffect(() => {
    const vehicle = vehicleNumber.trim();
    if (!vehicle || !vehicleId) {
      return;
    }

    let cancelled = false;
    void maintenanceApi
      .latestVehicleMeter(vehicleId)
      .then((meter) => {
        if (cancelled) return;
        setLatestMeter(meter);
      })
      .catch(() => {
        if (!cancelled) setLatestMeter(null);
      });

    void fuelExpenseService
      .list({ vehicleNo: vehicle, page: 1, limit: 50 })
      .then((result) => {
        if (cancelled) return;
        const rows = result.data || [];
        setHasPendingFuel(rows.some((row) => row.status === 'Pending'));
      })
      .catch(() => {
        if (cancelled) return;
        setHasPendingFuel(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId, vehicleNumber]);

  // Clear the public value immediately when selection is cleared, without a
  // synchronous state write inside the effect.
  const selected = Boolean(vehicleId && vehicleNumber.trim());
  const effectiveLatestMeter = selected ? latestMeter : null;
  const effectiveHasPendingFuel = selected && hasPendingFuel;

  const validateKM = useCallback(
    (km: number): { valid: boolean; message?: string } => {
      if (effectiveLatestMeter === null) return { valid: true };
      if (km < effectiveLatestMeter.meter) {
        return {
          valid: false,
          message: `KM cannot be less than the latest recorded reading (${effectiveLatestMeter.meter.toLocaleString()} km, ${effectiveLatestMeter.ref}).`,
        };
      }
      return { valid: true };
    },
    [effectiveLatestMeter]
  );

  const pendingWarning =
    effectiveHasPendingFuel
      ? `There is a pending fuel bill for ${vehicleNumber}. Please approve it before recording a new trip or maintenance.`
      : null;

  return {
    latestMeter: effectiveLatestMeter,
    hasPendingFuel: effectiveHasPendingFuel,
    validateKM,
    pendingWarning,
  };
}
