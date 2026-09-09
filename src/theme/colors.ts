/**
 * =============================================================================
 * SEMANTIC COLOUR REFERENCE (JS mirror of `src/styles/tokens.css`)
 * =============================================================================
 * For the rare case where a colour must be a JS value rather than a class —
 * chart series, canvas/PDF drawing, `react-select` inline styles, or an
 * SVG `fill` that cannot take a CSS variable.
 *
 * THIS FILE WAS PREVIOUSLY WRONG: it declared `primary: '#2563eb'` (blue) while
 * the application's actual brand is deep emerald. Nothing imported it, so the
 * only effect was to mislead the next developer into painting a module blue.
 *
 * The values below match the canonical Tailwind palette the tokens resolve to,
 * so a JS colour and a class colour can never disagree.
 *
 * POLICY — one meaning, one family:
 *   primary / success  emerald   (brand)
 *   danger / error     rose      (NEVER red-* or orange-*)
 *   warning            amber     (NEVER orange-* or yellow-*)
 *   info               sky
 *   neutral            slate     (NEVER gray-*)
 *
 * For styling, always prefer the semantic class tokens in
 * `src/shared/ui/uiTokens.ts` over these literals.
 * ===========================================================================*/

export const colors = {
  /** Brand / primary action. emerald-600. */
  primary: '#059669',
  primaryHover: '#047857',
  primaryActive: '#065f46',
  primarySoft: '#ecfdf5',

  /** Positive outcome. Same family as the brand. emerald-600. */
  success: '#059669',
  successSoft: '#ecfdf5',

  /** Destructive / error. rose-600 — the canonical destructive colour. */
  danger: '#e11d48',
  dangerHover: '#be123c',
  dangerSoft: '#fff1f2',

  /** Needs attention. amber-600. */
  warning: '#d97706',
  warningSoft: '#fffbeb',

  /** Informational accent. sky-600. */
  info: '#0284c7',
  infoSoft: '#f0f9ff',

  /** Neutral chrome. slate. */
  secondary: '#64748b',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  borderSubtle: '#f1f5f9',
  dark: '#0f172a',
  light: '#f8fafc',

  /** Surfaces, darkest → lightest. */
  surfaceApp: '#f8fafc',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#f1f5f9',

  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#64748b',
    faint: '#94a3b8',
    disabled: '#94a3b8',
    inverse: '#ffffff',
  },
} as const;

/** Semantic alias, for call sites that read better as `semantic.danger`. */
export const semantic = {
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
  neutral: colors.secondary,
} as const;

export type SemanticColor = keyof typeof semantic;

export default colors;
