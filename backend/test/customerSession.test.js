const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const db = require('../db');

test('customers start and resume an isolated session without phone, email or SMS', async () => {
  const server = await startServer();
  try {
    const initial = await server.request('POST', '/api/auth/customer/session', {
      json: { role: 'admin', userId: 1, phone: 'arbitrary' },
    });
    assert.equal(initial.status, 201);
    assert.equal(initial.body.user.role, 'customer');
    assert.equal(initial.body.user.phone, null);
    assert.equal(initial.body.user.email, null);
    assert.equal(initial.body.user.phoneVerifiedAt, null);
    assert.equal(db.prepare('SELECT * FROM email_credentials WHERE user_id = ?').get(initial.body.user.id), undefined);
    assert.equal(db.prepare('SELECT * FROM phone_identities WHERE user_id = ?').get(initial.body.user.id), undefined);
    const headers = { authorization: `Bearer ${initial.body.token}` };
    assert.equal((await server.request('GET', '/api/auth/me', { headers })).body.user.id, initial.body.user.id);
    const resumed = await server.request('POST', '/api/auth/customer/session', { headers });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.token, initial.body.token);
    assert.equal(resumed.body.user.id, initial.body.user.id);

    const pickupTime = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + 'T12:30';
    const order = await server.request('POST', '/api/orders', {
      headers, json: { storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime },
    });
    assert.equal(order.status, 201);
    assert.equal(order.body.customerPhone, '');
    const other = await server.request('POST', '/api/auth/customer/session');
    assert.notEqual(other.body.user.id, initial.body.user.id);
    assert.equal((await server.request('GET', `/api/orders/${order.body.id}`, {
      headers: { authorization: `Bearer ${other.body.token}` },
    })).status, 403);
    assert.equal((await server.request('GET', '/api/owner/dashboard', { headers })).status, 403);
    assert.equal((await server.request('GET', '/api/admin/users', { headers })).status, 403);
    assert.equal((await server.request('POST', '/api/auth/logout', { headers })).status, 204);
    assert.equal((await server.request('GET', '/api/auth/me', { headers })).status, 401);
    assert.equal((await server.request('POST', '/api/auth/customer/session', { headers })).status, 401);
    const admin = await server.request('POST', '/api/auth/login', {
      json: { email: 'test-admin@calar.local', password: 'test-admin-password-2026' },
    });
    assert.equal((await server.request('POST', '/api/auth/customer/session', {
      headers: { authorization: `Bearer ${admin.body.token}` },
    })).status, 403);
  } finally { await server.close(); }
});
