import type {
  ShopSale,
  ShopSaleSummary,
  ShopSaleFilter
} from "../types/shopSale";

/* =========================================
   Filter Shop Sales
========================================= */

/**
 * Client-side safety-net filter for the Shop Sales list. The backend
 * already applies fromDate/toDate/search via the API; this pass keeps the
 * in-memory list correct across fetch races and applies the shop-name filter
 * locally (the full list is loaded, so this is instant). The API response
 * order is retained because Shop Sales no longer offers sorting controls.
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