import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config with proxy to forward API requests to backend during development.
export default defineConfig({
  plugins: [react()],
  server: {
    // run dev on a different port if 5173 is busy
    port: 5174,
    proxy: {
      // forward /health to backend to avoid CORS in dev
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // forward API calls under /api to backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

 

