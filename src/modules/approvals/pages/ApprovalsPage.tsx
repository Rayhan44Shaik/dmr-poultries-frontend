import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  ReceiptText,
  RefreshCw,
  Undo2,
  Wrench,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../../providers/authContext';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { Button } from '../../../ui/Button';
import { ConfirmDialog } from '../../../ui/ConfirmDialog';
import { EmptyState } from '../../../ui/EmptyState';
import { SearchInput } from '../../../ui/SearchInput';
import { uiBadgeClass } from '../../../shared/ui/uiTokens';
import { useApprovals, type ApprovalActivity } from '../hooks/useApprovals';
import { ApprovalKpiCards } from '../components/ApprovalKpiCards';
import { ApprovalDetailsModal, type ApprovalEntry } from '../components/ApprovalDetailsModal';
import { RejectReasonDialog } from '../components/RejectReasonDialog';
import {
  dateLabel,
  inr,
  inr2,
  kg,
  partsSummary,
  waitingAge,
  waitingToneClass,
} from '../approvalsUtils';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { MaintenanceEvent } from '../../fleet-operations/types';
import type { Payment } from '../../accounts/types/payment.types';

type Tab = 'trips' | 'rates' | 'maintenance' | 'payments';

const TABS: { id: Tab; label: string; icon: typeof Truck }[] = [
  { id: 'trips', label: 'Trip approvals', icon: Truck },
  { id: 'rates', label: 'Rate entries', icon: ReceiptText },
  { id: 'maintenance', label: 'Maintenance bills', icon: Wrench },
  { id: 'payments', label: 'Payments', icon: Banknote },
];

const KIND_LABEL: Record<ApprovalEntry['kind'], string> = {
  trip: 'trip',
  rate: 'rate entry',
  maintenance: 'maintenance bill',
  payment: 'payment',
};

/* ── table primitives ─────────────────────────────────────────────────────── */

function Th({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${alignClass} ${className}`}
    >
      {children}
    </th>
  );
}

function WaitingCell({ iso }: { iso?: string | null }) {
  const age = waitingAge(iso);
  return (
    <td className="whitespace-nowrap px-3 py-2.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${waitingToneClass[age.tone]}`}
        title={`Waiting since ${dateLabel(iso)}`}
      >
        {age.label}
      </span>
    </td>
  );
}

