import type { BulkImportConfig } from "../components/bulk-import/bulkImportTypes";
import type { Shop } from "./types/shop";

type Row = { shopNumber: string; shopName: string; openingBalance: number };

export function buildOpeningBalanceImportConfig(deps: {
  update: (rows: Row[]) => Promise<unknown>;
  reload: () => Promise<unknown>;
}): BulkImportConfig<Row, Shop> {
  return {
    title: "Import Shop Opening Balances",
    subtitle: "Updates opening balances only for shops that already exist",
    noun: "Opening Balance",
    nounPlural: "Opening Balances",
    filenamePrefix: "Shop_Opening_Balances",
    columns: [
      { key: "Shop Number", sample: "SHOP-000001" },
      { key: "Shop Name", sample: "RAMESH CHICKEN SHOP" },
      { key: "Opening Balance", required: true, sample: "12000" },
    ],
    parseRow: (record) => ({
      shopNumber: String(record["Shop Number"] ?? "").trim(),
      shopName: String(record["Shop Name"] ?? "").trim(),
      openingBalance: Number(record["Opening Balance"]),
    }),
    validateRow: (row) => {
      const errors: string[] = [];
      if (!row.shopNumber && !row.shopName) errors.push("Shop Number or Shop Name is required.");
      if (!Number.isFinite(row.openingBalance)) errors.push("Opening Balance must be a valid number.");
      return errors;
    },
    duplicateKey: (row) => `${row.shopNumber.toLowerCase()}|${row.shopName.toLowerCase()}`,
    toPayload: (row) => row,
    createMany: async (rows, onProgress) => {
      const total = rows.length;
      onProgress(0, total);
      try {
        await deps.update(rows.map((row) => row.data));
        onProgress(total, total);
        return { total, attempted: total, imported: total, failed: 0, errors: [] };
      } catch (error) {
        onProgress(total, total);
        return { total, attempted: total, imported: 0, failed: total, errors: [{ row: 0, message: error instanceof Error ? error.message : "Opening balance import failed." }] };
      }
    },
    refresh: deps.reload,
    errorToString: (error) => error instanceof Error ? error.message : "Opening balance import failed.",
  };
}
