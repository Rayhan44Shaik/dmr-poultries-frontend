import type { Payment } from '../types/payment.types';

export const PAYMENT_TYPES = ['Farmer Payment', 'Fuel Payment', 'Vehicle Maintenance', 'Salary Payment', 'EMI Payment', 'FASTag Recharge', 'Office Expense', 'Tax Payment', 'Other Expense'];
export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'];
export const paymentCurrency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** Display-only alias: preserve the existing Draft API value. */
export function paymentStatusLabel(status: Payment['status']): string {
  return status === 'Draft' ? 'Pending' : status;
}

/**
 * Payment numbers are assigned by the server, so the stored value is never
 * rewritten — this only reorders how a day-first stamp READS, so a legacy
 * `Pay-07092026-001` appears as `Pay-20260907-001` like everything else here.
 *
 * Deliberately conservative and idempotent:
 *   · an 8-digit run that is already YYYYMMDD is returned untouched;
 *   · a day-first run (DDMM within a plausible month, 19xx/20xx year) is flipped;
 *   · anything else — legacy `LEGACY-42`, a longer digit run, no date at all —
 *     is returned exactly as stored, because guessing at an identifier is worse
 *     than showing it raw.
 */
const YEAR_FIRST = /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/;
const DAY_FIRST = /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])((19|20)\d{2})$/;

export function paymentNoDisplay(paymentNo?: string | null): string {
  if (!paymentNo) return '';
  return paymentNo.replace(/(?<!\d)(\d{8})(?!\d)/, digits => {
    if (YEAR_FIRST.test(digits)) return digits;
    const dayFirst = DAY_FIRST.exec(digits);
    return dayFirst ? `${dayFirst[3]}${dayFirst[2]}${dayFirst[1]}` : digits;
  });
}

/**
 * Search has to match what the table shows, so both spellings of the number are
 * in the haystack — a reformat that made a visible row unsearchable would be a
 * worse bug than the inconsistent order it fixes.
 */
export function paymentNoSearchTerms(paymentNo?: string | null): string[] {
  const raw = paymentNo?.trim();
  if (!raw) return [];
  const shown = paymentNoDisplay(raw);
  return shown === raw ? [raw] : [raw, shown];
}

export function filterPayments(payments: Payment[], filters: { from: string; to: string; type: string; mode: string; search: string }) {
  const query = filters.search.trim().toLocaleLowerCase();
  return payments.filter(p => {
    const date = p.paymentDate.slice(0, 10);
    const haystack = [p.paymentType, p.paidTo, p.referenceNo, p.remarks, p.paymentMode, String(p.amount), paymentCurrency.format(p.amount), ...paymentNoSearchTerms(p.paymentNo)];
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      && (!filters.type || p.paymentType === filters.type) && (!filters.mode || p.paymentMode === filters.mode)
      && (!query || haystack.some(value => value?.toLocaleLowerCase().includes(query)));
  });
}
