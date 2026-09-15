// Runs the CollectionsPie SSR render check through Vite's DEV SSR pipeline.
process.env.NODE_ENV = "development";
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
  const mod = await server.ssrLoadModule("/scripts/collections-pie-render-check.entry.tsx");
  await mod.runPieRenderCheck();
} finally {
  await server.close();
}
