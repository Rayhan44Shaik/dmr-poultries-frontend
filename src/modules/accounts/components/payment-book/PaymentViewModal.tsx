// src/modules/accounts/components/payment-book/PaymentViewModal.tsx
//
// The read-only twin of the entry sheet: same section rules, same field
// shells, same type/mode marks — so opening a record and editing it feel like
// one screen rather than two products.

import type { ReactNode } from 'react';
import { BadgeCheck, CalendarDays, FileText, IndianRupee, Paperclip, Pencil, ScrollText, UserRound } from 'lucide-react';
import type { Payment } from '../../types/payment.types';
import { FarmPaymentService } from '../../services/FarmPaymentService';
import { Modal } from '../../../../ui/Modal';
import { Button } from '../../../../ui/Button';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { MasterSectionHeading } from '../../../masters/components/MasterForm';
import { paymentCurrency, paymentStatusLabel } from '../../utils/paymentRegister';
import { inrInWords } from '../../utils/inrInWords';
import { PaymentModeMark, PaymentTypeMark } from './PaymentGlyphMarks';

interface PaymentViewModalProps {
  isOpen: boolean;
  payment: Payment | null;
  onClose: () => void;
  /**
   * Jump straight from the sheet into the edit dialog. Omitted when the caller
   * has no edit flow, in which case nothing edit-related is rendered.
   */
  onEdit?: () => void;
  /** False keeps the edit affordances visible but disabled, with `editHint`. */
  canEdit?: boolean;
  /** Why editing is unavailable — surfaced as the disabled control's tooltip. */
  editHint?: string;
}

const getTripDetails = (payment: Payment): { tripNo: string; amount: number }[] => {
  if (!payment.paymentIds || payment.paymentIds.length === 0) {
    return [];
  }

  const tripDetails: { tripNo: string; amount: number }[] = [];
  for (const paymentId of payment.paymentIds) {
    const farmPayment = FarmPaymentService.getPaymentById(paymentId);
    if (farmPayment) {
      tripDetails.push({
        tripNo: farmPayment.tripId,
        amount: farmPayment.totalAmount ?? farmPayment.balance ?? 0,
      });
    }
  }
  return tripDetails;
};

const timestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
};

/**
 * Read-only counterpart of the entry sheet's field: label above, value in a
 * shell. Payment Type and Mode pass no `icon`: their value already carries a
 * mark, and a field showing two icons for one thing reads as a bug.
 */
function DetailField({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
      <div className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-sm font-medium text-slate-800">
        {icon ? <span aria-hidden="true" className="shrink-0 text-slate-400">{icon}</span> : null}
        <span className="min-w-0 flex-1">{children}</span>
      </div>
    </div>
  );
}

const EMPTY = <span className="font-normal text-slate-400">—</span>;

