// OCR 시간 초과 → 504, 서버는 계속 동작 (시간 제한을 1ms로 줄여서 흉내)
process.env.OCR_TIMEOUT_MS = '1';

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

test('인식이 제한 시간을 넘으면 504, 다음 요청도 정상 응답', async () => {
  for (let i = 0; i < 2; i++) {
    const res = await server.request('POST', '/api/stores/recognize', { body: imageForm(whitePng()) });
    assert.equal(res.status, 504);
    assert.deepEqual(res.body, { error: 'Sign recognition timed out' });
  }
  assert.equal((await server.request('GET', '/api/stores/1')).status, 200);
});
