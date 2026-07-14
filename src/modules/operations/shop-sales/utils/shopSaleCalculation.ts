import type {
  ShopSale,
  ShopSaleSummary,
  ShopSaleFilter
} from "../types/shopSale";

/* =========================================
   Filter Shop Sales
========================================= */

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

  /* Sorting */

  switch (filter.sortBy) {

    case "Shop":

      data.sort((a, b) =>

        a.shopName.localeCompare(b.shopName)

      );

      break;

    case "Birds":

      data.sort(

        (a, b) =>

          b.totalBirds - a.totalBirds

      );

      break;

    case "Weight":

      data.sort(

        (a, b) =>

          b.totalWeight - a.totalWeight

      );

      break;

    case "Amount":

  data.sort(
  (a, b) => (b.amount ?? 0) - (a.amount ?? 0)
);

      break;

    case "Rate":

      data.sort(

        (a, b) =>

          (b.rate ?? 0) - (a.rate ?? 0)

      );

      break;

    default:

      data.sort(

        (a, b) =>

          b.tripDate.localeCompare(a.tripDate)

      );

  }

  return data;

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