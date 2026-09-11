/**
 * =============================================================================
 * PAYMENT REGISTER — TYPE & MODE MARKS
 * =============================================================================
 * The two marks that render a payment type and a payment mode. Values (icon +
 * tint) come from `utils/paymentRegisterGlyphs`, which is also where the
 * neutral-glyph-instead-of-brand-logo rule is documented. Every mark is
 * decorative (`aria-hidden`) and always paired with its text label.
 *
 * ONE ICON PER FIELD
 *   A mark owns its own chip, so the host control must NOT add a second
 *   leading icon next to it (a field icon + a mark icon reads as duplication).
 *   Inside the details sheet, "Payment Type" and "Mode" therefore render the
 *   mark alone, while plain text fields keep their leading field icon.
 *
 * The mode mark is deliberately quieter than the type mark (smaller chip,
 * semibold 11px): it is a one-word attribute, not the record's identity.
 * =============================================================================
 */

import { cn } from '../../../../utils/cn';
import { paymentModeGlyph, paymentTypeGlyph, type PaymentGlyph } from '../../utils/paymentRegisterGlyphs';

/**
 * Bare tinted chip, no label: for slots where the host control already renders
 * the text — dropdown option rows, table headers, compact summaries.
 *
 * Radius is derived from the size instead of a fixed utility class, so a chip
 * scaled up for a hero block still reads as the same family of mark and callers
 * never have to fight a corner class out of the list.
 */
export function PaymentGlyphChip({ glyph, size = 18, icon = 11, className }: { glyph: PaymentGlyph; size?: number; icon?: number; className?: string }) {
  const { Icon, tint } = glyph;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: Math.max(5, Math.round(size * 0.3)) }}
      className={cn('inline-flex shrink-0 items-center justify-center ring-1 ring-inset', tint, className)}
    >
      <Icon size={icon} strokeWidth={2.2} />
    </span>
  );
}

/** Chip + label: the register's identifier for a payment type. */
export function PaymentTypeMark({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <PaymentGlyphChip glyph={paymentTypeGlyph(type)} size={22} icon={12} />
      <span className="truncate">{type || '—'}</span>
    </span>
  );
}

/** Chip + label, no pill: one mark, kept quiet so the row stays scannable. */
export function PaymentModeMark({ mode, className }: { mode: string; className?: string }) {
  if (!mode) return <span className="text-slate-400">—</span>;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <PaymentGlyphChip glyph={paymentModeGlyph(mode)} size={18} icon={10} />
      <span className="truncate text-[11px] font-semibold text-slate-600">{mode}</span>
    </span>
  );
}
