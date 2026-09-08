import { ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Heavy runtime deps, pre-bundled up-front (at server start) so the first
// browser request never triggers a re-optimization + mid-session reload.
const OPTIMIZE_DEPS = [
  'react',
  'react-dom',
  'react-router-dom',
  'lucide-react',
  'axios',
  'date-fns',
  'localforage',
  'react-select',
  'react-datepicker',
  'react-day-picker',
  'recharts',
  'uuid',
  'file-saver',
  'xlsx',
  'exceljs',
  'jspdf',
  'jspdf-autotable',
  'react-date-range',
]

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: OPTIMIZE_DEPS,
  },
  server: {
    host: true,
    // Allow the sandbox preview host (e.g. <port>-<id>.e2b.app) to connect.
    allowedHosts: ['.e2b.app', 'localhost'],
    // Pre-transform the entry graph at startup so the first request is fast
    // instead of paying for the whole module graph cold.
    warmup: {
      clientFiles: ['./index.html', './src/main.tsx'],
    },
    // Browser-facing code uses a relative /api URL (VITE_API_BASE_URL=/api);
    // Vite reaches the backend on this host, never browser localhost.
    // (Also covers the relative /api/mobile URLs used by mobile code.)
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: false,
        // When the backend is not running, answer /api requests with a clean
        // 502 JSON instead of letting the SPA history fallback return
        // index.html (which would confuse API consumers).
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            if (res instanceof ServerResponse) {
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
    allowedHosts: ['.e2b.app', 'localhost'],
  },
})
