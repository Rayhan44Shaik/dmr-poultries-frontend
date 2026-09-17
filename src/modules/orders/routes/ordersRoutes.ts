// src/modules/orders/routes/ordersRoutes.ts
// -----------------------------------------------------------------------------
// The Orders module's OWN route table: one entry per page, in workflow order
// (collect the orders → assign them to vehicles → track the delivery).
//
// It is the single source of truth consumed by:
//   • `src/routes/navigation.ts`      — the sidebar rows, rendered as one
//                                        "Orders" group under Operations
//   • `src/modules/operations/pages/OperationsPages.tsx` — mounts the Orders
//                                        workspace for ORDERS_ROUTE_BASE/*
//   • `pages/OrdersPage.tsx`          — which page the current URL selects
//   • `src/ui/Sidebar/navMotion.ts`   — the icon motion for each destination
//
// AppRoutes matches the whole section on one splat (`/operations/*`), so adding
// a page here is enough to make its URL real — no router edit needed.
//
// Orders lives under `/operations` in the URL (it is an operational flow that
// hands off to Trip Entry / Shop Sales) while its CODE is its own module, so
// the pages stay independent of the operations hub's `?tab=` scheme.
// -----------------------------------------------------------------------------

import { Boxes, Inbox, Route, type LucideIcon } from 'lucide-react';

/** Shared prefix: keeps every Orders URL under the Operations section. */
export const ORDERS_ROUTE_BASE = '/operations/orders';

export type OrdersTab = 'collection' | 'assignment' | 'tracking';

export interface OrdersPageRoute {
  /** Stable key for the page — also the panel id inside the workspace. */
  tab: OrdersTab;
  /** Real, reloadable app route (no query string needed to reach the page). */
  path: string;
  /** Fallback label; `labelKey` wins when a translation exists. */
  label: string;
  /** Sidebar label (see src/i18n en/te dictionaries). */
  labelKey: string;
  /** Browser page title. */
  titleKey: string;
  /** Same glyph the in-page tab strip shows, so nav and page agree. */
  icon: LucideIcon;
  /** Sidebar accent for the row/icon. */
  tone: 'violet' | 'lime' | 'teal';
  /** Command-palette search terms. */
  keywords: string;
}

export const ORDERS_PAGES: readonly OrdersPageRoute[] = [
  {
    tab: 'collection',
    path: `${ORDERS_ROUTE_BASE}/collection`,
    label: 'Order Collection',
    labelKey: 'nav.orderCollection',
    titleKey: 'page_title.orderCollection',
    icon: Inbox,
    tone: 'violet',
    keywords: 'order collection shops pending finish collection birds boxes',
  },
  {
    tab: 'assignment',
    path: `${ORDERS_ROUTE_BASE}/assignment`,
    label: 'Order Assignment',
    labelKey: 'nav.orderAssignment',
    titleKey: 'page_title.orderAssignment',
    icon: Boxes,
    tone: 'lime',
    keywords: 'order assignment vehicle trip supervisor boxes split capacity',
  },
  {
    tab: 'tracking',
    path: `${ORDERS_ROUTE_BASE}/delivery-tracking`,
    label: 'Delivery Tracking',
    labelKey: 'nav.orderDeliveryTracking',
    titleKey: 'page_title.orderDeliveryTracking',
    icon: Route,
    tone: 'teal',
    keywords: 'delivery tracking shop delivered pending whatsapp pdf sheet',
  },
] as const;

/** `/operations/orders/collection` → `collection`. */
export function ordersTabForPath(pathname: string): OrdersTab | null {
  if (!pathname.startsWith(`${ORDERS_ROUTE_BASE}/`)) return null;
  const segment = pathname.slice(ORDERS_ROUTE_BASE.length + 1).split('/')[0];
  return ORDERS_PAGES.find((page) => page.path.split('/').pop() === segment)?.tab ?? null;
}

/** `collection` → `/operations/orders/collection`. */
export function ordersPathForTab(tab: OrdersTab): string {
  return ORDERS_PAGES.find((page) => page.tab === tab)?.path ?? ORDERS_PAGES[0].path;
}
