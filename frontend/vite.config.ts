import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/health': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/rooms': 'http://localhost:8000',
      '/room-types': 'http://localhost:8000',
      '/guests': 'http://localhost:8000',
      '/reservations': 'http://localhost:8000',
      '/room-tasks': 'http://localhost:8000',
      '/dashboard': 'http://localhost:8000',
      '/analytics': 'http://localhost:8000',
      '/finance': 'http://localhost:8000',
      '/exports': 'http://localhost:8000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/echarts/') || id.includes('/node_modules/zrender/')) return 'analytics-charts';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
        }
      }
    }
  }
});