function PendingStatusCell() {
  return (
    <td className="whitespace-nowrap px-3 py-2.5">
      <span className={`inline-flex items-center gap-1 ${uiBadgeClass('warning')}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Pending
      </span>
    </td>
  );
}

/* ── main page ────────────────────────────────────────────────────────────── */

export default function ApprovalsPage() {
  const { showNotification } = useSafeNotification();
  const { user } = useAuth();
  const approver = user?.displayName || 'Owner';

  const {
    trips,
    rateTrips,
    maintenance,
    payments,
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
  } = useApprovals();

  const [tab, setTab] = useState<Tab>('trips');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<ApprovalEntry | null>(null);
  const [approveTargets, setApproveTargets] = useState<ApprovalEntry[]>([]);
  const [returnTargets, setReturnTargets] = useState<ApprovalEntry[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelected(new Set());
    setSearch('');
  };

  /* ── row keys / lookups ───────────────────────────────────────────────── */
  const entryKey = useCallback((entry: ApprovalEntry): string => {
    if (entry.kind === 'trip') return `trip:${entry.trip.id}`;
    if (entry.kind === 'rate') return `rate:${entry.trip.id}`;
    if (entry.kind === 'maintenance') return `mnt:${entry.maintenance.id}`;
    return `pay:${entry.payment.id}`;
  }, []);

  const refOf = useCallback((entry: ApprovalEntry): string => {
    if (entry.kind === 'trip' || entry.kind === 'rate') return entry.trip.tripNo;
    if (entry.kind === 'maintenance') return entry.maintenance.billNumber || `#${entry.maintenance.id}`;
    return entry.payment.paymentNo;
  }, []);

  const rowsByTab = useMemo<ApprovalEntry[]>(() => {
    if (tab === 'trips') return [...trips]
      .sort((a, b) => (a.startStepSubmittedAt || a.tripDate || '').localeCompare(b.startStepSubmittedAt || b.tripDate || ''))
      .map((trip) => ({ kind: 'trip' as const, trip }));
    if (tab === 'rates') return [...rateTrips]
      .sort((a, b) => (a.tripDate || '').localeCompare(b.tripDate || ''))
      .map((trip) => ({ kind: 'rate' as const, trip }));
    if (tab === 'maintenance')
      return [...maintenance]
        .sort((a, b) => (a.createdAt || a.date || '').localeCompare(b.createdAt || b.date || ''))
        .map((record) => ({ kind: 'maintenance' as const, maintenance: record }));
    return [...payments]
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .map((payment) => ({ kind: 'payment' as const, payment }));
  }, [tab, trips, rateTrips, maintenance, payments]);

  const haystack = useCallback((entry: ApprovalEntry): string => {
    if (entry.kind === 'trip' || entry.kind === 'rate') {
      const t = entry.trip;
      return [t.tripNo, t.vehicleNo, t.driverName, t.supervisorName, t.sourceFarm, t.tripDate].join(' ').toLowerCase();
    }
    if (entry.kind === 'maintenance') {
      const m = entry.maintenance;
      return [m.billNumber, m.vehicleNo, m.driverName, m.maintenanceType, m.serviceType, m.garage, m.mechanic]
        .join(' ')
        .toLowerCase();
    }
    const p = entry.payment;
    return [p.paymentNo, p.paymentType, p.paidTo, p.paymentMode, p.referenceNo, p.category].join(' ').toLowerCase();
  }, []);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rowsByTab.filter((entry) => haystack(entry).includes(q)) : rowsByTab;
  }, [rowsByTab, search, haystack]);

  const visibleKeys = useMemo(() => new Set(visibleRows.map(entryKey)), [visibleRows, entryKey]);
  const allSelected = visibleRows.length > 0 && visibleRows.every((entry) => selected.has(entryKey(entry)));

  const toggleRow = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleKeys.forEach((key) => next.delete(key));
      else visibleKeys.forEach((key) => next.add(key));
      return next;
    });

  const selectedEntries = useMemo(
    () => rowsByTab.filter((entry) => selected.has(entryKey(entry))),
    [rowsByTab, selected, entryKey]
  );
  const selectedValue = useMemo(() => {
    return selectedEntries.reduce((sum, entry) => {
      if (entry.kind === 'maintenance') return sum + (Number(entry.maintenance.totalCost) || 0);
      if (entry.kind === 'payment') return sum + (Number(entry.payment.amount) || 0);
      return sum;
    }, 0);
  }, [selectedEntries]);

  /* ── decisions ────────────────────────────────────────────────────────── */
  const runDecision = useCallback(
    async (entries: ApprovalEntry[], mode: 'approve' | 'return', reason?: string) => {
      setActionBusy(true);
      let ok = 0;
      const failures: string[] = [];
      for (const entry of entries) {
        try {
          // Rate entries are completed on the Rate Entry page (deep-linked),
          // not approved/rejected from this queue.
          if (entry.kind === 'rate') continue;
          if (mode === 'approve') {
            if (entry.kind === 'trip') await approveTrip(entry.trip, approver);
            else if (entry.kind === 'maintenance') await approveMaintenance(entry.maintenance, approver);
            else if (entry.kind === 'payment') await approvePayment(entry.payment, approver);
          } else {
            if (entry.kind === 'trip') await returnTrip(entry.trip, approver, reason || '');
            else if (entry.kind === 'maintenance') await rejectMaintenance(entry.maintenance, reason || '');
            else if (entry.kind === 'payment') await cancelPayment(entry.payment, reason || '');
          }
          ok += 1;
        } catch {
          failures.push(refOf(entry));
        }
      }
      setActionBusy(false);
      const noun = KIND_LABEL[entries[0]?.kind ?? 'trip'];
      if (ok > 0) {
        showNotification(
          mode === 'approve'
            ? `${ok} ${noun}${ok === 1 ? '' : 's'} approved.`
            : `${ok} ${noun}${ok === 1 ? '' : 's'} sent back.`,
          'success'
        );
      }
      if (failures.length > 0) {
        showNotification(`Could not update ${failures.length} item(s): ${failures.slice(0, 4).join(', ')}`, 'error');
      }
      setSelected(new Set());
      await refresh();
    },
    [
      approver,
      approveMaintenance,
      approvePayment,
      approveTrip,
      cancelPayment,
      refOf,
      refresh,
      rejectMaintenance,
      returnTrip,
      showNotification,
    ]
  );

  const openDetailsApprove = () => {
    if (details) {
      const entry = details;
      setDetails(null);
      setApproveTargets([entry]);
    }
  };
  const openDetailsReturn = () => {
    if (details) {
      const entry = details;
      setDetails(null);
      setReturnTargets([entry]);
    }
  };

  const approveDialog = useMemo(() => {
    const kind = approveTargets[0]?.kind;
    if (!kind) return null;
    const noun = KIND_LABEL[kind];
    const value = approveTargets.reduce((sum, entry) => {
      if (entry.kind === 'maintenance') return sum + (Number(entry.maintenance.totalCost) || 0);
      if (entry.kind === 'payment') return sum + (Number(entry.payment.amount) || 0);
      return sum;
    }, 0);
    return {
      title: `Approve ${approveTargets.length === 1 ? noun : `${approveTargets.length} ${noun}s`}?`,
      message:
        kind === 'trip'
          ? 'The trip is marked Completed and becomes eligible for accounts & farm payments.'
          : kind === 'maintenance'
            ? 'Bill rates are accepted and the record moves to the approved maintenance history.'
            : 'The payment is approved and becomes available for disbursement in the payment register.',
      value: value > 0 ? inr.format(value) : null,
    };
  }, [approveTargets]);

  const returnDialog = useMemo(() => {
    const kind = returnTargets[0]?.kind;
    if (!kind) return null;
    if (kind === 'trip')
      return {
        title: 'Send trip back to draft?',
        confirmLabel: 'Send back to Draft',
        helper: 'The trip returns to the Trip Entry wizard as a Draft and your reason is recorded on it.',
      };
    if (kind === 'maintenance')
      return {
        title: 'Reject maintenance bill?',
        confirmLabel: 'Reject bill',
        helper: 'The bill is soft-deleted and appears under Maintenance Entry → Deleted with this reason.',
      };
    return {
      title: 'Cancel payment request?',
      confirmLabel: 'Cancel payment',
      helper: 'The payment moves to Cancelled and can no longer be disbursed. The reason is recorded.',
    };
  }, [returnTargets]);

  /* ── shared row actions ───────────────────────────────────────────────── */
  const RowActions = ({ entry }: { entry: ApprovalEntry }) => (
    <td className="whitespace-nowrap px-3 py-2 text-right">
      <div className="inline-flex items-center gap-1">
        <Button
          size="xs"
          variant="outline"
          iconOnly
          aria-label={`View ${refOf(entry)} details`}
          title="View details"
          onClick={() => setDetails(entry)}
        >
          <Eye size={14} />
        </Button>
        <Button
          size="xs"
          variant="success"
          iconOnly
          aria-label={`Approve ${refOf(entry)}`}
          title="Approve"
          disabled={busy || actionBusy}
          onClick={() => setApproveTargets([entry])}
        >
          <Check size={14} />
        </Button>
        <Button
          size="xs"
          variant="destructiveOutline"
          iconOnly
          aria-label={`Send back ${refOf(entry)}`}
          title={entry.kind === 'maintenance' ? 'Reject bill' : entry.kind === 'payment' ? 'Cancel payment' : 'Send back to draft'}
          disabled={busy || actionBusy}
          onClick={() => setReturnTargets([entry])}
        >
          <Undo2 size={14} />
        </Button>
      </div>
    </td>
  );

  /* ── trip table ───────────────────────────────────────────────────────── */
  const renderTrips = () => (
    <table className="w-full min-w-[1080px] border-collapse text-sm">
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          <Th align="center" className="w-10">
            <input
              type="checkbox"
              aria-label="Select all trips"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
          </Th>
          <Th>Trip</Th>
          <Th>Vehicle / Driver</Th>
          <Th>Supervisor</Th>
          <Th>Source farm</Th>
          <Th align="center">Shops</Th>
          <Th align="right">Birds</Th>
          <Th align="right">DC weight</Th>
          <Th>Waiting</Th>
          <Th>Status</Th>
          <Th align="right">Decision</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {visibleRows.map((entry) => {
          if (entry.kind !== 'trip') return null;
          const t: Trip = entry.trip;
          return (
            <tr key={entryKey(entry)} className="bg-white transition-colors hover:bg-amber-50/40">
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  aria-label={`Select ${t.tripNo}`}
                  checked={selected.has(entryKey(entry))}
                  onChange={() => toggleRow(entryKey(entry))}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                />
              </td>
              <td className="px-3 py-2.5">
                <p className="font-bold text-slate-800">{t.tripNo}</p>
                <p className="text-xs text-slate-400">{dateLabel(t.tripDate)}</p>
              </td>
              <td className="px-3 py-2.5">
                <p className="font-semibold text-slate-700">{t.vehicleNo || '—'}</p>
                <p className="text-xs text-slate-400">{t.driverName || '—'}</p>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{t.supervisorName || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{t.sourceFarm || '—'}</td>
              <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">{t.totalShops}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-700">{kg.format(t.totalBirds)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{kg.format(t.dcWeight)} kg</td>
              <WaitingCell iso={t.startStepSubmittedAt || t.createdAt || t.tripDate} />
              <PendingStatusCell />
              <RowActions entry={entry} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  /* ── rate entries table ───────────────────────────────────────────────── */
  const renderRates = () => (
    <table className="w-full min-w-[1080px] border-collapse text-sm">
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          <Th>Trip</Th>
          <Th>Vehicle / Driver</Th>
          <Th>Supervisor</Th>
          <Th>Source farm</Th>
          <Th align="center">Shops</Th>
          <Th align="right">Birds</Th>
          <Th align="right">Delivered weight</Th>
          <Th>Completed</Th>
          <Th>Status</Th>
          <Th align="right">Action</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {visibleRows.map((entry) => {
          if (entry.kind !== 'rate') return null;
          const t = entry.trip;
          return (
            <tr key={entryKey(entry)} className="bg-white transition-colors hover:bg-cyan-50/40">
              <td className="px-3 py-2.5">
                <p className="font-bold text-slate-800">{t.tripNo}</p>
                <p className="text-xs text-slate-400">{dateLabel(t.tripDate)}</p>
              </td>
              <td className="px-3 py-2.5">
                <p className="font-semibold text-slate-700">{t.vehicleNo || '—'}</p>
                <p className="text-xs text-slate-400">{t.driverName || '—'}</p>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{t.supervisorName || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{t.sourceFarm || '—'}</td>
              <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">{t.totalShops}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-700">{kg.format(t.totalBirds)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{kg.format(t.totalDeliveredWeight || t.totalWeight)} kg</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{dateLabel(t.tripDate)}</td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <span className={`inline-flex items-center gap-1 ${uiBadgeClass('info')}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
                  Rates due
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <div className="inline-flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    iconOnly
                    aria-label={`View ${t.tripNo} details`}
                    title="View details"
                    onClick={() => setDetails(entry)}
                  >
                    <Eye size={14} />
                  </Button>
                  <Link
                    to="/operations?tab=rate-entry"
                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-cyan-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-700"
                  >
                    <ReceiptText size={13} />
                    Enter rates
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  /* ── maintenance table ────────────────────────────────────────────────── */
  const renderMaintenance = () => (
    <table className="w-full min-w-[1180px] border-collapse text-sm">
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          <Th align="center" className="w-10">
            <input
              type="checkbox"
              aria-label="Select all bills"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
          </Th>
          <Th>Bill no</Th>
          <Th>Vehicle / Driver</Th>
          <Th>Maintenance work</Th>
          <Th>Garage</Th>
          <Th align="right">Odo KM</Th>
          <Th>Bill rate (top line)</Th>
          <Th align="right">Bill amount</Th>
          <Th>Waiting</Th>
          <Th>Status</Th>
          <Th align="right">Decision</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {visibleRows.map((entry) => {
          if (entry.kind !== 'maintenance') return null;
          const m: MaintenanceEvent = entry.maintenance;
          const rates = partsSummary(m);
          return (
            <tr key={entryKey(entry)} className="bg-white transition-colors hover:bg-amber-50/40">
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  aria-label={`Select bill ${m.billNumber}`}
                  checked={selected.has(entryKey(entry))}
                  onChange={() => toggleRow(entryKey(entry))}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                />
              </td>
              <td className="px-3 py-2.5">
                <p className="font-bold text-slate-800">{m.billNumber || '—'}</p>
                <p className="text-xs text-slate-400">{dateLabel(m.date)}</p>
              </td>
              <td className="px-3 py-2.5">
                <p className="font-semibold text-slate-700">{m.vehicleNo || m.vehicleId}</p>
                <p className="text-xs text-slate-400">{m.driverName || '—'}</p>
              </td>
              <td className="px-3 py-2.5">
                <p className="max-w-[220px] font-semibold text-slate-700">{m.maintenanceType}</p>
                <span className="mt-0.5 inline-block rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                  {m.serviceType}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <p className="text-slate-700">{m.garage || '—'}</p>
                <p className="text-xs text-slate-400">{m.mechanic || ''}</p>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{kg.format(m.currentKM)}</td>
              <td className="px-3 py-2.5">
                {rates.top ? (
                  <>
                    <p className="max-w-[200px] truncate text-slate-700" title={rates.top.name}>
                      {rates.top.name}
                    </p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {rates.top.qty} × {inr2.format(rates.top.rate)} · {rates.line}
                    </p>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">{rates.line}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums text-slate-900">{inr2.format(m.totalCost)}</span>
              </td>
              <WaitingCell iso={m.createdAt || m.date} />
              <PendingStatusCell />
              <RowActions entry={entry} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  /* ── payments table ───────────────────────────────────────────────────── */
  const renderPayments = () => (
    <table className="w-full min-w-[1120px] border-collapse text-sm">
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          <Th align="center" className="w-10">
            <input
              type="checkbox"
              aria-label="Select all payments"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
          </Th>
          <Th>Payment no</Th>
          <Th>Type</Th>
          <Th>Paid to</Th>
          <Th>Mode</Th>
          <Th>Reference / category</Th>
          <Th align="right">Amount</Th>
          <Th>Requested</Th>
          <Th>Waiting</Th>
          <Th>Status</Th>
          <Th align="right">Decision</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {visibleRows.map((entry) => {
          if (entry.kind !== 'payment') return null;
          const p: Payment = entry.payment;
          return (
            <tr key={entryKey(entry)} className="bg-white transition-colors hover:bg-amber-50/40">
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  aria-label={`Select ${p.paymentNo}`}
                  checked={selected.has(entryKey(entry))}
                  onChange={() => toggleRow(entryKey(entry))}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                />
              </td>
              <td className="px-3 py-2.5">
                <p className="font-bold text-slate-800">{p.paymentNo}</p>
                <p className="text-xs text-slate-400">{dateLabel(p.paymentDate)}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{p.paymentType}</td>
              <td className="px-3 py-2.5">
                <p className="max-w-[200px] truncate text-slate-700" title={p.paidTo}>
                  {p.paidTo}
                </p>
                <p className="text-xs text-slate-400">{p.createdBy}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{p.paymentMode}</td>
              <td className="px-3 py-2.5">
                <p className="text-slate-700">{p.referenceNo || '—'}</p>
                <p className="text-xs text-slate-400">{p.category}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums text-slate-900">{inr2.format(p.amount)}</span>
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-500">{dateLabel(p.createdAt)}</td>
              <WaitingCell iso={p.createdAt} />
              <PendingStatusCell />
              <RowActions entry={entry} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const tabCounts: Record<Tab, number> = {
    trips: totals.trips,
    rates: totals.rates,
    maintenance: totals.maintenanceCount,
    payments: totals.paymentCount,
  };

  return (
    <div className="min-h-screen bg-slate-50/60 px-3 py-5 text-slate-800 md:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-900">
            <ClipboardCheck size={22} className="text-amber-600" />
            Approval Center
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Review and sign off completed trips, outstanding rate entries, maintenance bill rates and payment requests — one queue.
          </p>
        </div>
        <Button variant="outline" size="sm" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />} onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="mt-4">
        <ApprovalKpiCards
          active={tab}
          onSelect={switchTab}
          totals={{
            trips: totals.trips,
            tripBirds: trips.reduce((sum, t) => sum + (Number(t.totalBirds) || 0), 0),
            tripShops: trips.reduce((sum, t) => sum + (Number(t.totalShops) || 0), 0),
            rates: totals.rates,
            maintenanceCount: totals.maintenanceCount,
            maintenanceValue: totals.maintenanceValue,
            paymentCount: totals.paymentCount,
            paymentValue: totals.paymentValue,
            cashAwaiting: totals.cashAwaiting,
          }}
        />
      </div>

      {/* Tabs + search */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1" role="tablist" aria-label="Approval queues">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => switchTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === id ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon size={15} />
              {label}
              <span
                className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  tab === id ? 'bg-amber-100 text-amber-800' : 'bg-slate-300/70 text-slate-700'
                }`}
              >
                {tabCounts[id]}
              </span>
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search this queue…"
          aria-label="Search pending approvals"
          wrapperClassName="w-full sm:w-72"
        />
      </div>

      {/* Bulk action bar */}
      {selectedEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-bold text-emerald-800">
            {selectedEntries.length} selected
            {selectedValue > 0 ? ` · ${inr.format(selectedValue)}` : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              icon={<CheckCircle2 size={15} />}
              loading={actionBusy}
              onClick={() => setApproveTargets(selectedEntries)}
            >
              Approve selected
            </Button>
            <Button size="sm" variant="destructiveOutline" icon={<Undo2 size={15} />} disabled={actionBusy} onClick={() => setReturnTargets(selectedEntries)}>
              Send back selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-400">
            <RefreshCw size={16} className="mr-2 animate-spin" />
            Loading approval queues…
          </div>
        ) : error ? (
          <EmptyState
            variant="error"
            action={
              <Button variant="primary" size="sm" onClick={() => void refresh()}>
                Retry
              </Button>
            }
          />
        ) : visibleRows.length === 0 ? (
          search ? (
            <EmptyState variant="no-search" />
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={28} />
              </span>
              <p className="text-base font-bold text-slate-800">All caught up — nothing to approve here</p>
              <p className="max-w-sm text-sm text-slate-400">
                Newly submitted trips, maintenance bills and payment requests will appear in this queue the moment
                they are ready for sign-off.
              </p>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            {tab === 'trips' && renderTrips()}
            {tab === 'rates' && renderRates()}
            {tab === 'maintenance' && renderMaintenance()}
            {tab === 'payments' && renderPayments()}
          </div>
        )}
      </div>

      {/* Recent decisions (this session) */}
      {activity.length > 0 && <RecentDecisions activity={activity} />}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={approveTargets.length > 0}
        title={approveDialog?.title ?? 'Approve?'}
        tone="primary"
        initialFocus="confirm"
        loading={actionBusy}
        confirmLabel="Approve"
        message={
          <div className="space-y-2">
            <p>{approveDialog?.message}</p>
            {approveDialog?.value && (
              <p className="text-sm font-bold text-slate-700">
                Total value: <span className="text-emerald-700">{approveDialog.value}</span>
              </p>
            )}
            {approveTargets.length > 1 && (
              <ul className="max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-100">
                {approveTargets.map((entry) => (
                  <li key={entryKey(entry)} className="py-0.5">
                    {refOf(entry)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
        record={approveTargets.length === 1 ? refOf(approveTargets[0]) : `${approveTargets.length} records`}
        onConfirm={() => void runDecision(approveTargets, 'approve')}
        onCancel={() => setApproveTargets([])}
      />
      <RejectReasonDialog
        key={returnTargets.map(entryKey).join(',') || 'closed'}
        open={returnTargets.length > 0}
        title={returnDialog?.title ?? 'Send back?'}
        record={returnTargets.length === 1 && returnTargets[0] ? refOf(returnTargets[0]) : `${returnTargets.length} records`}
        confirmLabel={returnDialog?.confirmLabel ?? 'Send back'}
        helper={returnDialog?.helper ?? 'Enter a reason.'}
        loading={actionBusy}
        onConfirm={(reason) => {
          const targets = returnTargets;
          setReturnTargets([]);
          void runDecision(targets, 'return', reason);
        }}
        onCancel={() => setReturnTargets([])}
      />
      <ApprovalDetailsModal
        entry={details}
        onClose={() => setDetails(null)}
        footer={
          details && details.kind !== 'rate' ? (
            <>
              <Button variant="secondary" onClick={() => setDetails(null)}>
                Close
              </Button>
              <Button variant="destructiveOutline" icon={<Undo2 size={15} />} onClick={openDetailsReturn}>
                {details.kind === 'maintenance' ? 'Reject' : details.kind === 'payment' ? 'Cancel' : 'Send back'}
              </Button>
              <Button variant="success" icon={<Check size={15} />} onClick={openDetailsApprove}>
                Approve
              </Button>
            </>
          ) : undefined
        }
      />
    </div>
  );
}

function RecentDecisions({ activity }: { activity: ApprovalActivity[] }) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800">Decisions in this session</h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {activity.slice(0, 8).map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-2 text-sm">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                item.decision === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {item.decision === 'approved' ? <Check size={14} /> : <Undo2 size={14} />}
            </span>
            <div className="min-w-0">
              <p className="text-slate-700">
                <span className="font-semibold capitalize">{KIND_LABEL[item.kind]}</span>{' '}
                <span className="font-bold">{item.ref}</span>{' '}
                <span className={item.decision === 'approved' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                  {item.decision === 'approved' ? 'approved' : 'sent back'}
                </span>{' '}
                by {item.by}
              </p>
              {item.reason && <p className="truncate text-xs text-slate-400">Reason: {item.reason}</p>}
            </div>
            <span className="ml-auto shrink-0 text-xs text-slate-400">
              {new Date(item.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
