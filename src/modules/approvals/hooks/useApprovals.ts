// -----------------------------------------------------------------------------
// APPROVAL CENTER — data + decision actions
// -----------------------------------------------------------------------------
// One queue for everything an owner has to sign off:
//   • Trips            — wizard-complete trips in "Pending" (approve → Completed,
//                        or send back to Draft with a reason)
//   • Maintenance bills— fleet maintenance bills awaiting bill-rate approval
//   • Payments         — payment register rows in Draft (approve / cancel)
//
// The hook only speaks the existing service contracts of each module — no new
// endpoints. In dev previews the payment register uses its writable sample
// rows (same behaviour as Accounts → Payment Register).
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  changeTripStatus,
  listTrips,
} from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { listEligibleTrips } from '../../operations/shop-sales/services/rateEntryApiService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import { kickApprovalSnapshot } from '../services/approvalSnapshot';
import {
  maintenanceApi,
  mapMaintenanceToEvent,
} from '../../fleet-operations/services/maintenanceApi';
import type { MaintenanceEvent } from '../../fleet-operations/types';
import {
  listPayments,
  updatePayment,
} from '../../accounts/services/paymentApiService';
import { createDemoPayments } from '../../accounts/utils/paymentRegisterDemo';
import type { Payment } from '../../accounts/types/payment.types';

export type ApprovalKind = 'trip' | 'maintenance' | 'payment';
export type Decision = 'approved' | 'returned';

export interface ApprovalActivity {
  id: string;
  kind: ApprovalKind;
  /** Human-readable record reference, e.g. TRP-…, MNT-… or Pay-… */
  ref: string;
  decision: Decision;
  by: string;
  at: string;
  reason?: string;
}

const rowsOf = (payload: unknown): unknown[] =>
  Array.isArray(payload) ? payload : ((payload as { data?: unknown[] } | null)?.data ?? []);

const isPendingTrip = (trip: Trip): boolean =>
  trip.status === 'Pending' && !String(trip.tripNo).startsWith('[ORDER]');

const isPendingMaintenance = (record: MaintenanceEvent): boolean =>
  record.paymentStatus !== 'approved' && !record.deletedAt;

const isPendingPayment = (payment: Payment): boolean => payment.status === 'Draft';

export interface UseApprovalsResult {
  trips: Trip[];
  maintenance: MaintenanceEvent[];
  payments: Payment[];
  loading: boolean;
  error: string | null;
  activity: ApprovalActivity[];
  /** True while one or more decisions are being persisted. */
  busy: boolean;
  refresh: () => Promise<void>;
  approveTrip: (trip: Trip, approver: string) => Promise<void>;
  returnTrip: (trip: Trip, approver: string, reason: string) => Promise<void>;
  approveMaintenance: (record: MaintenanceEvent, approver: string) => Promise<void>;
  rejectMaintenance: (record: MaintenanceEvent, reason: string) => Promise<void>;
  approvePayment: (payment: Payment, approver: string) => Promise<void>;
  cancelPayment: (payment: Payment, reason: string) => Promise<void>;
  totals: {
    trips: number;
    rates: number;
    maintenanceCount: number;
    maintenanceValue: number;
    paymentCount: number;
    paymentValue: number;
    cashAwaiting: number;
  };
}

