const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const db = require('../db');
const orders = require('../services/orderService');

test('visit reservations need no menu or phone and owners can confirm them', async () => {
  const server = await startServer();
  try {
    const customer = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${customer.body.token}` };
    db.exec("UPDATE stores SET order_type = 'reservation', open_hours = '00:00-24:00' WHERE store_id = 4");
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const body = { storeId: 4, items: [], kind: 'reservation', partySize: 3, pickupTime: tomorrow + 'T12:30' };
    const created = await server.request('POST', '/api/orders', { headers, json: body });
    assert.equal(created.status, 201);
    assert.equal(created.body.partySize, 3);
    assert.equal(created.body.kind, 'reservation');
    assert.equal(created.body.totalPrice, 0);
    assert.equal(created.body.customerPhone, '');
    assert.deepEqual(created.body.items, []);
    assert.equal(db.prepare('SELECT count(*) AS n FROM items WHERE order_id = ?').get(created.body.id).n, 0);
    assert.equal((await server.request('GET', '/api/orders/mine', { headers })).body[0].partySize, 3);
    assert.equal((await server.request('PATCH', `/api/orders/${created.body.id}/status`, { headers, json: { status: 'accepted' } })).status, 403);
    const admin = await server.request('POST', '/api/auth/login', { json: { email: 'test-admin@calar.local', password: 'test-admin-password-2026' } });
    const adminHeaders = { authorization: `Bearer ${admin.body.token}` };
    const accepted = await server.request('PATCH', `/api/orders/${created.body.id}/status`, { headers: adminHeaders, json: { status: 'accepted' } });
    assert.equal(accepted.body.status, 'accepted');
    assert.equal(accepted.body.partySize, 3);
    assert.equal((await server.request('PATCH', `/api/orders/${created.body.id}/status`, { headers: adminHeaders, json: { status: 'done' } })).body.status, 'done');
    for (const partySize of [0, -1, 100, 1.5, '3', undefined]) assert.throws(() => orders.createOrder({ ...body, partySize }), /partySize/);
    assert.throws(() => orders.createOrder({ ...body, storeId: 1 }), /visit reservations/);
    assert.throws(() => orders.createOrder({ ...body, items: [{ menuId: 401, quantity: 1 }] }), /menu items/);
    assert.throws(() => orders.createOrder({ ...body, pickupTime: tomorrow + 'T24:00' }), /pickupTime/);
    assert.throws(() => orders.createOrder({ ...body, paymentMethod: 'credit' }), /do not require payment/);
  } finally { await server.close(); }
});
