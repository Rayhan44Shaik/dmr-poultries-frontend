import type {
  ShopSale,
  ShopSaleSummary,
  ShopSaleFilter
} from "../types/shopSale";

/* =========================================
   Filter Shop Sales
========================================= */

/**
 * Client-side safety-net filter/sort for the Shop Sales list. The backend
 * already applies fromDate/toDate/search via the API; this pass keeps the
 * in-memory list correct across fetch races and applies the shop-name filter
 * and the sort order locally (the full list is loaded, so this is instant).
 *
 * Sort keys mirror the backend whitelist:
 *   latest | oldest | shop_asc | shop_desc | amount_desc | amount_asc
 */
export function filterShopSales(

  sales: ShopSale[],

  filter: ShopSaleFilter

): ShopSale[] {

  let data = [...sales];

  /* Date From */

  if (filter.fromDate) {

    data = data.filter(

      x => x.tripDate >= filter.fromDate

    );

  }

  /* Date To */

  if (filter.toDate) {

    data = data.filter(

      x => x.tripDate <= filter.toDate

    );

  }

  /* Shop */

  if (

    filter.shopName.trim() !== "" &&

    filter.shopName !== "All Shops"

  ) {

    const search = filter.shopName.toLowerCase();

    data = data.filter(

      x =>

        x.shopName.toLowerCase().includes(search)

    );

  }

  /* Search — Shop Sales No, Shop Name, Trip No (and remarks, like the
     backend ILIKE). Applied again locally as a safety net; the server is
     the primary enforcer. */

  const query = filter.search.trim().toLowerCase();

  if (query !== "") {

    data = data.filter((x) => {

      const saleNo = String(x.saleNo ?? "").toLowerCase();
      const tripNo = String(x.tripNo ?? "").toLowerCase();
      const shopName = String(x.shopName ?? "").toLowerCase();
      const remark = String(x.remark ?? "").toLowerCase();
      return (
        saleNo.includes(query) ||
        tripNo.includes(query) ||
        shopName.includes(query) ||
        remark.includes(query)
      );
    });

  }

  /* Sorting */

  const byDate = (a: ShopSale, b: ShopSale, dir: 1 | -1) => {
    const cmp = String(a.tripDate || "").localeCompare(String(b.tripDate || ""));
    return cmp === 0 ? dir : cmp * dir;
  };

  switch (filter.sortBy) {

    case "oldest":

      data.sort((a, b) => byDate(a, b, 1));

      break;

    case "trip_asc":
      data.sort((a, b) => String(a.tripNo).localeCompare(String(b.tripNo), undefined, { numeric: true }) || byDate(b, a, 1));
      break;

    case "trip_desc":
      data.sort((a, b) => String(b.tripNo).localeCompare(String(a.tripNo), undefined, { numeric: true }) || byDate(b, a, 1));
      break;

    case "shop_asc":
      data.sort((a, b) => a.shopName.localeCompare(b.shopName) || byDate(b, a, 1));
      break;

    case "shop_desc":
      data.sort((a, b) => b.shopName.localeCompare(a.shopName) || byDate(b, a, 1));
      break;

    case "birds_desc":
      data.sort((a, b) => (b.totalBirds ?? 0) - (a.totalBirds ?? 0) || byDate(b, a, 1));
      break;

    case "birds_asc":
      data.sort((a, b) => (a.totalBirds ?? 0) - (b.totalBirds ?? 0) || byDate(b, a, 1));
      break;

    case "weight_desc":
      data.sort((a, b) => (b.totalWeight ?? 0) - (a.totalWeight ?? 0) || byDate(b, a, 1));
      break;

    case "weight_asc":
      data.sort((a, b) => (a.totalWeight ?? 0) - (b.totalWeight ?? 0) || byDate(b, a, 1));
      break;

    case "rate_desc":
      data.sort((a, b) => (Number(b.rate) || 0) - (Number(a.rate) || 0) || byDate(b, a, 1));
      break;

    case "rate_asc":
      data.sort((a, b) => (Number(a.rate) || 0) - (Number(b.rate) || 0) || byDate(b, a, 1));
      break;

    case "amount_desc":
      data.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || byDate(b, a, 1));
      break;

    case "amount_asc":
      data.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0) || byDate(b, a, 1));
      break;

    case "remark_asc":
      data.sort((a, b) => String(a.remark ?? "").localeCompare(String(b.remark ?? "")) || byDate(b, a, 1));
      break;

    case "remark_desc":
      data.sort((a, b) => String(b.remark ?? "").localeCompare(String(a.remark ?? "")) || byDate(b, a, 1));
      break;

    case "latest":

    default:

      data.sort((a, b) => byDate(b, a, 1));

  }

  return data;

}

/* =========================================
   Pagination (page slice)
========================================= */

export function paginateSales<T>(sales: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.floor(pageSize) || 1);
  const start = (safePage - 1) * safeSize;
  return sales.slice(start, start + safeSize);
}

/* =========================================
   Summary Cards
========================================= */

export function calculateSummary(

  sales: ShopSale[]

): ShopSaleSummary {

  const totalBirds = sales.reduce(

    (sum, x) => sum + x.totalBirds,

    0

  );

  const totalWeight = sales.reduce(

    (sum, x) => sum + x.totalWeight,

    0

  );

  const totalAmount = sales.reduce(

    (sum, x) => sum + x.amount,

    0

  );

  const totalShops =

    new Set(

      sales.map(

        x => x.shopName

      )

    ).size;

  const validRates = sales.filter(

    x => x.rate !== null

  );

  const averageRate =

    validRates.length === 0

      ? 0

      : validRates.reduce(

          (sum, x) =>

            sum + (x.rate ?? 0),

          0

        ) / validRates.length;

  const averageWeightPerBird =

    totalBirds === 0

      ? 0

      : totalWeight / totalBirds;

  return {

    totalBirds,

    totalShops,

    totalWeight,

    totalAmount,

    averageRate,

    averageWeightPerBird

  };

}

/* =========================================
   Viewing Summary
========================================= */

export function getViewingSummary(

  filter: ShopSaleFilter

): string {

  const items: string[] = [];

  if (

    filter.fromDate ||

    filter.toDate

  ) {

    items.push(

      `Date : ${filter.fromDate || "--"} → ${filter.toDate || "--"}`

    );

  }

  if (

    filter.shopName &&

    filter.shopName !== "All Shops"

  ) {

    items.push(

      `Shop : ${filter.shopName}`

    );

  }

  return items.join("   |   ");

}