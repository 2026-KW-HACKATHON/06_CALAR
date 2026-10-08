const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
test('notification toggles persist for the authenticated user and reject invalid values', async () => {
  const server = await startServer();
  try {
    const customer = await server.request('POST', '/api/auth/customer/session');
    const other = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${customer.body.token}` };
    const otherHeaders = { authorization: `Bearer ${other.body.token}` };
    const path = '/api/auth/notification-settings';
    assert.equal((await server.request('GET', path)).status, 401);
    assert.equal((await server.request('GET', path, { headers })).body.enabled, false);
    assert.equal((await server.request('PATCH', path, { headers, json: { enabled: true } })).status, 200);
    assert.equal((await server.request('GET', path, { headers })).body.enabled, true);
    assert.equal((await server.request('GET', path, { headers: otherHeaders })).body.enabled, false);
    assert.equal((await server.request('PATCH', path, { headers, json: { enabled: 'yes' } })).status, 400);
    assert.equal((await server.request('PATCH', path, { headers, json: { enabled: false } })).status, 200);
    assert.equal((await server.request('GET', path, { headers })).body.enabled, false);
  } finally { await server.close(); }
});
