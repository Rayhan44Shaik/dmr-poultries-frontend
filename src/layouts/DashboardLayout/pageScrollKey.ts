/**
 * Which *page* a URL shows — the key the app shell scrolls to top on.
 *
 * A path change is a page change. So is `?tab=`, because the hub sections
 * (/operations, /masters, /staff, /fleet, /accounts, /reports, /settings) render
 * a different page per tab while the path stays put. Everything else in the
 * query is state *inside* the page — a picked date, a search box, a page number,
 * `?demo=1` — and must never throw the view back to the top.
 *
 * Modules that own real routes (Orders: /operations/orders/assignment) need
 * nothing here: their path already carries the page.
 */
export function pageScrollKey(pathname: string, search = ""): string {
  const tab = new URLSearchParams(search).get("tab");
  return tab ? `${pathname}?tab=${tab}` : pathname;
}
