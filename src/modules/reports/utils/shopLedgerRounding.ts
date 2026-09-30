/**
 * Shop Ledger display/export rounding: nearest whole unit, with an exact half
 * rounded away from zero (100.5 -> 101, 100.4 -> 100).
 */
export function roundLedgerValue(value: number): number {
  const numeric = Number(value) || 0;
  return Math.sign(numeric) * Math.floor(Math.abs(numeric) + 0.5);
}

export function formatLedgerNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundLedgerValue(value));
}
