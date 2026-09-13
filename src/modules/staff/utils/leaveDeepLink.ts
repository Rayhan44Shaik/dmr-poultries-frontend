// src/modules/staff/utils/leaveDeepLink.ts
// -----------------------------------------------------------------------------
// LEAVE DEEP LINKS — the contract between "N leaves are waiting" tiles and the
// Leave page they open.
//
// The dashboard's pending-approvals strip and the header bell both send the same
// link, and the Leave page reads it back into its filters, so the three are kept
// in one place instead of repeating a query string that has to agree. The import
// towards the hook is type-only: nothing at runtime is pulled from staff into
// the shell's chunks.
// -----------------------------------------------------------------------------

import type { LeaveFilters } from '../hooks/useLeaveManagement';

/** Staff → Leaves showing exactly the requests that are waiting for a decision. */
export const PENDING_LEAVES_PATH = '/staff?tab=leaves&status=Pending&month=all';

/** The status toggle's own values, in the order the page renders them. */
export const LEAVE_STATUS_VALUES: readonly LeaveFilters['status'][] = [
  'All',
  'Pending',
  'Approved',
  'Rejected',
  'Cancelled',
];

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Read the filters a deep link asks for.
 *
 * `month=all` (or an empty month) means "every month" — the Leave page defaults
 * to the current one, which would hide a request raised in July from the very
 * list you were sent to approve, so a pending queue has to say so explicitly.
 *
 * Anything unrecognised is ignored rather than half-applied: a stray `status`
 * must not silently drop the month that came with it. Returns `undefined` when
 * the link carries nothing usable, so the page opens on its own defaults.
 */
export function leaveFiltersFromSearch(search: string): Partial<LeaveFilters> | undefined {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const month = params.get('month');
  const filters: Partial<LeaveFilters> = {};

  if (status && (LEAVE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as LeaveFilters['status'];
  }
  if (month !== null) {
    if (month === 'all' || month === '') filters.month = '';
    else if (MONTH_PATTERN.test(month)) filters.month = month;
  }

  return Object.keys(filters).length ? filters : undefined;
}
