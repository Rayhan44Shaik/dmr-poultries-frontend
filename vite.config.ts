import { randomUUID } from 'node:crypto'
import { ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fresh on every dev-server (re)start. Injected into every transformed
// module (see the `dmr-instance-stamp` plugin below) so a running tab can
// tell when the server serving its port is a *different* instance than the
// one that served its modules — i.e. the dev server restarted underneath
// it and the tab is still executing the previous instance's old JS/CSS.
const DMR_INSTANCE_ID = randomUUID()

// Heavy runtime deps, pre-bundled up-front (at server start) so the first
// browser request never triggers a re-optimization + mid-session reload.
const OPTIMIZE_DEPS = [
  'react',
  'react-dom',
  'react-router-dom',
  'lucide-react',
  'axios',
  'date-fns',
  // Barrel sub-path imported by lazy pages (DatePicker, Staff performance).
  // If it is not pre-bundled here, opening such a page discovers it at
  // runtime → Vite re-optimizes → forces a full reload → the next lazy chunk
  // finds another missing dep → the preview keeps "loading" forever.
  'date-fns/locale',
  'zod',
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
  // Deep subpath imported lazily by the PDF previewer — pre-bundled up-front
  // so opening the Reports pages can never trigger a dependency re-scan (and
  // the "app was updated while this tab was open" full reload) after first load.
  'pdfjs-dist/legacy/build/pdf.mjs',
  'react-date-range',
]

// Browser-facing code uses a relative /api URL (VITE_API_BASE_URL=/api); Vite
// reaches the REAL backend (repo `backend/`, PORT=4000) — never the opt-in
// quarter sample server (scripts/quarter-sample-data.mjs, default port 4100).
// Shared by the dev server AND `vite preview`.
const API_PROXY: Record<string, ProxyOptions> = {
  '/api': {
    target: process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:4000',
    changeOrigin: false,
    // When the backend is not running, answer /api requests with a clean
    // 502 JSON instead of letting the SPA history fallback return
    // index.html (which would confuse API consumers).
    configure: (proxy) => {
      proxy.on('error', (err, _req, res) => {
        if (res instanceof ServerResponse) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'backend_unavailable', message: err.message }))
        }
      })
    },
  },
}

/**
 * Stamps the running tab with the dev-server instance id and serves
 * `GET /__dmr/ping` -> { instance } (no-store). A running tab that polls this
 * and gets an id different from the one baked into its own modules knows the
 * dev server was restarted underneath it and it must reload (its in-memory
 * JS/CSS belong to the previous instance, even though API calls transparently
 * reach the new one). See `InstanceWatchdog`.
 *
 * The stamp ships as a virtual module (not `define`) because Vite 8 does not
 * apply bare-identifier `define` replacements to client (browser) modules in
 * dev — a virtual module is transformed like any other, so it reaches every
 * browser bundle.
 */
const DMR_INSTANCE_VIRTUAL = 'virtual:dmr-instance'
const DMR_INSTANCE_RESOLVED = '\0' + DMR_INSTANCE_VIRTUAL

const dmrInstanceStamp = {
  name: 'dmr-instance-stamp',
  resolveId(id: string) {
    if (id === DMR_INSTANCE_VIRTUAL) return DMR_INSTANCE_RESOLVED
    return null
  },
  load(id: string) {
    if (id === DMR_INSTANCE_RESOLVED) {
      return `export const INSTANCE_ID = ${JSON.stringify(DMR_INSTANCE_ID)};`
    }
    return null
  },
  // Stamps the served HTML with this instance and adds a tiny inline check:
  // the app records the instance it is running (sessionStorage). When a tab
  // reloads and the HTML's instance differs from the recorded one, the
  // recorded value is updated and the page is reloaded once more — so a
  // reload can never land on a mix of a new document and old app code.
  // One extra load maximum (the stored value always converges to the meta).
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: { name: 'dmr-instance', content: DMR_INSTANCE_ID },
        injectTo: 'head-prepend',
      },
      {
        tag: 'script',
        attrs: {},
        children: `(function(){try{var m=document.querySelector('meta[name="dmr-instance"]');var id=m&&m.content;if(!id)return;var K="dmr:instance";var p=null;try{p=sessionStorage.getItem(K)}catch(e){}if(p===null){try{sessionStorage.setItem(K,id)}catch(e){}return}if(p!==id){try{sessionStorage.setItem(K,id)}catch(e){}location.replace(location.href)}}catch(e){}})()`,
        injectTo: 'head-prepend',
      },
    ]
  },
  configureServer(server: { middlewares: { use: (path: string, handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void) => void } }) {
    server.middlewares.use('/__dmr/ping', (_req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ instance: DMR_INSTANCE_ID }))
    })
  },
}

export default defineConfig({
  // History routes are served from the origin root. A relative asset base
  // resolves bundles below the current deep URL after refresh and leaves the
  // static session splash mounted because the application never boots.
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    dmrInstanceStamp,
  ],
  optimizeDeps: {
    include: OPTIMIZE_DEPS,
  },
  server: {
    host: true,
    // Allow the sandbox preview host (e.g. <port>-<id>.e2b.app) to connect.
    allowedHosts: ['.e2b.app', 'localhost'],
    // Pre-transform the entry graph at startup so the first request is fast
    // instead of paying for the whole module graph cold. The auth chain is
    // included on purpose: the sign-in screen is always the first thing a
    // browser needs, and the splash → login handoff must be immediate.
    warmup: {
      clientFiles: [
        './index.html',
        './src/main.tsx',
        './src/App.tsx',
        './src/routes/AuthGate.tsx',
        './src/providers/AuthProvider.tsx',
        './src/modules/auth/LoginPage.tsx',
      ],
    },
    // Also covers the relative /api/mobile URLs used by mobile code.
    proxy: API_PROXY,
    // Playwright traces under tmp/ (and other artefacts) are frequently
    // locked on Windows. Watching them crashes the whole Vite process with
    // EBUSY — never watch them.
    watch: {
      ignored: [
        '**/tmp/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/blob-report/**',
        '**/playwright/.cache/**',
        '**/.scratch/**',
        '**/.auth-session/**',
      ],
    },
  },
  preview: {
    host: true,
    allowedHosts: ['.e2b.app', 'localhost'],
    // Same backend contract as dev: the built bundle is testable end-to-end.
    proxy: API_PROXY,
  },
})
