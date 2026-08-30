import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    open: false,
    // Proxy /api requests to the local backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Emit source maps in production for easier debugging
    sourcemap: false,
    // Increase chunk warning threshold — LinkedIn profile data can be large
    chunkSizeWarningLimit: 800,
  },
});
