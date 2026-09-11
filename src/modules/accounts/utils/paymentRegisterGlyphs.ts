/**
 * =============================================================================
 * PAYMENT REGISTER — PAYMENT TYPE & PAYMENT MODE GLYPH MAP
 * =============================================================================
 * The single place that decides which mark and accent colour represents a
 * payment type ("Fuel Payment") and a payment mode ("UPI") inside the
 * register. Pages must not hand-pick icons per call site: one map keeps the
 * same type the same colour in the table, the view sheet and the entry form.
 *
 * Resolvers only — no JSX lives here, so the module stays importable from
 * non-component code (exports, print sheets, tests). The marks that render
 * these values are in `components/payment-book/PaymentGlyphMarks.tsx`.
 *
 * WHY NEUTRAL GLYPHS INSTEAD OF BRAND LOGOS
 *   UPI, RuPay, NEFT and individual bank marks are trademarks governed by their
 *   own usage guidelines, so they are never redrawn inside the ERP. Each mode
 *   instead gets an unambiguous generic mark (note, phone, bank, slip, bolt)
 *   with its own tint, which is what actually makes a long register scannable
 *   at a glance.
 *
 * ACCESSIBILITY
 *   Every glyph is aria-hidden and always sits next to its text label, so
 *   neither colour nor icon is ever the only carrier of meaning.
 * =============================================================================
 */

import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  CreditCard,
  FileText,
  Fuel,
  Landmark,
  MoreHorizontal,
  Percent,
  ReceiptText,
  Smartphone,
  Sprout,
  Users,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface PaymentGlyph {
  Icon: LucideIcon;
  /** Chip fill + ink + hairline ring, as one token so tints never drift apart. */
  tint: string;
}

const NEUTRAL: PaymentGlyph = {
  Icon: Wallet,
  tint: 'bg-slate-100 text-slate-500 ring-slate-500/10',
};

