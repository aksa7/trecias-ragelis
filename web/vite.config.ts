import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the dashboard runs on :5173 and forwards /events to the
// backend, so the browser never needs CORS. In production the backend serves
// the built files from web/dist on the same origin.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/events': { target: BACKEND, changeOrigin: true },
    },
  },
});
