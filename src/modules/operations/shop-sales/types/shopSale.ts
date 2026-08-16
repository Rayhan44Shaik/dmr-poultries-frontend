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

  /**
   * Additive fields carrying the real backend numeric identifiers and
   * lock/window state, alongside the existing string-typed id/tripId/shopId
   * kept for UI/component compatibility (ShopSalesTable's internal state is
   * typed against the string ids). The API service is the only place that
   * should read these — never re-derive eligibility or immutability in a
   * component from anything other than what the backend returned.
   */
  numericId?: number;
  numericTripId?: number | null;
  numericShopId?: number | null;
  mortality?: number;
  birdTypeId?: number | null;
  /** Whether the backend currently allows editing/deleting this sale
   * (Rate Entry locked + within the 10-day window). Backend remains the
   * authority on every actual mutation — this is display-only. */
  editable?: boolean;
  windowExpiresAt?: string | null;
  /** Backend-authoritative Rate Entry lock / 10-day correction state. */
  rateCompleted?: boolean;
  rateLockedAt?: string | null;
  rateLockedBy?: string | null;
  correctionWindowExpired?: boolean;
  correctionWindowClosesAt?: string | null;

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