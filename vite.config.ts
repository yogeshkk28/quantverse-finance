import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['lightweight-charts', 'recharts'],
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
