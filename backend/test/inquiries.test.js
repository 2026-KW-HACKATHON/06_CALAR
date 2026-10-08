const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startServer } = require('./helpers');

test('customer inquiries persist, admins reply and other customers cannot read them', async () => {
  const server = await startServer();
  try {
    const customer = await server.request('POST', '/api/auth/customer/session');
    const other = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${customer.body.token}` };
    const otherHeaders = { authorization: `Bearer ${other.body.token}` };
    const body = { body: '예약을 변경하고 싶어요.', requestId: randomUUID() };
    assert.equal((await server.request('GET', '/api/inquiries/mine')).status, 401);
    const sent = await server.request('POST', '/api/inquiries/mine', { headers, json: body });
    assert.equal(sent.status, 201);
    assert.equal(sent.body[0].body, body.body);
    assert.equal((await server.request('POST', '/api/inquiries/mine', { headers, json: body })).body.length, 1);
    assert.equal((await server.request('GET', '/api/inquiries/mine', { headers: otherHeaders })).body.length, 0);
    assert.equal((await server.request('GET', `/api/inquiries/${customer.body.user.id}`, { headers: otherHeaders })).status, 403);
    assert.equal((await server.request('GET', '/api/inquiries', { headers })).status, 403);
    assert.equal((await server.request('POST', '/api/inquiries/mine', { headers, json: { ...body, body: ' ' } })).status, 400);
    const admin = await server.request('POST', '/api/auth/login', { json: { email: 'test-admin@calar.local', password: 'test-admin-password-2026' } });
    const adminHeaders = { authorization: `Bearer ${admin.body.token}` };
    const inbox = await server.request('GET', '/api/inquiries', { headers: adminHeaders });
    assert.equal(inbox.body[0].customerId, customer.body.user.id);
    const reply = await server.request('POST', `/api/inquiries/${customer.body.user.id}`, { headers: adminHeaders, json: { body: '확인해 드릴게요.', requestId: randomUUID() } });
    assert.equal(reply.status, 201);
    const history = await server.request('GET', '/api/inquiries/mine', { headers });
    assert.equal(history.body.length, 2);
    assert.equal(history.body[1].authorId, admin.body.user.id);
  } finally { await server.close(); }
});
