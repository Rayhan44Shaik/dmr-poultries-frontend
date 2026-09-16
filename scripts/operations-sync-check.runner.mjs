// Runs the REAL Operations-module service pipeline through Vite's DEV SSR
// pipeline — identical module graph and env (DEV=true) to `npm run dev`.
// Requires the quarter sample API on CHECK_API_BASE (default 4000), which
// `npm run dev` starts automatically next to Vite.
process.env.NODE_ENV = "development";
process.env.CHECK_API_BASE = process.env.CHECK_API_BASE || "http://127.0.0.1:4000/api";

const { createServer } = await import("vite");
const server = await createServer({
  root: process.cwd(),
  configFile: "vite.config.ts",
  mode: "development",
  logLevel: "warn",
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const mod = await server.ssrLoadModule("/scripts/operations-sync-check.entry.ts");
  await mod.runOperationsSyncCheck();
} finally {
  // server.close() already shuts the HMR websocket down; closing it again
  // would make Vite emit an unhandled "The server is not running" error.
  server.ws.on("error", () => {});
  await server.close();
}
