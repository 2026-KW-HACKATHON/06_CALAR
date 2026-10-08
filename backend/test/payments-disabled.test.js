const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const db = require('../db');

test('payment and topup APIs are disabled while normal orders still work', async () => {
  const server = await startServer();
  try {
    const session = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${session.body.token}` };
    const before = db.prepare('SELECT count(*) AS n FROM credit_transactions').get().n;
    for (const [method, path] of [['GET', '/api/auth/wallet'], ['POST', '/api/auth/wallet/dev-topup'], ['POST', '/api/payments/kakaopay/ready'], ['POST', '/api/payments/kakaopay/approve']]) {
      assert.equal((await server.request(method, path, { headers, json: method === 'POST' ? { amount: 10000 } : undefined })).status, 410);
    }
    const pickupTime = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + 'T12:30';
    const body = { storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime };
    assert.equal((await server.request('POST', '/api/orders', { headers, json: { ...body, paymentMethod: 'credit' } })).status, 410);
    assert.equal((await server.request('POST', '/api/orders', { headers, json: body })).status, 201);
    assert.equal(db.prepare('SELECT count(*) AS n FROM credit_transactions').get().n, before);
  } finally { await server.close(); }
});
