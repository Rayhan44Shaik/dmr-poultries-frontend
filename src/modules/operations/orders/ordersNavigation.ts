import { isBusinessDate } from '../../../utils/businessDate';
import type { OrdersTab } from './types';

export const ORDER_TABS: OrdersTab[] = ['collection', 'assignment', 'tracking'];

export function resolveOrdersTab(value: string | null): OrdersTab {
  return ORDER_TABS.includes(value as OrdersTab) ? value as OrdersTab : 'collection';
}

export function ordersTabUrl(search: string, tab: OrdersTab): string {
  const params = new URLSearchParams(search);
  params.set('tab', 'orders');
  params.set('orderTab', tab);
  return `/operations?${params}`;
}

export function ordersDay(value: string | null, today: string, days: readonly string[]): string {
  return value && isBusinessDate(value) && value <= today && days.includes(value) ? value : today;
}

