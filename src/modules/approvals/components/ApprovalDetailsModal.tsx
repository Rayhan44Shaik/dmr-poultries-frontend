import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ReceiptText } from 'lucide-react';
import { Modal } from '../../../ui/Modal';
import { Button } from '../../../ui/Button';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { MaintenanceEvent } from '../../fleet-operations/types';
import type { Payment } from '../../accounts/types/payment.types';
import { dateTimeLabel, inr, inr2, kg, partsLineTotal } from '../approvalsUtils';

export type ApprovalEntry =
  | { kind: 'trip'; trip: Trip }
  | { kind: 'rate'; trip: Trip }
  | { kind: 'maintenance'; maintenance: MaintenanceEvent }
  | { kind: 'payment'; payment: Payment };

interface ApprovalDetailsModalProps {
  entry: ApprovalEntry | null;
  onClose: () => void;
  footer?: ReactNode;
}

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-100">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{value ?? '—'}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
      {children}
    </h4>
  );
}

function TripDetails({ trip }: { trip: Trip }) {
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
      <Cell label="Trip No" value={trip.tripNo} />
      <Cell label="Trip Date" value={dateTimeLabel(trip.tripDate)} />
      <Cell label="Status" value={trip.status} />
      <Cell label="Vehicle" value={trip.vehicleNo || '—'} />
      <Cell label="Driver" value={trip.driverName || '—'} />
      <Cell label="Supervisor" value={trip.supervisorName || '—'} />
      <Cell label="Source Farm" value={trip.sourceFarm || '—'} />
      <Cell label="Bird Type" value={trip.birdType || '—'} />
      <Cell label="Shops Visited" value={trip.totalShops} />
      <Cell label="Birds Loaded" value={kg.format(trip.totalBirds)} />
      <Cell label="DC Weight (kg)" value={kg.format(trip.dcWeight)} />
      <Cell label="Delivered Weight" value={kg.format(trip.totalDeliveredWeight)} />
      <Cell label="Boxes" value={trip.boxes} />
      <Cell label="Mortality" value={trip.totalMortalityCount} />
      <Cell label="Weight Loss (kg)" value={kg.format(trip.weightLoss)} />
      <Cell label="Opening KM" value={trip.openingMeter ?? '—'} />
      <Cell label="Closing KM" value={trip.closingMeter || '—'} />
      <Cell label="Total KM" value={kg.format(trip.totalKm)} />
      <Cell label="Advance" value={inr.format(trip.advanceAmount ?? 0)} />
      <Cell label="Fuel" value={inr.format(trip.fuel)} />
      <Cell label="Other Expenses" value={inr.format(trip.expense)} />
      <div className="col-span-2 md:col-span-3">
        <Cell label="Submitted At" value={dateTimeLabel(trip.startStepSubmittedAt || trip.createdAt)} />
      </div>
      {trip.remarks && (
        <div className="col-span-2 md:col-span-3">
          <Cell label="Remarks" value={trip.remarks} />
        </div>
      )}
    </dl>
  );
}

