/**
 * =============================================================================
 * SPACING REFERENCE (JS mirror of `src/styles/tokens.css`)
 * =============================================================================
 * The authoritative spacing scale is the CSS token layer; this mirror exists for
 * the rare case where a spacing value must be a JS number or string — canvas and
 * PDF layout, inline `style` objects, or chart configuration.
 *
 * The scale is the 4px rhythm Tailwind uses (`--spacing: 0.25rem`), so a value
 * taken from here always matches the equivalent `p-*` / `gap-*` utility.
 *
 * Prefer the semantic page/section tokens below over picking a raw step: they
 * are what make every module share one gutter and one section rhythm.
 * ===========================================================================*/

/** Raw 4px spacing scale. `spacing[4] === 1rem === Tailwind's `p-4`. */
export const spacing = {
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

/**
 * Semantic layout spacing — mirrors the `--ds-page-*` / `--ds-space-*` tokens.
 * These are the values a page should reach for, rather than choosing a raw step.
 */
export const layout = {
  /** Horizontal page gutter (responsive; the CSS token is authoritative). */
  pagePaddingX: 'var(--ds-page-pad-x)',
  /** Vertical page gutter (responsive). */
  pagePaddingY: 'var(--ds-page-pad-y)',
  /** Vertical rhythm between page sections. */
  sectionGap: 'var(--ds-page-section-gap)',
  /** Padding inside a card / panel body. */
  cardPadding: spacing[4],
  /** Gap between form fields. */
  fieldGap: spacing[3],
  /** Gap between buttons in an action cluster. */
  actionGap: spacing[2],
} as const;

/** Control heights, mirroring `--ds-control-h-*`. */
export const controlHeights = {
  /** 28px — dense in-table action. */
  xs: '1.75rem',
  /** 32px — compact button, pagination, icon-only. */
  sm: '2rem',
  /** 36px — default button, dialog actions. */
  md: '2.25rem',
  /** 40px — toolbar row: search, filters, exports. */
  lg: '2.5rem',
} as const;

export default spacing;
