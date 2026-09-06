let revision = 0;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
function notify() { revision++; for (const listener of listeners) listener(); }
function getChannel() {
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('dmr-trip-changes');
    channel.onmessage = () => notify();
  }
  return channel;
}
export const getTripRevision = () => revision;
export function publishTripChange() { notify(); getChannel()?.postMessage({ changed: true }); }
export function subscribeTripChanges(listener: () => void) {
  listeners.add(listener); getChannel();
  return () => { listeners.delete(listener); };
}
