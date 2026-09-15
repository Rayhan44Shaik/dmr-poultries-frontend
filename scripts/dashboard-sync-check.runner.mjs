// Runs the real dashboard pipeline through Vite's DEV SSR pipeline —
// identical module graph and env (DEV=true) to `npm run dev`.
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
  const mod = await server.ssrLoadModule("/scripts/dashboard-sync-check.entry.ts");
  await mod.runDashboardSyncCheck();
} finally {
  await server.close();
  await server.ws.close();
}
