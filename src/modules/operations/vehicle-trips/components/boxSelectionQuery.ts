/**
 * Expands a Step 4 box-selection entry such as:
 *   44,56,46
 *   46-56
 *   44, 46 to 56, 60
 *
 * Only box numbers present in `availableValues` are returned. The result is
 * de-duplicated and follows the order in which the user entered the groups.
 * An invalid group rejects the whole entry so a typo never partially selects
 * an unexpected set of boxes.
 */
export function parseBoxSelectionQuery(
  input: string,
  availableValues: readonly string[],
): string[] {
  const query = input.trim();
  if (!query) return [];

  const available = new Set(
    availableValues.filter((value) => /^\d+$/.test(value)),
  );
  const selected: string[] = [];
  const seen = new Set<string>();
  const groups = query.split(/[,;]+/).map((part) => part.trim());
  if (groups.some((part) => !part)) return [];

  for (const group of groups) {
    const match = group.match(/^(\d+)\s*(?:(?:to|-)\s*(\d+))?$/i);
    if (!match) return [];
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    const low = Math.min(first, last);
    const high = Math.max(first, last);

    // Iterate available values instead of the numeric span, preventing a
    // mistyped huge range from creating an expensive loop.
    const matches = [...available]
      .map(Number)
      .filter((value) => value >= low && value <= high)
      .sort((a, b) => (first <= last ? a - b : b - a));
    for (const value of matches) {
      const key = String(value);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(key);
    }
  }

  return selected;
}
