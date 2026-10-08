// 서버 실행(index.js) 테스트: 정상 실행 + OCR 미리 준비, 포트 충돌 시 안내 후 종료
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('node:os');
const net = require('net');
const { spawn } = require('child_process');
const { once } = require('events');

const INDEX = path.join(__dirname, '..', 'index.js');

// 비어있는 포트 하나 얻기
async function freePort() {
  const srv = net.createServer().listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const { port } = srv.address();
  await new Promise((resolve) => srv.close(resolve));
  return port;
}

// 출력에 pattern이 나올 때까지 기다린다
function waitForOutput(proc, pattern, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${pattern}\n${out}`)), timeoutMs);
    const onData = (chunk) => {
      out += chunk;
      if (pattern.test(out)) {
        clearTimeout(timer);
        resolve(out);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
  });
}

test('npm start: 서버가 뜨고 OCR이 미리 준비된다', async () => {
  const port = await freePort();
  const proc = spawn(process.execPath, [INDEX], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      CALAR_DB_PATH: path.join(os.tmpdir(), `06-calar-server-test-${process.pid}.sqlite`),
      CALAR_ADMIN_EMAIL: 'test-admin@calar.local',
      CALAR_ADMIN_PASSWORD: 'test-admin-password-2026',
    },
  });
  try {
    await waitForOutput(proc, /간판 인식\(OCR\) 준비 완료/);
    const res = await fetch(`http://127.0.0.1:${port}/api/stores/1`);
    assert.equal(res.status, 200);
  } finally {
    proc.kill();
    await once(proc, 'exit');
  }
});

test('포트가 이미 사용 중이면 안내 메시지를 내고 종료 코드 1', async () => {
  const blocker = net.createServer().listen(0, '127.0.0.1');
  await once(blocker, 'listening');
  const { port } = blocker.address();
  try {
    const proc = spawn(process.execPath, [INDEX], {
      env: {
        ...process.env,
        PORT: String(port),
      HOST: '127.0.0.1',
        CALAR_DB_PATH: path.join(os.tmpdir(), `06-calar-server-test-${process.pid}.sqlite`),
        CALAR_ADMIN_EMAIL: 'test-admin@calar.local',
        CALAR_ADMIN_PASSWORD: 'test-admin-password-2026',
      },
    });
    const output = waitForOutput(proc, /이미 사용 중/);
    const [code] = await once(proc, 'exit');
    assert.match(await output, new RegExp(`포트 ${port}번이 이미 사용 중`));
    assert.equal(code, 1);
  } finally {
    blocker.close();
  }
});
