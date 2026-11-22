export interface DropdownReopenOption {
  value: string;
  disabled?: boolean;
}

/**
 * Find the option a dropdown should reveal when reopened. Multi-select values
 * are ordered by interaction, so the last still-valid selection is the most
 * useful anchor. Falls back to the first enabled option.
 */
export function dropdownReopenIndex(
  options: readonly DropdownReopenOption[],
  value: string,
  selectedValues: readonly string[] = [],
): number {
  const preferredValues = selectedValues.length > 0
    ? [...selectedValues].reverse()
    : [value];
  for (const preferred of preferredValues) {
    const index = options.findIndex(
      (option) => option.value === preferred && !option.disabled,
    );
    if (index >= 0) return index;
  }
  return options.findIndex((option) => !option.disabled);
}
