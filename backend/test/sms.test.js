const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const sms = require('../services/smsService');
test('SMS autofill messages bind Android app hash and web domain without changing the OTP', () => {
  const saved = process.env.CALAR_PUBLIC_URL;
  process.env.CALAR_PUBLIC_URL = 'https://wolgye.kr';
  try {
    assert.equal(sms.codeMessage('012345', 'AbCdEf12+/Z'), '<#> [CALAR] Code: 012345 (10 min)\nAbCdEf12+/Z');
    assert.ok(sms.codeMessage('012345').endsWith('@wolgye.kr #012345'));
    assert.equal(sms.codeMessage('012345', undefined, true), '[CALAR] Code: 012345 (10 min)');
    assert.throws(() => sms.codeMessage('012345', 'bad\nhash'), /Invalid app hash/);
  } finally { if (saved === undefined) delete process.env.CALAR_PUBLIC_URL; else process.env.CALAR_PUBLIC_URL = saved; }
});

test('SOLAPI 요청 서명, 발신번호 정규화, 발송 실패 처리를 검증한다', async () => {
  const saved = { ...process.env };
  process.env.SOLAPI_API_KEY = 'test-key';
  process.env.SOLAPI_API_SECRET = 'test-secret';
  process.env.SOLAPI_SENDER = '010-1234-5678';
  let rejected = false;
  const mock = test.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.solapi.com/messages/v4/send-many/detail');
    const header = options.headers.Authorization;
    const date = /date=([^,]+)/.exec(header)[1];
    const salt = /salt=([^,]+)/.exec(header)[1];
    const signature = /signature=(.+)/.exec(header)[1];
    assert.equal(signature, createHmac('sha256', 'test-secret').update(date + salt).digest('hex'));
    const message = JSON.parse(options.body).messages[0];
    assert.equal(message.to, '01087654321');
    assert.equal(message.from, '01012345678');
    assert.ok(message.text.includes('123456'));
    return { ok: true, status: 200, json: async () => rejected ?
      { failedMessageList: [{ statusCode: '3040' }], groupInfo: { count: { registeredSuccess: 0 } } } :
      { failedMessageList: [], groupInfo: { count: { registeredSuccess: 1 } } } };
  });
  try {
    assert.deepEqual(await sms.sendCode('+821087654321', '123456'), { mock: false });
    rejected = true;
    await assert.rejects(sms.sendCode('+821087654321', '123456'), /SMS provider unavailable/);
    process.env.SOLAPI_API_KEY = '';
    process.env.NODE_ENV = 'development';
    assert.deepEqual(await sms.sendCode('+821087654321', '123456'), { mock: true });
    process.env.NODE_ENV = 'production';
    await assert.rejects(sms.sendCode('+821087654321', '123456'), /not configured/);
  } finally {
    mock.mock.restore();
    for (const key of ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER', 'NODE_ENV']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
