type CollectionNumberRow = {
  id?: string | number;
  collectionNo?: string | null;
};

function canonicalCollectionNumber(value: string | null | undefined): string {
  return String(value ?? "").trim().toLocaleUpperCase();
}

/** Finds number collisions across the complete register. Status is purposely
 * irrelevant: Pending, Approved, Rejected, and Deleted records share one
 * permanent collection-number namespace. */
export function findDuplicateCollectionNumbers(rows: CollectionNumberRow[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    const number = canonicalCollectionNumber(row.collectionNo);
    if (!number) continue;
    if (seen.has(number)) duplicates.add(number);
    seen.add(number);
  }

  return Array.from(duplicates).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

/** Fail closed instead of presenting two financial records under one number. */
export function assertUniqueCollectionNumbers(rows: CollectionNumberRow[]): void {
  const duplicates = findDuplicateCollectionNumbers(rows);
  if (duplicates.length === 0) return;

  throw new Error(`Duplicate collection number${duplicates.length === 1 ? "" : "s"}: ${duplicates.join(", ")}`);
}
