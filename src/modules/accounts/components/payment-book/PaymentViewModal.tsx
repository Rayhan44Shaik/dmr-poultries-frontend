import type { Payment } from '../../types/payment.types';
import { FarmPaymentService } from '../../services/FarmPaymentService';
import { Modal } from '../../../../ui/Modal';
import { Button } from '../../../../ui/Button';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { paymentCurrency } from '../../utils/paymentRegister';

interface PaymentViewModalProps {
  isOpen: boolean;
  payment: Payment | null;
  onClose: () => void;
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

export function PaymentViewModal({ isOpen, payment, onClose }: PaymentViewModalProps) {
  if (!isOpen || !payment) return null;
  const tripDetails = getTripDetails(payment);
  const details = [
    ['Paid To', payment.paidTo],
    ['Date', payment.paymentDate.slice(0, 10).split('-').reverse().join('/')],
    ['Payment Type', payment.paymentType],
    ['Mode', payment.paymentMode],
    ['Reference / Bill No', payment.referenceNo],
    ['Category', payment.category],
  ];
  return (
    <Modal isOpen onClose={onClose} title="Payment Details" description={payment.paymentNo || 'Payment number not assigned'} size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        {payment.id.startsWith('demo-payment-') && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sample payment · Read-only preview. Not a real transaction.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div><p className="text-xs text-slate-500">Amount paid</p><p className="text-2xl font-semibold tabular-nums text-slate-900">{paymentCurrency.format(payment.amount)}</p></div>
          <StatusBadge status={payment.status} />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || '—'}</dd></div>)}
        </dl>
        {tripDetails.length > 0 && <section aria-label="Trip details" className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold">Trip details · {tripDetails.length}</h3>
          {tripDetails.map((trip, index) => <div key={`${trip.tripNo}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{trip.tripNo}</span><span className="tabular-nums">{paymentCurrency.format(trip.amount)}</span></div>)}
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-2 text-sm font-semibold"><span>Total trip amount</span><span>{paymentCurrency.format(tripDetails.reduce((sum, trip) => sum + trip.amount, 0))}</span></div>
        </section>}
        <div><h3 className="text-xs text-slate-500">Remarks / Notes</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{payment.remarks || '—'}</p></div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><span>Created: {timestamp(payment.createdAt)}</span><span>Updated: {timestamp(payment.updatedAt)}</span></div>
      </div>
    </Modal>
  );
}
