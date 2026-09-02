// src/modules/operations/orders/components/ordersUiConstants.ts
// Non-component constants shared by the Orders tables. They live in their own
// module so OrdersCommon.tsx exports components only (Fast Refresh rule).

/** Rows-per-page choices offered by every Orders table. */
export const ORDERS_PAGE_SIZES = [10, 15, 20, 25, 30] as const;

/** Default page size for every Orders list (requirement: 10 rows per page). */
export const ORDERS_DEFAULT_PAGE_SIZE = 10;
