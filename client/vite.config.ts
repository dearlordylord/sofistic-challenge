import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the Nest server so the client can fetch('/api/...')
      '/api': 'http://localhost:3000',
    },
  },
});
