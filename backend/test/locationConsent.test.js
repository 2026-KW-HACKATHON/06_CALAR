const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { startServer } = require('./helpers');

test('location consent restores from DB, distinguishes undecided/refused, isolates users and supports withdrawal', async () => {
  const server = await startServer();
  try {
    const first = await server.request('POST', '/api/auth/customer/session');
    const other = await server.request('POST', '/api/auth/customer/session');
    const headers = { authorization: `Bearer ${first.body.token}` };
    const otherHeaders = { authorization: `Bearer ${other.body.token}` };
    assert.equal(first.body.user.locationConsent, null);
    assert.equal((await server.request('GET', '/api/auth/location-consent')).status, 401);
    assert.deepEqual((await server.request('GET', '/api/auth/location-consent', { headers })).body, { accepted: null, updatedAt: null });
    assert.equal((await server.request('PATCH', '/api/auth/location-consent', { headers, json: { accepted: true, userId: other.body.user.id } })).status, 200);
    const consent = await server.request('GET', '/api/auth/location-consent', { headers });
    assert.equal(consent.body.accepted, true);
    assert.ok(consent.body.updatedAt);
    assert.equal((await server.request('GET', '/api/auth/location-consent', { headers: otherHeaders })).body.accepted, null);
    const resumed = await server.request('POST', '/api/auth/customer/session', { headers });
    assert.equal(resumed.body.user.locationConsent, true);
    for (const accepted of [null, 1, 'true', {}, []]) assert.equal((await server.request('PATCH', '/api/auth/location-consent', { headers, json: { accepted } })).status, 400);
    assert.equal((await server.request('PATCH', '/api/auth/location-consent', { headers, json: { accepted: false } })).status, 200);
    assert.equal((await server.request('GET', '/api/auth/location-consent', { headers })).body.accepted, false);
    const reopened = new DatabaseSync(process.env.CALAR_DB_PATH);
    try {
      assert.equal(reopened.prepare('SELECT accepted FROM location_consents WHERE user_id = ?').get(first.body.user.id).accepted, 0);
      assert.deepEqual(reopened.prepare('PRAGMA table_info(location_consents)').all().map((column) => column.name), ['user_id', 'accepted', 'updated_at']);
      assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM location_consents WHERE user_id = ?').get(first.body.user.id).count, 1);
    } finally { reopened.close(); }
  } finally { await server.close(); }
});
