import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && !env.VITE_API_BASE_URL) throw new Error('Set VITE_API_BASE_URL in mobileapp/.env before building.');
  return {
    plugins: [react()],
    define: command === 'serve' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : {},
    publicDir: '../frontend/public',
    resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', 'axios'], alias: {
      react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
      'react-router-dom': fileURLToPath(new URL('./node_modules/react-router-dom', import.meta.url)),
      axios: fileURLToPath(new URL('./node_modules/axios', import.meta.url)),
    } },
    server: { fs: { allow: ['..'] }, proxy: { '/api': 'http://localhost:8008' } },
  };
});
