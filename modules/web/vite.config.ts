import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 127.0.0.1, never "localhost": Spotify only accepts loopback IPs as redirect URIs.
// /api goes to the server, so the login callback and the session cookie share one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:2574' },
  },
  preview: {
    host: '127.0.0.1',
    port: 4180,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:2574' },
  },
});
