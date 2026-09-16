export const SHOP_DATA_CHANGED_EVENT = "dmr:shop-data-changed";

/** Same signal, but delivered to a user's OTHER browser tabs as well. */
const CHANNEL_NAME = "dmr:shop-data";

export type ShopDataChangeReason =
  | "approved"
  | "rejected"
  | "deleted"
  | "created"
  | "updated";

export interface ShopDataChangedDetail {
  /** Numeric shop id, when the emitter knows it. */
  shopId?: number | null;
  /** Shop name, so a filtered view can decide whether it cares. */
  shopName?: string | null;
  reason: ShopDataChangeReason;
  /** Which screen performed the write — useful for logs and future gating. */
  source: "collection-entry" | "pending-collections" | "shop-master";
}

/** Lazily-created channel; absent in non-browser (test/SSR) environments. */
let channel: BroadcastChannel | null | undefined;
function shopChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (channel === undefined) {
    try {
      channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL_NAME) : null;
    } catch {
      channel = null;
    }
  }
  return channel;
}

/**
 * Announce that a shop's balance (and therefore its ledger) has changed.
 *
 * The event fires in this window AND on every other tab the user has open:
 * approving a collection in one tab must not leave a stale balance sitting in
 * another. Receivers only ever refetch, so the extra hop cannot invent data.
 */
export function notifyShopDataChanged(detail: ShopDataChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ShopDataChangedDetail>(SHOP_DATA_CHANGED_EVENT, { detail }));
  try {
    shopChannel()?.postMessage(detail);
  } catch {
    /* a closed channel is not an error worth surfacing */
  }
}

/**
 * Subscribe to balance changes — same-window and cross-tab. Returns the
 * unsubscribe function so callers can drop both listeners from a `useEffect`
 * cleanup.
 */
export function onShopDataChanged(
  handler: (detail: ShopDataChangedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<ShopDataChangedDetail>).detail);
  };
  window.addEventListener(SHOP_DATA_CHANGED_EVENT, listener);

  const bc = shopChannel();
  const onMessage = (event: MessageEvent<ShopDataChangedDetail>) => {
    if (event.data) handler(event.data);
  };
  bc?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener(SHOP_DATA_CHANGED_EVENT, listener);
    bc?.removeEventListener("message", onMessage);
  };
}
