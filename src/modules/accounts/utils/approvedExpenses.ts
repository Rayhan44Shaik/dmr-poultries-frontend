import type { Payment } from '../types/payment.types';
import type { ExpenseBreakdown } from '../types/summary.types';
import { paymentExpenseSector } from './paymentRegister';
import { toBusinessDate } from '../../../utils/businessDate';

/** Payment Register is the sole source. Paid is NOT Approved. */
export function isApprovedRegisterPayment(row: { status?: unknown; deleted?: unknown }): boolean {
  return row.status === 'Approved' && row.deleted !== true && row.deleted !== 1 && row.deleted !== 'true';
}

export function approvedExpenses(payments: readonly Payment[], start: Date, end: Date): ExpenseBreakdown {
  const total: ExpenseBreakdown = {farm: 0, fuel: 0, trip: 0, salary: 0, maintenance: 0, office: 0};
  const from = toBusinessDate(start), to = toBusinessDate(end);
  const unique = new Map(payments.map(row => [row.id, row]));
  for (const row of unique.values()) {
    const date = row.paymentDate.slice(0, 10);
    if (!isApprovedRegisterPayment(row) || !date || date < from || date > to) continue;
    const amount = Number(row.amount);
    if (Number.isFinite(amount) && amount > 0) total[paymentExpenseSector(row.paymentType, row.category)] += amount;
  }
  return total;
}
