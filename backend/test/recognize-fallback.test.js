// image-proc(wasm)를 쓸 수 없을 때: 원본 사진을 예전 방식으로 읽어 간판 인식이 계속 동작하는지
// OCR 프로세스는 fork 시 환경변수를 물려받으므로 signRecognizer를 불러오기 전에 설정한다
const path = require('path');
process.env.IMAGE_PROC_WASM = path.join(__dirname, 'no-such-dir', 'calar_imgproc.wasm');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const signRecognizer = require('../services/signRecognizer');
const { startServer, imageForm, corruptPng } = require('./helpers');

let server;
test.before(async () => {
  server = await startServer();
});
test.after(async () => {
  await server.close();
  await signRecognizer.shutdown();
});

test('wasm 파일이 없으면 원본 사진으로 인식 (예전 방식)', async () => {
  const errors = test.mock.method(console, 'error', () => {});
  try {
    for (const [file, ids, type] of [['1_kalguksu.png', [1], 'image/png'], ['2_laundry.jpg', [2], 'image/jpeg']]) {
      const buffer = fs.readFileSync(path.join(__dirname, 'fixtures', 'signs', file));
      const res = await server.request('POST', '/api/stores/recognize', { body: imageForm(buffer, { type, filename: file }) });
      assert.equal(res.status, 200, file);
      assert.deepEqual(res.body.stores.map((s) => s.id), ids, file);
    }
    const broken = await server.request('POST', '/api/stores/recognize', { body: imageForm(corruptPng()) });
    assert.deepEqual([broken.status, broken.body], [400, { error: 'Invalid image file' }]);
  } finally {
    errors.mock.restore();
  }
});
