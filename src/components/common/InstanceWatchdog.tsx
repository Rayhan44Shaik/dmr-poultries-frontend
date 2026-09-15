// The preview server can reload modules through Vite HMR without blocking the
// dashboard with a stale-tab modal. Keep this component as a compatibility
// no-op for existing imports; the dashboard remains visible while the latest
// modules are applied.

export default function InstanceWatchdog() {
  return null;
}
