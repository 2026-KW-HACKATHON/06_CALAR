import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  define: mode === 'production' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : {},
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8008',
    },
    host: true, // 같은 와이파이의 휴대폰에서 접속 테스트할 때 필요
  },
}));
