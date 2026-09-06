import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    // Allow the sandbox preview host (e.g. <port>-<id>.e2b.app) to connect.
    allowedHosts: true,
    // Browser-facing code uses a relative /api URL (VITE_API_BASE_URL=/api);
    // Vite reaches the backend on this host, never browser localhost.
    // (Also covers the relative /api/mobile URLs used by mobile code.)
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://127.0.0.1:4000",
        changeOrigin: false,
        // When the backend is not running, answer /api requests with a clean
        // 502 JSON instead of letting the SPA history fallback return
        // index.html (which would confuse API consumers).
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            if (res && "writeHead" in res && typeof res.writeHead === "function") {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "backend_unavailable", message: err.message }));
            }
          });
        },
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
