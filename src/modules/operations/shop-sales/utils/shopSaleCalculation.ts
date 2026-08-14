import type { ShopSale, ShopSaleSummary, ShopSaleFilter } from "../types/shopSale";

export function filterShopSales(sales: ShopSale[], filter: ShopSaleFilter): ShopSale[] {
  let data = [...sales];

  if (filter.fromDate) data = data.filter((x) => x.saleDate >= filter.fromDate);
  if (filter.toDate) data = data.filter((x) => x.saleDate <= filter.toDate);
  if (filter.shopName.trim() !== "" && filter.shopName !== "All Shops") {
    const search = filter.shopName.toLowerCase();
    data = data.filter((x) => x.shopName.toLowerCase().includes(search));
  }

  switch (filter.sortBy) {
    case "Shop":
      data.sort((a, b) => a.shopName.localeCompare(b.shopName));
      break;
    case "Birds":
      data.sort((a, b) => b.birds - a.birds);
      break;
    case "Weight":
      data.sort((a, b) => b.weight - a.weight);
      break;
    case "Amount":
      data.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
      break;
    case "Rate":
      data.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
      break;
    default:
      data.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
  }

  return data;
}

export function calculateSummary(sales: ShopSale[]): ShopSaleSummary {
  const totalBirds = sales.reduce((sum, x) => sum + x.birds, 0);
  const totalWeight = sales.reduce((sum, x) => sum + x.weight, 0);
  const totalAmount = sales.reduce((sum, x) => sum + x.amount, 0);
  const totalShops = new Set(sales.map((x) => x.shopName)).size;
  const validRates = sales.filter((x) => x.rate !== null);
  const averageRate =
    validRates.length === 0
      ? 0
      : validRates.reduce((sum, x) => sum + (x.rate ?? 0), 0) / validRates.length;
  const averageWeightPerBird = totalBirds === 0 ? 0 : totalWeight / totalBirds;

  return { totalBirds, totalShops, totalWeight, totalAmount, averageRate, averageWeightPerBird };
}

export function getViewingSummary(filter: ShopSaleFilter): string {
  const items: string[] = [];
  if (filter.fromDate || filter.toDate) {
    items.push(`Date : ${filter.fromDate || "--"} → ${filter.toDate || "--"}`);
  }
  if (filter.shopName && filter.shopName !== "All Shops") {
    items.push(`Shop : ${filter.shopName}`);
  }
  return items.join("   |   ");
}
