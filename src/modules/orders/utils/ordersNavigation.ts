// Orders navigation contract.
//
// Each Orders page is a real route owned by the module (see routes/ordersRoutes.ts),
// so the active page comes from the PATH — `?tab=` is no longer how Orders pages
// are addressed. The old `?tab=orders&orderTab=x` form is still accepted and
// canonicalised to the path, which keeps every pre-existing deep link working.
import { isBusinessDate } from '../../../utils/businessDate';
import {
  ORDERS_PAGES,
  ordersPathForTab,
  ordersTabForPath,
  type OrdersTab,
} from '../routes/ordersRoutes';

export type { OrdersTab };

export const ORDER_TABS: OrdersTab[] = ['collection', 'assignment', 'tracking'];

/** Path wins; a bare/legacy `?orderTab=` value is the fallback; anything
 *  unknown resolves to the first page so a URL can never render a blank panel. */
export function resolveOrdersTab(pathname: string, search = ''): OrdersTab {
  const fromPath = ordersTabForPath(pathname);
  if (fromPath) return fromPath;
  const legacy = new URLSearchParams(search).get('orderTab');
  return ORDER_TABS.includes(legacy as OrdersTab) ? (legacy as OrdersTab) : 'collection';
}

/** Keep the operational state (selected days, demo flag, filters) and drop the
 *  params that the path now carries. */
export function ordersQueryForPath(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('tab');
  params.delete('orderTab');
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** URL of one Orders page, preserving unrelated query parameters. */
export function ordersTabUrl(search: string, tab: OrdersTab): string {
  return `${ordersPathForTab(tab)}${ordersQueryForPath(search)}`;
}

/** Legacy `?tab=orders[&orderTab=x]` deep link → the canonical Orders URL. */
export function ordersCanonicalUrl(pathname: string, search: string): string {
  return ordersTabUrl(search, resolveOrdersTab(pathname, search));
}

/** An operational day must be a real calendar day inside the available window
 *  and never in the future — otherwise fall back to today. */
export function ordersDay(value: string | null, today: string, days: readonly string[]): string {
  return value && isBusinessDate(value) && value <= today && days.includes(value) ? value : today;
}

/** Panel/tab order used by the workspace strip and the keyboard roving focus. */
export const ORDERS_TAB_ORDER: OrdersTab[] = ORDERS_PAGES.map((page) => page.tab);
