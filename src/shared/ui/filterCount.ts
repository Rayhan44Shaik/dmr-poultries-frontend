/**
 * Count how many filter facets are away from their defaults. Booleans count
 * once when true, numbers add as-is; this keeps every page's arithmetic to one
 * readable line that feeds `<FilterResetButton count={…}>`:
 *
 *   countActiveFilters(query.trim() !== "", status !== "all", !isDefaultRange)
 */
export function countActiveFilters(...flags: Array<boolean | number>): number {
  return flags.reduce<number>(
    (sum, flag) => sum + (typeof flag === "number" ? flag : flag ? 1 : 0),
    0,
  );
}
