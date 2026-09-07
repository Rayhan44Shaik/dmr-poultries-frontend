// Leave records stay authoritative in the leave API. Duty Planner can refresh
// when another staff screen changes one; this does not change approval status.
export const STAFF_LEAVES_CHANGED = 'dmr:staff:leaves-changed';
export function notifyStaffLeavesChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STAFF_LEAVES_CHANGED));
}
