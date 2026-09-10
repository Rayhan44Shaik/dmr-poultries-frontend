// src/modules/accounts/components/farm-payment/farmPaymentFormat.ts
//
// Shared money / count formatting for the Farm Payment page (KPI cards and the
// trips table). Same convention as the Accounts Dashboard (Summary): a compact,
// readable magnitude on screen and the exact rupees kept for a hover tip, so a
// KPI total and the column it adds up can never disagree.

const inrGrouped = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const countGrouped = new Intl.NumberFormat('en-IN');

/** Full precision, Indian digit grouping: ₹2,34,500.00 */
export const formatINRExact = (amount: number): string => inrGrouped.format(amount || 0);

/**
 * Readable magnitude first: ₹99,999.00 / ₹2.35L / ₹1.25Cr.
 * Anything under a lakh keeps the exact grouped figure so nothing is rounded
 * away on small numbers; from 1,00,000 up it switches to lakh and from
 * 1,00,00,000 up to crore.
 */
export const formatINR = (amount: number): string => {
  const value = Number(amount) || 0;
  const sign = value < 0 ? '-' : '';
  // Round to paise first: 99,999.999 must not print as "₹1,00,000.00".
  const abs = Math.round(Math.abs(value) * 100) / 100;
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  return `${sign}${inrGrouped.format(abs)}`;
};

/** Whole-number count with Indian grouping: 1,23,456 */
export const formatCount = (num: number): string => countGrouped.format(Math.round(Number(num) || 0));
