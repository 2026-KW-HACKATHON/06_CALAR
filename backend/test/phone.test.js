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
