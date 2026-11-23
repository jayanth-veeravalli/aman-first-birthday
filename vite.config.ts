import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Set by `npm run local`: the local Supabase API, proxied so the page only talks to its own origin
// (needed when the dev site is shared through an ngrok tunnel).
const localApi = process.env.LOCAL_SUPABASE_API;

export default defineConfig({
  base: process.env.BASE_PATH || '/aman-first-birthday/',
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'],
    proxy: localApi ? { '/rest/v1': { target: localApi, changeOrigin: true } } : undefined,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        responses: resolve(import.meta.dirname, 'responses.html'),
      },
    },
  },
});