function MaintenanceDetails({ record }: { record: MaintenanceEvent }) {
  const parts = Array.isArray(record.parts) ? record.parts : [];
  const lineTotal = partsLineTotal(record);
  const other = (Number(record.totalCost) || 0) - lineTotal;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Cell label="Bill No" value={record.billNumber || '—'} />
        <Cell label="Bill Date" value={dateTimeLabel(record.date)} />
        <Cell label="Service Type" value={record.serviceType || '—'} />
        <Cell label="Vehicle" value={record.vehicleNo || record.vehicleId} />
        <Cell label="Odometer KM" value={kg.format(record.currentKM)} />
        <Cell label="Next Service KM" value={record.nextServiceKM ? kg.format(record.nextServiceKM) : '—'} />
        <Cell label="Maintenance" value={record.maintenanceType || '—'} />
        <Cell label="Garage" value={record.garage || '—'} />
        <Cell label="Mechanic" value={record.mechanic || '—'} />
        <Cell label="Driver" value={record.driverName || '—'} />
        <Cell label="Created By" value={record.createdBy || '—'} />
        <Cell label="Created At" value={dateTimeLabel(record.createdAt)} />
      </dl>

      <SectionTitle>Bill rate / spare-part lines</SectionTitle>
      <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Part / Service</th>
              <th className="px-3 py-2">Spec</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parts.map((part, index) => (
              <tr key={`${part.name}-${index}`}>
                <td className="px-3 py-2 font-medium text-slate-700">{part.name}</td>
                <td className="px-3 py-2 text-slate-500">{part.specification || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{part.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{inr2.format(part.rate)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr2.format(part.amount)}</td>
              </tr>
            ))}
            {parts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  No itemised lines — total bill only.
                </td>
              </tr>
            )}
          </tbody>
          {parts.length > 0 && (
            <tfoot className="bg-slate-50 text-sm">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right font-medium text-slate-500">
                  Line total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{inr2.format(lineTotal)}</td>
              </tr>
              {Math.abs(other) > 0.01 && (
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium text-slate-500">
                    Other charges / labour
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr2.format(other)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-700">
                  Bill total
                </td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">
                  {inr2.format(Number(record.totalCost) || 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {record.remarks && (
        <>
          <SectionTitle>Remarks</SectionTitle>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-100">
            {record.remarks}
          </p>
        </>
      )}
    </div>
  );
}

function PaymentDetails({ payment }: { payment: Payment }) {
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
      <Cell label="Payment No" value={payment.paymentNo} />
      <Cell label="Payment Date" value={dateTimeLabel(payment.paymentDate)} />
      <Cell label="Status" value="Pending approval" />
      <Cell label="Payment Type" value={payment.paymentType} />
      <Cell label="Payment Mode" value={payment.paymentMode} />
      <Cell label="Category" value={payment.category || '—'} />
      <Cell label="Paid To" value={payment.paidTo} />
      <Cell label="Reference No" value={payment.referenceNo || '—'} />
      <Cell label="Amount" value={<span className="text-emerald-700">{inr2.format(payment.amount)}</span>} />
      <Cell label="Created By" value={payment.createdBy} />
      <Cell label="Created At" value={dateTimeLabel(payment.createdAt)} />
      <Cell label="Attachments" value={payment.attachments?.length ?? 0} />
      {payment.remarks && (
        <div className="col-span-2 md:col-span-3">
          <Cell label="Remarks" value={payment.remarks} />
        </div>
      )}
    </dl>
  );
}

export function ApprovalDetailsModal({ entry, onClose, footer }: ApprovalDetailsModalProps) {
  const title =
    entry?.kind === 'trip'
      ? `Trip ${entry.trip.tripNo}`
      : entry?.kind === 'rate'
        ? `Rate entry — ${entry.trip.tripNo}`
        : entry?.kind === 'maintenance'
          ? `Maintenance bill ${entry.maintenance.billNumber || '#' + entry.maintenance.id}`
          : entry?.kind === 'payment'
            ? `Payment ${entry.payment.paymentNo}`
            : '';

  return (
    <Modal
      isOpen={entry !== null}
      onClose={onClose}
      title={title}
      description={
        entry?.kind === 'rate'
          ? 'This completed trip is waiting for shop-wise sale rates in Rate Entry.'
          : 'Review the full record before approving or sending it back.'
      }
      size="lg"
      footer={
        footer ??
        (entry?.kind === 'rate' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Link
              to="/operations?tab=rate-entry"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700"
            >
              <ReceiptText size={15} />
              Enter rates
            </Link>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ))
      }
    >
      {(entry?.kind === 'trip' || entry?.kind === 'rate') && <TripDetails trip={entry.trip} />}
      {entry?.kind === 'maintenance' && <MaintenanceDetails record={entry.maintenance} />}
      {entry?.kind === 'payment' && <PaymentDetails payment={entry.payment} />}
    </Modal>
  );
}
