const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, imageForm, whitePng } = require('./helpers');
const db = require('../db');
const auth = require('../services/authService');
const management = require('../services/managementService');
test('owner portraits replace independently of gallery; optional consent is saved without coordinates', async () => {
  const server = await startServer();
  try {
    const credentials = { role: 'owner', email: 'portrait@example.com', password: 'long-test-password', displayName: 'Owner', locationConsent: true,
      business: { businessNumber: '1234567891', legalName: 'Store', representativeName: 'Owner', address: 'Seoul' } };
    const owner = auth.register(credentials);
    assert.equal(db.prepare('SELECT accepted FROM location_consents WHERE user_id = ?').get(owner.id).accepted, 1);
    db.prepare("UPDATE business_registrations SET status = 'verified' WHERE user_id = ?").run(owner.id);
    const login = await server.request('POST', '/api/auth/login', { json: credentials });
    const headers = { authorization: `Bearer ${login.body.token}` };
    const store = management.createStore(owner, { name: 'Portrait store', address: 'Seoul', categoryId: 1, openHours: '00:00-24:00', orderType: 'preorder' });
    const endpoint = `/api/owner/stores/${store.id}/portrait`;
    assert.equal((await server.request('POST', '/api/owner/stores/1/portrait', { headers, body: imageForm(whitePng()) })).status, 403);
    const first = await server.request('POST', endpoint, { headers, body: imageForm(whitePng()) });
    assert.equal(first.status, 201);
    const second = await server.request('POST', endpoint, { headers, body: imageForm(whitePng()) });
    assert.equal((await fetch(server.base + first.body.url)).status, 404);
    assert.equal((await fetch(server.base + second.body.url)).status, 200);
    const detail = await server.request('GET', `/api/stores/${store.id}`);
    assert.equal(detail.body.ownerPhoto.uuid, second.body.uuid);
    assert.equal(detail.body.photos.length, 0);
    const customer = await server.request('POST', '/api/auth/customer/session');
    const customerHeaders = { authorization: `Bearer ${customer.body.token}` };
    assert.equal((await server.request('PATCH', '/api/auth/location-consent', { headers: customerHeaders, json: { accepted: false } })).status, 200);
    assert.equal(db.prepare('SELECT accepted FROM location_consents WHERE user_id = ?').get(customer.body.user.id).accepted, 0);
    assert.equal((await server.request('PATCH', '/api/auth/location-consent', { headers: customerHeaders, json: { accepted: 'yes' } })).status, 400);
    assert.equal((await server.request('PATCH', '/api/auth/location-consent', { json: { accepted: true } })).status, 401);
    assert.equal((await server.request('DELETE', `/api/owner/stores/${store.id}/photos/${second.body.uuid}`, { headers })).status, 204);
    assert.equal((await fetch(server.base + second.body.url)).status, 404);
  } finally { await server.close(); }
});
