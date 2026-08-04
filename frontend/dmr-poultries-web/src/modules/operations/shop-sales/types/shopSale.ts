export interface ShopSale {

  id: string;

  tripId: string;

  tripNo: string | number;

  tripDate: string;

  shopId: string;

  shopName: string;

  birdType: string;

  totalBirds: number;

  totalWeight: number;

  rate: number | null;
amount: number;
  remark: string;

  status: "Pending" | "Completed";

}

export interface ShopSaleSummary {

  totalBirds: number;

  totalShops: number;

  totalWeight: number;

  totalAmount: number;

  averageRate: number;

  averageWeightPerBird: number;

}

export interface ShopSaleFilter {

  fromDate: string;

  toDate: string;

  shopName: string;

  sortBy: string;

}