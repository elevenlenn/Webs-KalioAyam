import { defineConfig } from 'vite';
import { VIDEO_WATCH_URL } from './src/scripts/video-config.js';

// Injects URLs derived from VIDEO_ID into index.html so the "Tonton di YouTube"
// link works even before (or without) JavaScript.
const videoUrlsPlugin = () => ({
  name: 'kalio-video-urls',
  transformIndexHtml: (html) => html.replaceAll('%VIDEO_WATCH_URL%', VIDEO_WATCH_URL),
});

export default defineConfig({
  plugins: [videoUrlsPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
  build: {
    target: 'esnext',
  },
});
