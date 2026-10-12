import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/youtube': {
        target: 'https://www.googleapis.com/youtube/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/youtube/, ''),
        headers: {
          'Referer': 'http://localhost:5173/',
        },
      },
    },
  },
});
