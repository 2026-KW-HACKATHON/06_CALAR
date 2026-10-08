const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./helpers');
test('frontend order client submits reservation guests and coupon discounts through the real API', async () => {
  const server = await startServer();
  try {
    const session = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${session.body.token}` };
    globalThis.__calarOrderTestApi = { post: async (url, json) => {
      const response = await server.request('POST', url, { headers, json });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      return { data: response.body };
    } };
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/services/orderService.js'), 'utf8')
      .replace("import api from './api';", 'const api = globalThis.__calarOrderTestApi;')
      .replace("import { ensureCustomerSession } from './customerSession';", 'const ensureCustomerSession = async () => {};');
    const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const pickupTime = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + 'T12:30';
    const reservation = await client.createOrder({ storeId: 2, kind: 'reservation', partySize: 3, items: [], pickupTime, couponUuid: null });
    assert.equal(reservation.partySize, 3);
    assert.equal(reservation.kind, 'reservation');
    const store = await server.request('GET', '/api/stores/1');
    const order = await client.createOrder({ storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime, couponUuid: store.body.coupon.uuid });
    assert.equal(order.totalPrice, 7200);
    assert.equal(order.discountAmount, 800);
  } finally { delete globalThis.__calarOrderTestApi; await server.close(); }
});
