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
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
