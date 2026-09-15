// Type declaration for the `virtual:dmr-instance` module provided by the
// `dmr-instance-stamp` Vite plugin (vite.config.ts). It exports the
// dev-server instance id that served the currently running tab, used by
// InstanceWatchdog to detect a server restart underneath an open tab.
declare module 'virtual:dmr-instance' {
  export const INSTANCE_ID: string;
}
