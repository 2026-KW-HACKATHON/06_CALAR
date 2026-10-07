import { loadEnv } from 'vite';
import { writeFileSync } from 'node:fs';
const mode = process.argv[2] || 'production';
const env = loadEnv(mode, process.cwd(), '');
let endpoint;
try { endpoint = new URL(env.VITE_API_BASE_URL); } catch { throw new Error('Set VITE_API_BASE_URL in mobileapp/.env'); }
if (!['http:', 'https:'].includes(endpoint.protocol) || (mode === 'production' && endpoint.protocol !== 'https:')) throw new Error('Production mobile apps require an HTTPS API address. Use build:dev for a local HTTP server.');
writeFileSync('capacitor.config.json', JSON.stringify({
  appId: 'kr.calar.app', appName: 'CALAR', webDir: 'dist',
  server: { androidScheme: 'https' },
  android: { allowMixedContent: mode === 'development' },
  ios: { contentInset: 'automatic' },
}, null, 2) + '\n');
