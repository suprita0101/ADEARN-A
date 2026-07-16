import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@adearn/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  server: {
    // host: true binds to 0.0.0.0 so the dev server is reachable on the LAN
    // (e.g. from a phone at http://<your-ip>:5173) with a plain `npm run dev`.
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
