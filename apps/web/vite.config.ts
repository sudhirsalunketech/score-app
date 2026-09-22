import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { isSocialCrawler, socialPreviewApiPath } from './vite-crawler-og';

function crawlerOgPlugin(apiOrigin = 'http://localhost:4000') {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, res, next) => {
      if (!isSocialCrawler(req.headers['user-agent']) || !req.url) {
        next();
        return;
      }
      const preview = socialPreviewApiPath(req.url.split('?')[0] ?? req.url);
      if (!preview) {
        next();
        return;
      }
      void fetch(`${apiOrigin}${preview}`)
        .then(async (upstream) => {
          const html = await upstream.text();
          res.statusCode = upstream.ok ? 200 : upstream.status;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(html);
        })
        .catch(() => next());
    });
  };
  return {
    name: 'crawler-og',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), crawlerOgPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@crickscore/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/@tanstack/')) {
            return 'query-vendor';
          }
          if (id.includes('/i18next/') || id.includes('/react-i18next/')) {
            return 'i18n-vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});
