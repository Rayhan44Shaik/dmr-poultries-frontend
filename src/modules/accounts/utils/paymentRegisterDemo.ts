import { addDays } from 'date-fns';
import { parseBusinessDate, toBusinessDate, weekRange } from '../../../utils/businessDate';
import type { Payment, PaymentWritePayload } from '../types/payment.types';
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
      // Year-first, matching the `PAY-YYYYMMDD-###` convention the legacy
      // PaymentService already writes, so numbers sort in the same order they read.
      paymentNo: `Pay-${date.replace(/-/g, '')}-${sequence}`,
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

/* ---------------------------------------------------------------------------
 * WRITING THE SAMPLE SET
 * ---------------------------------------------------------------------------
 * The preview is deliberately writable so the whole lifecycle can be exercised
 * without a backend, and these are the only functions allowed to change a sample
 * row. They are pure — they return the next list instead of touching it — so the
 * register keeps the undo/reset story simple, and they never call a payment
 * endpoint: a sample row cannot reach the server even by accident.
 * ------------------------------------------------------------------------- */

/** Next free number for that date, e.g. `Pay-20260910-002`. Year-first, like the rest. */
export function nextDemoPaymentNo(rows: Pick<Payment, 'paymentNo'>[], paymentDate: string): string {
  const stamp = paymentDate.replace(/-/g, '');
  let sequence = 1;
  while (rows.some(row => row.paymentNo === `Pay-${stamp}-${String(sequence).padStart(3, '0')}`)) sequence += 1;
  return `Pay-${stamp}-${String(sequence).padStart(3, '0')}`;
}

export interface DemoWrite {
  rows: Payment[];
  saved: Payment;
}

/**
 * Merge a form write into the sample set. With a `target` the row is replaced in
 * place and its identity (id, payment number, createdAt) is preserved — a
 * preview edit must not invent a new payment. Without one, a row is prepended
 * with a fresh number so it appears exactly where a created record belongs.
 */
export function applyDemoWrite(rows: Payment[], payload: PaymentWritePayload, target: Payment | null, now = new Date()): DemoWrite {
  const stamp = now.toISOString();
  if (target) {
    const saved = { ...target, ...payload, id: target.id, paymentNo: target.paymentNo, createdAt: target.createdAt, updatedAt: stamp } as Payment;
    return { saved, rows: rows.map(row => row.id === target.id ? saved : row) };
  }
  const paymentDate = payload.paymentDate || toBusinessDate(now);
  const saved = {
    ...payload,
    paymentDate,
    id: `demo-payment-new-${now.getTime().toString(36)}`,
    paymentNo: nextDemoPaymentNo(rows, paymentDate),
    category: payload.category || payload.paymentType,
    createdBy: payload.createdBy || 'Sample preview',
    attachments: [],
    createdAt: stamp,
    updatedAt: stamp,
  } as Payment;
  return { saved, rows: [saved, ...rows] };
}

/** Restore the untouched set, discarding preview edits. */
export function resetDemoPayments(reference?: Date): Payment[] {
  return createDemoPayments(reference);
}
