import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 같은 와이파이의 휴대폰에서 접속 테스트할 때 필요
  },
});
