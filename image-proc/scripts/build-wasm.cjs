// image-proc를 WebAssembly로 빌드해 pkg/calar_imgproc.wasm 에 복사한다 (Windows/macOS/Linux 공통)
// 사용: node image-proc/scripts/build-wasm.cjs
// 필요: Rust(rustup) + `rustup target add wasm32-unknown-unknown`
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
execFileSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '--lib'], { cwd: root, stdio: 'inherit' });

const built = path.join(root, 'target', 'wasm32-unknown-unknown', 'release', 'calar_imgproc.wasm');
const dest = path.join(root, 'pkg', 'calar_imgproc.wasm');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(built, dest);
console.log(`${path.relative(process.cwd(), dest)} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
