// src/modules/staff/utils/leaveDisplay.ts
// -----------------------------------------------------------------------------
// LEAVE DISPLAY COPY — the one place that decides how a stored leave value is
// shown to the user.
//
// The database (and the API contract) keep working values in English: a leave
// type is always `Casual | Sick | Emergency | Annual`, a status is always
// `Pending | Approved | Rejected | Cancelled`. Only the LABEL follows the
// language switch, so filtering, patching and printing never depend on the
// display language — and a Telugu page still searches English data.
// -----------------------------------------------------------------------------

import { translateStatus, type Language } from '../../../i18n';

export type LeaveTranslator = (key: string, params?: Record<string, string | number>) => string;

/** Alias kept short for the call sites below. */
type Translator = LeaveTranslator;

/** Long form — filter dropdowns and the request form. */
const TYPE_KEY: Record<string, string> = {
  Casual: 'staff.leave.type.casual',
  Sick: 'staff.leave.type.sick',
  Emergency: 'staff.leave.type.emergency',
  Annual: 'staff.leave.type.annual',
};

/** Short form — the badge inside a table row. */
const BADGE_KEY: Record<string, string> = {
  Casual: 'staff.leave.badge.casual',
  Sick: 'staff.leave.badge.sick',
  Emergency: 'staff.leave.badge.emergency',
  Annual: 'staff.leave.badge.annual',
};

/** `Casual` → "Casual Leave" / "సాధారణ సెలవు"; unknown values pass through. */
export function leaveTypeLabel(t: Translator, type: string): string {
  const key = TYPE_KEY[type];
  return key ? t(key) : type;
}

/** `Casual` → "Casual" / "సాధారణ" (badge-sized). */
export function leaveTypeBadge(t: Translator, type: string): string {
  const key = BADGE_KEY[type];
  return key ? t(key) : type;
}

/** `Pending` → "Pending" / "పెండింగ్"; unknown values pass through. */
export function leaveStatusLabel(t: Translator, status: string): string {
  return translateStatus(t, status);
}

/** Intl locale for month names and dates inside the Leave page. */
export function leaveLocale(language: Language): string {
  return language === 'te' ? 'te-IN' : 'en-IN';
}

/**
 * Month name for a picker cell or trigger.
 * `monthIndex` is 0-based (0 = January), matching `Date#getMonth` and the
 * `YYYY-MM` value the filter stores. Falls back to the numeric month when the
 * runtime has no Telugu month data.
 */
export function leaveMonthName(
  language: Language,
  monthIndex: number,
  style: 'long' | 'short' = 'long',
): string {
  const date = new Date(2000, monthIndex, 1);
  try {
    return date.toLocaleDateString(leaveLocale(language), { month: style });
  } catch {
    return date.toLocaleDateString('en-IN', { month: style });
  }
}
