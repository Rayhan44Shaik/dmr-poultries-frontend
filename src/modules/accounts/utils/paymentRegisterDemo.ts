import { addDays } from 'date-fns';
import { parseBusinessDate, toBusinessDate, weekRange } from '../../../utils/businessDate';
import type { Payment } from '../types/payment.types';
import { PAYMENT_MODES, PAYMENT_TYPES } from './paymentRegister';

/** Fictional, read-only examples. Never persisted or passed to a payment API. */
export function createDemoPayments(reference = new Date()): Payment[] {
  const monday = parseBusinessDate(weekRange(reference).from)!;
  const names = ['Sample Green Valley Farm', 'Sample Highway Fuels', 'Sample Fleet Workshop', 'Sample Staff Payroll', 'Sample Vehicle Finance', 'Sample Toll Account', 'Sample Office Supplies', 'Sample Tax Office', 'Sample Utility Services'];
  const amounts = [42500, 8250.75, 6400, 28000, 18500, 3000, 1250.50, 5400, 2100];
  const statuses: Payment['status'][] = ['Approved', 'Paid', 'Draft', 'Cancelled'];
  return Array.from({ length: 18 }, (_, index) => {
    const date = toBusinessDate(addDays(monday, Math.floor(index / 3)));
    const sequence = String(index % 3 + 1).padStart(3, '0');
    return {
      id: `demo-payment-${index + 1}`,
      paymentNo: `Pay-${date.split('-').reverse().join('')}-${sequence}`,
      paymentDate: date,
      paymentType: PAYMENT_TYPES[index % PAYMENT_TYPES.length],
      paymentMode: PAYMENT_MODES[index % PAYMENT_MODES.length],
      paidTo: names[index % names.length],
      amount: amounts[index % amounts.length],
      referenceNo: `SAMPLE-BILL-${String(index + 1).padStart(3, '0')}`,
      category: PAYMENT_TYPES[index % PAYMENT_TYPES.length],
      remarks: 'Fictional sample for preview only. Not a real transaction.',
      status: statuses[index % statuses.length],
      createdBy: 'Demo preview',
      createdAt: `${date}T10:00:00+05:30`,
      updatedAt: `${date}T10:00:00+05:30`,
      attachments: [],
    };
  });
}