export function useApprovals(): UseApprovalsResult {
  const demoPayments = import.meta.env.DEV;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rateTrips, setRateTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ApprovalActivity[]>([]);
  const [demoRows, setDemoRows] = useState<Payment[]>(() =>
    demoPayments ? createDemoPayments() : []
  );
  const mounted = useRef(true);

  const logActivity = useCallback((item: ApprovalActivity) => {
    setActivity((prev) => [item, ...prev].slice(0, 25));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripPayload, maintenancePayload, ratePayload, realPayments] = await Promise.all([
        listTrips(),
        maintenanceApi.list({ status: 'Pending', limit: 500 }),
        listEligibleTrips().catch(() => []),
        demoPayments ? Promise.resolve([]) : listPayments(),
      ]);
      if (!mounted.current) return;
      setTrips(tripPayload.filter(isPendingTrip));
      setRateTrips(ratePayload);
      setMaintenance(
        rowsOf(maintenancePayload).map((row) => mapMaintenanceToEvent(row)).filter(isPendingMaintenance)
      );
      if (!demoPayments) {
        setPayments(realPayments.filter(isPendingPayment));
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to load approval queues.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [demoPayments]);

  // Demo payments are derived from the writable in-memory sample set.
  const pendingDemoPayments = useMemo(
    () => (demoPayments ? demoRows.filter(isPendingPayment) : []),
    [demoPayments, demoRows]
  );
  const visiblePayments = demoPayments ? pendingDemoPayments : payments;

  useEffect(() => {
    mounted.current = true;
    // Async fetch — setState runs after the awaited response, the standard
    // data-loading idiom used by every other list page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      // Keep header bell / sidebar badge counts in sync app-wide.
      void kickApprovalSnapshot();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  // ── Trips ────────────────────────────────────────────────────────────────
  const approveTrip = useCallback(
    async (trip: Trip, approver: string) => {
      await runAction(async () => {
        const updated = await changeTripStatus(trip.id, 'Completed', approver);
        if (!mounted.current) return;
        setTrips((prev) => prev.filter((row) => row.id !== trip.id));
        logActivity({
          id: `trip-${trip.id}-${Date.now()}`,
          kind: 'trip',
          ref: updated.tripNo || trip.tripNo,
          decision: 'approved',
          by: approver,
          at: new Date().toISOString(),
        });
      });
    },
    [logActivity, runAction]
  );

  const returnTrip = useCallback(
    async (trip: Trip, approver: string, reason: string) => {
      await runAction(async () => {
        await changeTripStatus(trip.id, 'Draft', approver, reason);
        if (!mounted.current) return;
        setTrips((prev) => prev.filter((row) => row.id !== trip.id));
        logActivity({
          id: `trip-${trip.id}-${Date.now()}`,
          kind: 'trip',
          ref: trip.tripNo,
          decision: 'returned',
          by: approver,
          at: new Date().toISOString(),
          reason,
        });
      });
    },
    [logActivity, runAction]
  );

  // ── Maintenance bills ────────────────────────────────────────────────────
  const approveMaintenance = useCallback(
    async (record: MaintenanceEvent, approver: string) => {
      await runAction(async () => {
        await maintenanceApi.approve(record.id ?? '', approver);
        if (!mounted.current) return;
        setMaintenance((prev) => prev.filter((row) => row.id !== record.id));
        logActivity({
          id: `mnt-${record.id}-${Date.now()}`,
          kind: 'maintenance',
          ref: record.billNumber || `MNT #${record.id}`,
          decision: 'approved',
          by: approver,
          at: new Date().toISOString(),
        });
      });
    },
    [logActivity, runAction]
  );

  const rejectMaintenance = useCallback(
    async (record: MaintenanceEvent, reason: string) => {
      await runAction(async () => {
        // Existing module contract: a rejected bill is a soft-deleted bill and
        // shows up on the Maintenance Entry → Deleted view with its reason.
        await maintenanceApi.remove(record.id ?? '', reason);
        if (!mounted.current) return;
        setMaintenance((prev) => prev.filter((row) => row.id !== record.id));
        logActivity({
          id: `mnt-${record.id}-${Date.now()}`,
          kind: 'maintenance',
          ref: record.billNumber || `MNT #${record.id}`,
          decision: 'returned',
          by: 'Approval Center',
          at: new Date().toISOString(),
          reason,
        });
      });
    },
    [logActivity, runAction]
  );

  // ── Payments ─────────────────────────────────────────────────────────────
  const approvePayment = useCallback(
    async (payment: Payment, approver: string) => {
      await runAction(async () => {
        if (demoPayments) {
          const now = new Date().toISOString();
          setDemoRows((prev) =>
            prev.map((row) =>
              row.id === payment.id ? { ...row, status: 'Approved' as const, updatedAt: now } : row
            )
          );
        } else {
          await updatePayment(payment.id, { status: 'Approved' });
          setPayments((prev) => prev.filter((row) => row.id !== payment.id));
        }
        logActivity({
          id: `pay-${payment.id}-${Date.now()}`,
          kind: 'payment',
          ref: payment.paymentNo,
          decision: 'approved',
          by: approver,
          at: new Date().toISOString(),
        });
      });
    },
    [demoPayments, logActivity, runAction]
  );

  const cancelPayment = useCallback(
    async (payment: Payment, reason: string) => {
      await runAction(async () => {
        if (demoPayments) {
          const now = new Date().toISOString();
          setDemoRows((prev) =>
            prev.map((row) =>
              row.id === payment.id
                ? { ...row, status: 'Cancelled' as const, remarks: reason, updatedAt: now }
                : row
            )
          );
        } else {
          await updatePayment(payment.id, { status: 'Cancelled', remarks: reason });
          setPayments((prev) => prev.filter((row) => row.id !== payment.id));
        }
        logActivity({
          id: `pay-${payment.id}-${Date.now()}`,
          kind: 'payment',
          ref: payment.paymentNo,
          decision: 'returned',
          by: 'Approval Center',
          at: new Date().toISOString(),
          reason,
        });
      });
    },
    [demoPayments, logActivity, runAction]
  );

  // ── KPI totals ───────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const maintenanceValue = maintenance.reduce((sum, row) => sum + (Number(row.totalCost) || 0), 0);
    const paymentValue = visiblePayments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return {
      trips: trips.length,
      rates: rateTrips.length,
      maintenanceCount: maintenance.length,
      maintenanceValue,
      paymentCount: visiblePayments.length,
      paymentValue,
      cashAwaiting: maintenanceValue + paymentValue,
    };
  }, [maintenance, visiblePayments, trips, rateTrips]);

  return {
    trips,
    rateTrips,
    maintenance,
    payments: visiblePayments,
    loading,
    error,
    activity,
    busy,
    refresh,
    approveTrip,
    returnTrip,
    approveMaintenance,
    rejectMaintenance,
    approvePayment,
    cancelPayment,
    totals,
  };
}
