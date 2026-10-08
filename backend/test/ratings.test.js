const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const auth = require('../services/authService');
const orders = require('../services/orderService');
const stores = require('../services/storeService');

test('ratings require completed own orders, reject duplicates, and aggregate per store', async () => {
  const server = await startServer();
  try {
    const user = auth.register({ email: 'rating@calar.local', password: 'rating-test-password', displayName: 'Rating' });
    const other = auth.register({ email: 'rating-other@calar.local', password: 'rating-test-password', displayName: 'Other' });
    const headers = { authorization: `Bearer ${auth.createSession(user.id).token}` };
    const otherHeaders = { authorization: `Bearer ${auth.createSession(other.id).token}` };
    const pickupTime = new Date(Date.now() + 9 * 3600000 + 86400000).toISOString().slice(0, 10) + 'T12:30';
    const create = () => orders.createOrder({ storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime, customerPhone: '01012345678' }, { customerId: user.id });
    const order = create();
    const rate = (score, requestHeaders = headers) => server.request('POST', `/api/orders/${order.id}/rating`, { headers: requestHeaders, json: { score } });
    assert.equal((await rate(5, {})).status, 401);
    assert.equal((await rate(5)).status, 409);
    orders.updateOrderStatus(order.id, { status: 'accepted' });
    assert.equal((await rate(5)).status, 409);
    orders.updateOrderStatus(order.id, { status: 'done' });
    assert.equal((await rate(5, otherHeaders)).status, 404);
    for (const score of [0, 6, 2.5, '5', null]) assert.equal((await rate(score)).status, 400);
    assert.equal((await rate(5)).status, 201);
    assert.equal((await rate(1)).status, 409);
    const second = create();
    orders.updateOrderStatus(second.id, { status: 'accepted' });
    orders.updateOrderStatus(second.id, { status: 'done' });
    assert.equal((await server.request('POST', `/api/orders/${second.id}/rating`, { headers, json: { score: 2 } })).status, 201);
    assert.equal(stores.findStore(1).rating, 3.5);
    assert.equal(stores.findStore(1).ratingCount, 2);
    assert.equal(stores.findStore(2).rating, null);
    assert.equal((await server.request('GET', '/api/orders/mine', { headers })).body.length, 2);
    assert.equal((await server.request('GET', '/api/orders/mine', { headers: otherHeaders })).body.length, 0);
    const rejected = create();
    orders.updateOrderStatus(rejected.id, { status: 'rejected' });
    assert.equal((await server.request('POST', `/api/orders/${rejected.id}/rating`, { headers, json: { score: 5 } })).status, 409);
  } finally { await server.close(); }
});
