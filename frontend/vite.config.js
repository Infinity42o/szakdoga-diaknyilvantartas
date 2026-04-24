// vite.config.js
import { defineConfig } from 'vite';

// http://localhost:5173  → frontend
// http://localhost:3000  → backend API
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
