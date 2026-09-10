import type { Payment } from '../types/payment.types';

export const PAYMENT_TYPES = ['Farmer Payment', 'Fuel Payment', 'Vehicle Maintenance', 'Salary Payment', 'EMI Payment', 'FASTag Recharge', 'Office Expense', 'Tax Payment', 'Other Expense'];
export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'];
export const paymentCurrency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** Display-only alias: preserve the existing Draft API value. */
export function paymentStatusLabel(status: Payment['status']): string {
  return status === 'Draft' ? 'Pending' : status;
}

export function filterPayments(payments: Payment[], filters: { from: string; to: string; type: string; mode: string; search: string }) {
  const query = filters.search.trim().toLocaleLowerCase();
  return payments.filter(p => {
    const date = p.paymentDate.slice(0, 10);
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      && (!filters.type || p.paymentType === filters.type) && (!filters.mode || p.paymentMode === filters.mode)
      && (!query || [p.paymentNo, p.paymentType, p.paidTo, p.referenceNo, p.remarks, p.paymentMode, String(p.amount), paymentCurrency.format(p.amount)].some(value => value?.toLocaleLowerCase().includes(query)));
  });
}
