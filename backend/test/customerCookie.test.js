const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const db = require('../db');
test('browser customer orders follow only the cookie, and deleting it starts an empty account', async () => {
  const server = await startServer();
  try {
    const browser = { 'x-calar-browser-session': '1' };
    const initial = await server.request('POST', '/api/auth/customer/session', { headers: browser });
    assert.equal(initial.status, 201);
    const cookieHeader = initial.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /SameSite=Lax/);
    const cookie = cookieHeader.split(';')[0];
    const headers = { ...browser, cookie, authorization: `Bearer ${initial.body.token}` };
    const resumed = await server.request('POST', '/api/auth/customer/session', { headers });
    assert.equal(resumed.body.user.id, initial.body.user.id);
    const pickupTime = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + 'T12:30';
    const order = await server.request('POST', '/api/orders', { headers, json: { storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime } });
    assert.equal(order.status, 201);
    assert.equal((await server.request('GET', '/api/orders/mine', { headers })).body.length, 1);
    const removed = { ...browser, authorization: `Bearer ${initial.body.token}` };
    assert.equal((await server.request('GET', '/api/orders/mine', { headers: removed })).status, 401);
    const fresh = await server.request('POST', '/api/auth/customer/session', { headers: removed });
    assert.equal(fresh.status, 201);
    assert.notEqual(fresh.body.user.id, initial.body.user.id);
    const newHeaders = { ...browser, cookie: fresh.headers.get('set-cookie').split(';')[0] };
    assert.equal((await server.request('GET', '/api/orders/mine', { headers: newHeaders })).body.length, 0);
    assert.equal((await server.request('GET', `/api/orders/${order.body.id}`, { headers: newHeaders })).status, 403);
    assert.ok(db.prepare('SELECT order_id FROM orders WHERE order_id = ?').get(order.body.id));
  } finally { await server.close(); }
});
