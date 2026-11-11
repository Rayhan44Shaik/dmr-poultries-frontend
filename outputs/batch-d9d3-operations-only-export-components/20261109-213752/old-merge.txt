/** Visible diesel rows: submitted/active sheet slots, plus empty rows the user
 *  explicitly opened with + Add Diesel Entry. Never keep a phantom slot 1 after
 *  a remount when bills already live on 2, 3, 4 (delete-then-re-add). */
export function mergeVisibleDieselRows(
  prev: number[],
  activeFromSheet: number[],
  keepEmpty: ReadonlySet<number>
): number[] {
  const draftOnly = prev.filter(
    (n) => n >= 1 && !activeFromSheet.includes(n) && keepEmpty.has(n)
  );
  const next = Array.from(new Set([...activeFromSheet, ...draftOnly])).sort((a, b) => a - b);
  return next.length > 0 ? next : [1];
}
