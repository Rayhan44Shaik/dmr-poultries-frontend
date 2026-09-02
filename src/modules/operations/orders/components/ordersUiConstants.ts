// src/modules/operations/orders/components/ordersUiConstants.ts
// Non-component constants shared by the Orders tables. They live in their own
// module so OrdersCommon.tsx exports components only (Fast Refresh rule).

/** Rows-per-page choices offered by every Orders table. */
export const ORDERS_PAGE_SIZES = [10, 25, 50, 100] as const;

/** Default page size for every Orders list (requirement: 10 rows per page). */
export const ORDERS_DEFAULT_PAGE_SIZE = 10;
