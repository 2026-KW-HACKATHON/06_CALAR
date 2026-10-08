const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
test('personal information consents default off, persist independently and are isolated per customer', async () => {
  const server = await startServer();
  try {
    const first = await server.request('POST', '/api/auth/customer/session');
    const second = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${first.body.token}` };
    const path = '/api/auth/personal-information-settings';
    const get = () => server.request('GET', path, { headers });
    const patch = json => server.request('PATCH', path, { headers, json });
    assert.equal((await server.request('GET', path)).status, 401);
    assert.equal((await server.request('PATCH', path, { json: { phone: true } })).status, 401);
    assert.deepEqual((await get()).body, { phone: false, contacts: false, updatedAt: null });
    assert.equal((await patch({ phone: true })).body.phone, true);
    assert.equal((await patch({ contacts: true })).body.phone, true);
    assert.equal((await get()).body.contacts, true);
    const other = await server.request('GET', path, { headers: { authorization: `Bearer ${second.body.token}` } });
    assert.equal(other.body.phone, false); assert.equal(other.body.contacts, false);
    for (const invalid of [{}, { phone: 'true' }, { contacts: 1 }, { phone: false, userId: second.body.user.id }]) assert.equal((await patch(invalid)).status, 400);
    assert.equal((await get()).body.phone, true);
    const off = await patch({ phone: false });
    assert.equal(off.body.phone, false); assert.equal(off.body.contacts, true); assert.ok(off.body.updatedAt);
    await patch({ contacts: false }); assert.equal((await get()).body.contacts, false);
  } finally { await server.close(); }
});
