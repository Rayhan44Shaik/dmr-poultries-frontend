import assert from "node:assert/strict";
import test from "node:test";
import { buildOpeningBalanceImportConfig } from "./openingBalanceImportConfig";
import type { Shop } from "./types/shop";

const shop = (
  shopNo: number,
  shopNumber: string,
  shopName: string,
  openingBalance: number,
  status: Shop["status"] = "Active",
): Shop =>
  ({ shopNo, shopNumber, shopName, openingBalance, status }) as Shop;

test("opening balance template lists only active shops alphabetically with a blank balance to fill", async () => {
  const config = buildOpeningBalanceImportConfig({
    update: async () => undefined,
    reload: async () => undefined,
    listShops: async () => [
      shop(105, "SHOP-000105", "Zoya Chicken Centre", 950),
      shop(12, "SHOP-000012", "amma Chicken Shop", 125),
      shop(2, "SHOP-000002", "Amma Chicken Shop", 75),
      shop(30, "SHOP-000030", "Bismillah Chicken Shop", 0),
      shop(20, "SHOP-000020", "Closed Chicken Shop", 300, "Inactive"),
    ],
  });

  assert.deepEqual(await config.getTemplateRows?.(), [
    {
      "Shop Number": "SHOP-000002",
      "Shop Name": "Amma Chicken Shop",
      "Opening Balance": "",
    },
    {
      "Shop Number": "SHOP-000012",
      "Shop Name": "amma Chicken Shop",
      "Opening Balance": "",
    },
    {
      "Shop Number": "SHOP-000030",
      "Shop Name": "Bismillah Chicken Shop",
      "Opening Balance": "",
    },
    {
      "Shop Number": "SHOP-000105",
      "Shop Name": "Zoya Chicken Centre",
      "Opening Balance": "",
    },
  ]);
});
