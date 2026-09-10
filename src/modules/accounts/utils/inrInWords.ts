/**
 * =============================================================================
 * PAYMENT REGISTER — AMOUNT IN WORDS
 * =============================================================================
 * Converts a rupee amount to the Indian numbering vocabulary used on payment
 * vouchers and cheque ("Rupees One Lakh Twenty Three Thousand Four Hundred
 * Fifty Six Rupees and Fifty Paise Only").
 *
 * Display only: nothing here is sent to the API, and the API keeps receiving
 * the plain numeric amount. Grouping follows the Indian system (hundred,
 * thousand, lakh, crore, arab, kharab) rather than the Western thousands
 * grouping, because that is what the voucher text has to read like.
 * =============================================================================
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
] as const;

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const;

/** Indian high-order groups; the pair below each is its divisor and name. */
const GROUPS: readonly [divisor: number, name: string][] = [
  [10_000_000_000, 'Kharab'],
  [1_000_000_000, 'Arab'],
  [10_000_000, 'Crore'],
  [100_000, 'Lakh'],
  [1_000, 'Thousand'],
  [100, 'Hundred'],
];

/** Below one thousand: "Nine Hundred Ninety Nine". */
function underThousand(value: number): string {
  const words: string[] = [];
  let rest = value;
  if (rest >= 100) {
    words.push(`${ONES[Math.floor(rest / 100)]} Hundred`);
    rest %= 100;
  }
  if (rest >= 20) {
    words.push(TENS[Math.floor(rest / 10)]);
    rest %= 10;
  }
  if (rest > 0) words.push(ONES[rest]);
  return words.filter(Boolean).join(' ');
}

/** Positive whole number → Indian word grouping. */
export function numberInWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  let rest = Math.floor(value);
  if (rest === 0) return 'Zero';
  const words: string[] = [];
  for (const [divisor, name] of GROUPS) {
    if (rest < divisor) continue;
    const count = Math.floor(rest / divisor);
    rest %= divisor;
    // Thousand and Hundred stay inside the three-digit reader; larger groups
    // are counted recursively, so a value above Kharab still resolves.
    words.push(count < 1000 && divisor <= 1_000
      ? `${underThousand(count)} ${name}`
      : `${numberInWords(count)} ${name}`);
  }
  if (rest > 0) words.push(underThousand(rest));
  return words.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Voucher wording for an amount. Returns '' for anything that is not a usable
 * positive number, so a caller can simply skip the line while the form is
 * still half-typed.
 */
export function inrInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';
  const rupees = Math.floor(amount);
  // Paise from the remainder; rounded to the nearest whole paisa so binary
  // floats (e.g. 1234.5000000000002) cannot produce "Paise Fifty One".
  const paise = Math.round((amount - rupees) * 100);
  // Voucher word order: "Rupees <words> [and <paise> Paise] Only".
  const body = numberInWords(rupees);
  if (rupees === 0) return paise > 0 ? `${numberInWords(paise)} Paise Only` : 'Rupees Zero Only';
  const tail = paise > 0 ? ` and ${numberInWords(paise)} Paise` : '';
  return `Rupees ${body}${tail} Only`;
}
