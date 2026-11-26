import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isGhPages = process.env.VITE_GH_PAGES === 'true';

export default defineConfig({
  base: isGhPages ? '/BUDAYAGO/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
