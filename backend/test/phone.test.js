const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startServer } = require('./helpers');
const db = require('../db');
const phone = require('../services/phoneService');
const auth = require('../services/authService');
const sms = require('../services/smsService');

test('전화번호 인증 후 자동 로그인하여 주문하며 잘못된 코드와 재사용을 차단한다', async () => {
  let sentCode;
  const mock = test.mock.method(sms, 'sendCode', async (_phone, code) => { sentCode = code; return { mock: false }; });
  const configMock = test.mock.method(sms, 'configuration', () => ({ mock: false }));
  const server = await startServer();
  try {
    assert.equal(phone.normalizePhone('010-1234-5678'), '+821012345678');
    assert.throws(() => phone.normalizePhone('123'), /Invalid mobile/);
    const sent = await server.request('POST', '/api/auth/phone/send-code', { json: { phone: '01012345678' } });
    assert.equal(sent.status, 200);
    assert.equal((await server.request('POST', '/api/auth/phone/send-code', { json: { phone: '01012345678' } })).status, 429);
    const check = (code) => server.request('POST', '/api/auth/phone/check-code', { json: { requestId: sent.body.requestId, code } });
    assert.equal((await check(sentCode === '000000' ? '111111' : '000000')).status, 400);
    const login = await check(sentCode);
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'customer');
    assert.equal(login.body.user.phone, '01012345678');
    assert.ok(login.body.user.phoneVerifiedAt);
    assert.equal((await check(sentCode)).status, 400);
    const headers = { authorization: `Bearer ${login.body.token}` };
    assert.equal((await server.request('GET', '/api/auth/me', { headers })).status, 200);
    const pickupTime = new Date(Date.now() + 9 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + 'T12:30';
    const order = await server.request('POST', '/api/orders', { headers, json: {
      storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime, customerPhone: login.body.user.phone,
    } });
    assert.equal(order.status, 201);
    const requestId = randomUUID();
    db.prepare('INSERT INTO phone_verification_requests (uuid, phone, code_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(requestId, '+821012345678', phone.hashCode('123456', requestId), new Date(Date.now() + 600000).toISOString());
    const repeat = await phone.checkCode({ requestId, code: '123456' });
    assert.equal(repeat.user.id, login.body.user.id);
    db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE user_id = ?").run(repeat.user.id);
    const deletedRequestId = randomUUID();
    db.prepare('INSERT INTO phone_verification_requests (uuid, phone, code_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(deletedRequestId, '+821012345678', phone.hashCode('123456', deletedRequestId), new Date(Date.now() + 600000).toISOString());
    await assert.rejects(phone.checkCode({ requestId: deletedRequestId, code: '123456' }), /Phone account unavailable/);
    assert.equal(auth.userFromToken(repeat.token), null);
  } finally { mock.mock.restore(); configMock.mock.restore(); await server.close(); }
});

test('같은 IP의 여러 고객이 문자 인증으로 로그인해도 막히지 않고, 틀린 코드 반복만 제한한다', async () => {
  const codes = new Map();
  const mock = test.mock.method(sms, 'sendCode', async (to, code) => { codes.set(to, code); return { mock: false }; });
  const configMock = test.mock.method(sms, 'configuration', () => ({ mock: false }));
  const server = await startServer();
  try {
    // 고객 8명이 한 와이파이에서 차례로 로그인 (예전에는 6번째부터 429)
    for (let i = 0; i < 8; i += 1) {
      const number = `0109000${String(i).padStart(4, '0')}`;
      const sent = await server.request('POST', '/api/auth/phone/send-code', { json: { phone: number } });
      assert.equal(sent.status, 200, `send ${i}`);
      const code = codes.get(phone.normalizePhone(number));
      const login = await server.request('POST', '/api/auth/phone/check-code', { json: { requestId: sent.body.requestId, code } });
      assert.equal(login.status, 200, `check ${i}`);
    }
    // 틀린 코드는 IP당 20번까지만 (같은 프로세스의 앞 테스트에서 틀린 횟수도 함께 세어진다)
    const statuses = [];
    for (let i = 0; i < 22; i += 1) {
      statuses.push((await server.request('POST', '/api/auth/phone/check-code', { json: { requestId: randomUUID(), code: '000000' } })).status);
    }
    const blockedAt = statuses.indexOf(429);
    assert.ok(blockedAt > 0 && blockedAt <= 20, String(statuses));
    assert.deepEqual([...new Set(statuses.slice(0, blockedAt))], [400]);
    assert.deepEqual([...new Set(statuses.slice(blockedAt))], [429]);
  } finally { mock.mock.restore(); configMock.mock.restore(); await server.close(); }
});
