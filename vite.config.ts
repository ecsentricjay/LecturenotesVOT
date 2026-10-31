import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const groqApiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/groq/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const clientKey = req.headers['x-groq-api-key'];
              const keyToUse = groqApiKey || (typeof clientKey === 'string' ? clientKey : '');
              if (keyToUse) {
                proxyReq.setHeader('Authorization', `Bearer ${keyToUse}`);
              }
            });
          },
        },
        '/api/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/groq/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const clientKey = req.headers['x-groq-api-key'];
              const keyToUse = groqApiKey || (typeof clientKey === 'string' ? clientKey : '');
              if (keyToUse) {
                proxyReq.setHeader('Authorization', `Bearer ${keyToUse}`);
              }
            });
          },
        },
      },
    },
  };
});