export function PaymentViewModal({ isOpen, payment, onClose, onEdit, canEdit = false, editHint }: PaymentViewModalProps) {
  if (!isOpen || !payment) return null;
  const tripDetails = getTripDetails(payment);
  const inWords = inrInWords(Number(payment.amount) || 0);
  const dateShown = payment.paymentDate.slice(0, 10).split('-').reverse().join('/');
  // Only a pending (Draft) record can still be edited, so the edit symbol is
  // tied to that state rather than shown on every sheet.
  const pending = payment.status === 'Draft';
  const showEdit = pending && Boolean(onEdit);

  return (
    <Modal isOpen onClose={onClose} title="Payment Details" description={payment.paymentNo || 'Payment number not assigned'} size="xl"
      footer={<>
        {/* A disabled button alone reads as a bug, so the reason is stated next
            to it: the row simply is not in an editable state. */}
        {showEdit && !canEdit && <p className="mr-auto text-[11px] leading-4 text-slate-500">{editHint}</p>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {showEdit && (
          <Button icon={<Pencil size={14} />} disabled={!canEdit} title={canEdit ? 'Edit this payment' : editHint} onClick={onEdit}>Edit payment</Button>
        )}
      </>}>
      <div className="space-y-4">
        {payment.id.startsWith('demo-payment-') && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sample payment · Read-only preview. Not a real transaction.</p>}

        {/* FIGURE — accent bar, the amount, and the state it is in. Editing lives
            in the footer, next to Close, so there is exactly one edit control. */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white px-4 py-3.5">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-emerald-400/80" />
          <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/60">Amount paid</p>
              <p className="mt-0.5 text-[26px] font-semibold leading-tight tabular-nums text-slate-900">{paymentCurrency.format(payment.amount)}</p>
              {inWords && <p className="mt-1 text-[11px] italic leading-snug text-emerald-900/70">{inWords}</p>}
            </div>
            <StatusBadge status={payment.status} label={paymentStatusLabel(payment.status)} tone={pending ? 'warning' : undefined} size="md" className="shrink-0" />
          </div>
        </div>

        {/* PAYMENT — type and mode bring their own mark, so no field icon. */}
        <section className="space-y-2.5">
          <MasterSectionHeading>Payment</MasterSectionHeading>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <DetailField label="Date" icon={<CalendarDays size={14} />}><span className="tabular-nums">{dateShown}</span></DetailField>
            <DetailField label="Payment Type"><PaymentTypeMark type={payment.paymentType} /></DetailField>
            <DetailField label="Mode">{payment.paymentMode ? <PaymentModeMark mode={payment.paymentMode} /> : EMPTY}</DetailField>
            <DetailField label="Category" icon={<IndianRupee size={14} />}>{payment.category || EMPTY}</DetailField>
          </div>
        </section>

        {/* PAYEE & PAPER TRAIL */}
        <section className="space-y-2.5">
          <MasterSectionHeading>Payee &amp; reference</MasterSectionHeading>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <DetailField label="Paid To" icon={<UserRound size={14} />}>{payment.paidTo || EMPTY}</DetailField>
            </div>
            <div className="md:col-span-4">
              <DetailField label="Reference / Bill No" icon={<ScrollText size={14} />}>
                <span className="uppercase tracking-tight">{payment.referenceNo || '—'}</span>
              </DetailField>
            </div>
            <div className="md:col-span-3">
              <DetailField label="Recorded By" icon={<BadgeCheck size={14} />}>{payment.createdBy || EMPTY}</DetailField>
            </div>
          </div>
        </section>

        {tripDetails.length > 0 && <section className="space-y-2.5">
          <MasterSectionHeading>{`Trips settled · ${tripDetails.length}`}</MasterSectionHeading>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {tripDetails.map((trip, index) => <div key={`${trip.tripNo}-${index}`} className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">{trip.tripNo}</span>
              <span className="tabular-nums text-slate-600">{paymentCurrency.format(trip.amount)}</span>
            </div>)}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 px-3 py-2 text-sm font-semibold text-slate-800">
              <span>Total trip amount</span>
              <span className="tabular-nums">{paymentCurrency.format(tripDetails.reduce((sum, trip) => sum + trip.amount, 0))}</span>
            </div>
          </div>
        </section>}

        {/* NOTE + FILES */}
        <section className="space-y-2.5">
          <MasterSectionHeading>Note &amp; files</MasterSectionHeading>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-8">
              <DetailField label="Remarks / Notes" icon={<FileText size={14} />}>
                {payment.remarks ? <span className="block whitespace-pre-wrap break-words text-sm font-normal text-slate-700">{payment.remarks}</span> : <span className="text-sm font-normal text-slate-400">No note recorded.</span>}
              </DetailField>
            </div>
            <div className="md:col-span-4">
              <DetailField label="Attachments" icon={<Paperclip size={14} />}>
                {payment.attachments.length === 0
                  ? <span className="text-sm font-normal text-slate-400">No files attached.</span>
                  : (
                    <ul className="space-y-0.5 text-sm font-normal">
                      {payment.attachments.map(file => <li key={file.id}>
                        <a href={file.fileUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800">{file.fileName}</a>
                      </li>)}
                    </ul>
                  )}
              </DetailField>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <span>Created: {timestamp(payment.createdAt)}</span>
          <span>Updated: {timestamp(payment.updatedAt)}</span>
        </div>
      </div>
    </Modal>
  );
}
