// 언어 데이터를 읽을 수 없는 상황 → 503, 서버는 계속 동작, 멈춘 OCR 프로세스는 정리됨
// (연결 안 되는 주소를 언어 데이터 위치로 지정해서 흉내. tesseract.js는 이때 에러 없이 영원히 대기한다)
process.env.OCR_LANG_PATH = 'http://127.0.0.1:9';
process.env.OCR_INIT_TIMEOUT_MS = '3000';

const test = require('node:test');
const assert = require('node:assert/strict');
const signRecognizer = require('../services/signRecognizer');
const { startServer, imageForm, whitePng } = require('./helpers');

let server;
test.before(async () => {
  server = await startServer();
});
test.after(async () => {
  await server.close();
  await signRecognizer.shutdown();
});

test('OCR 준비 실패 → 503, 다른 API는 정상, 다음 요청 때 다시 시도', async () => {
  for (let i = 0; i < 2; i++) {
    const res = await server.request('POST', '/api/stores/recognize', { body: imageForm(whitePng()) });
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: 'Sign recognition is temporarily unavailable' });
  }
  assert.equal((await server.request('GET', '/api/stores')).status, 200);
  // text로 OCR을 건너뛰는 경로는 영향 없음
  const res = await server.request('POST', '/api/stores/recognize', { body: imageForm(whitePng(), { text: '모퉁이 카페' }) });
  assert.equal(res.body.matched, true);
});
