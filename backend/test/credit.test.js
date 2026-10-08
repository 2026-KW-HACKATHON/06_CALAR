const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startServer } = require('./helpers');
const db = require('../db');
const auth = require('../services/authService');
const credit = require('../services/creditService');
const orders = require('../services/orderService');

test('충전·선결제·환불은 중복 요청에 한 번만 반영되고 잔액 부족 시 주문도 롤백한다', async () => {
  const server = await startServer();
  const savedDev = process.env.CALAR_DEV_CREDIT;
  const savedMode = process.env.NODE_ENV;
  const savedPaymentMode = process.env.KAKAOPAY_MODE;
  process.env.KAKAOPAY_MODE = 'test';
  process.env.CALAR_DEV_CREDIT = 'true'; process.env.NODE_ENV = 'development';
  try {
    const user = auth.register({ email: 'wallet@calar.local', password: 'credit-password-2026', displayName: 'Wallet test' });
    const token = auth.createSession(user.id).token;
    const headers = { authorization: `Bearer ${token}` };
    assert.equal(credit.balance(user.id), 0);
    const body = { amount: 20000, requestId: randomUUID() };
    const topup = () => server.request('POST', '/api/auth/wallet/dev-topup', { headers, json: body });
    assert.equal((await topup()).body.credit, 20000);
    assert.equal((await topup()).body.credit, 20000);
    assert.equal(credit.wallet(user.id).transactions.length, 1);
    assert.throws(() => credit.topup(user.id, { ...body, amount: 30000 }), /already used/);
    const pickupTime = new Date(Date.now() + 9 * 60 * 60 * 1000 + 86400000).toISOString().slice(0, 10) + 'T12:30';
    const orderBody = { storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime, customerPhone: '01012345678', paymentMethod: 'credit', requestId: randomUUID() };
    const first = await server.request('POST', '/api/orders', { headers, json: orderBody });
    assert.equal(first.status, 201);
    assert.equal(credit.balance(user.id), 12000);
    const repeat = await server.request('POST', '/api/orders', { headers, json: orderBody });
    assert.equal(repeat.body.id, first.body.id);
    assert.equal(credit.balance(user.id), 12000);
    assert.equal((await server.request('POST', '/api/orders', { headers, json: { ...orderBody, items: [{ menuId: 101, quantity: 2 }] } })).status, 409);
    const count = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
    assert.throws(() => orders.createOrder({ ...orderBody, requestId: randomUUID(), items: [{ menuId: 101, quantity: 3 }] }, { customerId: user.id }), /Insufficient credit/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, count);
    assert.equal(credit.balance(user.id), 12000);
    orders.updateOrderStatus(first.body.id, { status: 'rejected' });
    assert.equal(credit.balance(user.id), 20000);
    assert.throws(() => orders.updateOrderStatus(first.body.id, { status: 'rejected' }), /cannot be changed/);
    assert.equal(credit.balance(user.id), 20000);
    assert.deepEqual(credit.wallet(user.id).transactions.map((item) => item.kind), ['refund', 'payment', 'topup']);
    // 같은 메뉴를 나눠 보낸 주문도 재시도하면 (서버가 합쳐 저장했어도) 같은 주문으로 인정한다
    const split = { ...orderBody, requestId: randomUUID(), items: [{ menuId: 101, quantity: 1 }, { menuId: 101, quantity: 1 }] };
    const splitFirst = await server.request('POST', '/api/orders', { headers, json: split });
    assert.equal(splitFirst.status, 201);
    const splitRepeat = await server.request('POST', '/api/orders', { headers, json: split });
    assert.equal(splitRepeat.status, 201);
    assert.equal(splitRepeat.body.id, splitFirst.body.id);
    assert.equal(credit.balance(user.id), 4000);
    // 이미 쓴 requestId에 형식이 깨진 items → 500이 아니라 409
    assert.equal((await server.request('POST', '/api/orders', { headers, json: { ...split, items: [null] } })).status, 409);
    process.env.NODE_ENV = 'production';
    assert.equal((await topup()).status, 403);
  } finally {
    if (savedPaymentMode === undefined) delete process.env.KAKAOPAY_MODE; else process.env.KAKAOPAY_MODE = savedPaymentMode;
    if (savedDev === undefined) delete process.env.CALAR_DEV_CREDIT; else process.env.CALAR_DEV_CREDIT = savedDev;
    if (savedMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedMode;
    await server.close();
  }
});
