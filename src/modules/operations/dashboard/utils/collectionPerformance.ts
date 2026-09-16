export interface CollectionPerformanceDatum {
  shopName: string;
  salesAmount: number;
  collectionAmount: number;
  outstandingAmount: number;
}

export type CollectionPerformanceSort =
  | "outstanding"
  | "sales"
  | "collections"
  | "recoveryHigh"
  | "recoveryLow"
  | "shop";

export interface CollectionPerformanceSummary {
  salesAmount: number;
  collectionAmount: number;
  outstandingAmount: number;
  recoveryPercentage: number;
}

const safeAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const shopKey = (shopName: string): string => shopName.trim().toLocaleLowerCase("en-IN");

export const collectionRecoveryPercentage = (
  row: Pick<CollectionPerformanceDatum, "salesAmount" | "collectionAmount">,
): number => {
  if (row.salesAmount <= 0) return row.collectionAmount > 0 ? 100 : 0;
  return (row.collectionAmount / row.salesAmount) * 100;
};

/**
 * Cleans and merges API rows by shop. A normalized key prevents duplicate chart
 * bars when a source differs only by casing or surrounding whitespace.
 */
export function normalizeCollectionPerformance(
  rows: readonly CollectionPerformanceDatum[] | null | undefined,
): CollectionPerformanceDatum[] {
  const unique = new Map<string, CollectionPerformanceDatum>();

  for (const candidate of rows ?? []) {
    const shopName = String(candidate?.shopName ?? "").trim();
    if (!shopName) continue;
    const key = shopKey(shopName);
    const current = unique.get(key) ?? {
      shopName,
      salesAmount: 0,
      collectionAmount: 0,
      outstandingAmount: 0,
    };
    current.salesAmount += safeAmount(candidate.salesAmount);
    current.collectionAmount += safeAmount(candidate.collectionAmount);
    current.outstandingAmount += safeAmount(candidate.outstandingAmount);
    unique.set(key, current);
  }

  return [...unique.values()];
}

export function summarizeCollectionPerformance(
  rows: readonly CollectionPerformanceDatum[],
): CollectionPerformanceSummary {
  const totals = rows.reduce(
    (summary, row) => ({
      salesAmount: summary.salesAmount + safeAmount(row.salesAmount),
      collectionAmount: summary.collectionAmount + safeAmount(row.collectionAmount),
      outstandingAmount: summary.outstandingAmount + safeAmount(row.outstandingAmount),
    }),
    { salesAmount: 0, collectionAmount: 0, outstandingAmount: 0 },
  );

  return {
    ...totals,
    recoveryPercentage:
      totals.salesAmount > 0 ? (totals.collectionAmount / totals.salesAmount) * 100 : 0,
  };
}

export function sortCollectionPerformance(
  rows: readonly CollectionPerformanceDatum[],
  sort: CollectionPerformanceSort,
): CollectionPerformanceDatum[] {
  return [...rows].sort((a, b) => {
    let difference: number;
    switch (sort) {
      case "sales":
        difference = b.salesAmount - a.salesAmount;
        break;
      case "collections":
        difference = b.collectionAmount - a.collectionAmount;
        break;
      case "recoveryHigh":
        difference = collectionRecoveryPercentage(b) - collectionRecoveryPercentage(a);
        break;
      case "recoveryLow":
        difference = collectionRecoveryPercentage(a) - collectionRecoveryPercentage(b);
        break;
      case "shop":
        return a.shopName.localeCompare(b.shopName, "en-IN");
      case "outstanding":
      default:
        difference = b.outstandingAmount - a.outstandingAmount;
        break;
    }
    return difference || a.shopName.localeCompare(b.shopName, "en-IN");
  });
}