const PAYMENT_TYPE_GLYPHS: Record<string, PaymentGlyph> = {
  'farmer payment': { Icon: Sprout, tint: 'bg-lime-50 text-lime-700 ring-lime-600/15' },
  'fuel payment': { Icon: Fuel, tint: 'bg-orange-50 text-orange-600 ring-orange-600/15' },
  'vehicle maintenance': { Icon: Wrench, tint: 'bg-sky-50 text-sky-700 ring-sky-600/15' },
  'salary payment': { Icon: Users, tint: 'bg-violet-50 text-violet-700 ring-violet-600/15' },
  'emi payment': { Icon: CreditCard, tint: 'bg-rose-50 text-rose-700 ring-rose-600/15' },
  'fastag recharge': { Icon: ReceiptText, tint: 'bg-teal-50 text-teal-700 ring-teal-600/15' },
  'office expense': { Icon: Briefcase, tint: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15' },
  'tax payment': { Icon: Percent, tint: 'bg-amber-50 text-amber-700 ring-amber-600/15' },
  'other expense': { Icon: MoreHorizontal, tint: 'bg-slate-100 text-slate-500 ring-slate-500/10' },
};

const PAYMENT_MODE_GLYPHS: Record<string, PaymentGlyph> = {
  cash: { Icon: Banknote, tint: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  upi: { Icon: Smartphone, tint: 'bg-sky-50 text-sky-700 ring-sky-600/15' },
  neft: { Icon: Landmark, tint: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15' },
  rtgs: { Icon: Landmark, tint: 'bg-violet-50 text-violet-700 ring-violet-600/15' },
  imps: { Icon: Zap, tint: 'bg-amber-50 text-amber-700 ring-amber-600/15' },
  'bank transfer': { Icon: ArrowLeftRight, tint: 'bg-blue-50 text-blue-700 ring-blue-600/15' },
  cheque: { Icon: FileText, tint: 'bg-slate-100 text-slate-600 ring-slate-500/15' },
  check: { Icon: FileText, tint: 'bg-slate-100 text-slate-600 ring-slate-500/15' },
};

/**
 * Keywords cover values that come from the API rather than the master lists
 * above (a farm may record "Farmer Settlement", a vendor "Cash / Counter").
 * Compared after stripping everything non-alphabetic, so casing, spacing and
 * separators never change which glyph is chosen.
 */
const TYPE_KEYWORDS: readonly [keyword: string, glyph: PaymentGlyph][] = [
  ['farmer', PAYMENT_TYPE_GLYPHS['farmer payment']],
  ['farm', PAYMENT_TYPE_GLYPHS['farmer payment']],
  ['fuel', PAYMENT_TYPE_GLYPHS['fuel payment']],
  ['diesel', PAYMENT_TYPE_GLYPHS['fuel payment']],
  ['petrol', PAYMENT_TYPE_GLYPHS['fuel payment']],
  ['maintenance', PAYMENT_TYPE_GLYPHS['vehicle maintenance']],
  ['repair', PAYMENT_TYPE_GLYPHS['vehicle maintenance']],
  ['service', PAYMENT_TYPE_GLYPHS['vehicle maintenance']],
  ['salary', PAYMENT_TYPE_GLYPHS['salary payment']],
  ['payroll', PAYMENT_TYPE_GLYPHS['salary payment']],
  ['staff', PAYMENT_TYPE_GLYPHS['salary payment']],
  ['emi', PAYMENT_TYPE_GLYPHS['emi payment']],
  ['loan', PAYMENT_TYPE_GLYPHS['emi payment']],
  ['fastag', PAYMENT_TYPE_GLYPHS['fastag recharge']],
  ['toll', PAYMENT_TYPE_GLYPHS['fastag recharge']],
  ['tax', PAYMENT_TYPE_GLYPHS['tax payment']],
  ['gst', PAYMENT_TYPE_GLYPHS['tax payment']],
  ['office', PAYMENT_TYPE_GLYPHS['office expense']],
  ['rent', PAYMENT_TYPE_GLYPHS['office expense']],
  ['vehicle', PAYMENT_TYPE_GLYPHS['vehicle maintenance']],
];

const MODE_KEYWORDS: readonly [keyword: string, glyph: PaymentGlyph][] = [
  ['cash', PAYMENT_MODE_GLYPHS.cash],
  ['upi', PAYMENT_MODE_GLYPHS.upi],
  ['qrcode', PAYMENT_MODE_GLYPHS.upi],
  ['neft', PAYMENT_MODE_GLYPHS.neft],
  ['rtgs', PAYMENT_MODE_GLYPHS.rtgs],
  ['imps', PAYMENT_MODE_GLYPHS.imps],
  ['transfer', PAYMENT_MODE_GLYPHS['bank transfer']],
  ['bank', PAYMENT_MODE_GLYPHS['bank transfer']],
  ['cheque', PAYMENT_MODE_GLYPHS.cheque],
  ['check', PAYMENT_MODE_GLYPHS.cheque],
  ['draft', PAYMENT_MODE_GLYPHS.cheque],
];

const normalize = (value: string | undefined | null) => (value ?? '').toLowerCase().replace(/[^a-z]/g, '');

function resolve(
  value: string | undefined | null,
  exact: Record<string, PaymentGlyph>,
  keywords: readonly [string, PaymentGlyph][],
): PaymentGlyph {
  const key = normalize(value);
  if (!key) return NEUTRAL;
  if (exact[key]) return exact[key];
  const matched = keywords.find(([keyword]) => key.includes(keyword));
  return matched ? matched[1] : NEUTRAL;
}

export function paymentTypeGlyph(type: string): PaymentGlyph {
  return resolve(type, PAYMENT_TYPE_GLYPHS, TYPE_KEYWORDS);
}

export function paymentModeGlyph(mode: string): PaymentGlyph {
  return resolve(mode, PAYMENT_MODE_GLYPHS, MODE_KEYWORDS);
}
