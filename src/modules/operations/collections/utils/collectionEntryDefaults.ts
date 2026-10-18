export const DEFAULT_COLLECTION_DATE = "2026-10-05";
export const DEFAULT_COLLECTION_PAYMENT_MODE = "Cash";

function collectorKey(value: string): string {
  return value.toLocaleLowerCase("en-IN").replace(/[^a-z0-9]/g, "");
}

export function orderCollectionCollectors(names: string[]): string[] {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const preferredKey = collectorKey("V. Rangaiah");
  return unique.sort((a, b) => {
    const preferredA = collectorKey(a) === preferredKey ? 0 : 1;
    const preferredB = collectorKey(b) === preferredKey ? 0 : 1;
    return preferredA - preferredB || a.localeCompare(b);
  });
}

export function defaultCollectionCollector(names: string[]): string {
  return orderCollectionCollectors(names)[0] ?? "";
}
