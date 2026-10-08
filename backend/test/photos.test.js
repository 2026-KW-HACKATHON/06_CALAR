const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, imageForm, whitePng, corruptPng } = require('./helpers');
const db = require('../db');
const auth = require('../services/authService');
const management = require('../services/managementService');

test('owners upload, replace and delete photos; customers view them; invalid uploads and foreign stores are rejected', async () => {
  const server = await startServer();
  try {
    const credentials = { role: 'owner', email: 'photos@example.com', password: 'long-test-password', displayName: 'Owner',
      business: { businessNumber: '1234567891', legalName: 'Store', representativeName: 'Owner', address: 'Seoul' } };
    const owner = auth.register(credentials);
    db.prepare("UPDATE business_registrations SET status = 'verified' WHERE user_id = ?").run(owner.id);
    const login = await server.request('POST', '/api/auth/login', { json: credentials });
    const headers = { authorization: `Bearer ${login.body.token}` };
    const store = management.createStore(owner, { name: 'Photo store', address: 'Seoul', categoryId: 1, openHours: '00:00-24:00', orderType: 'preorder' });
    const menu = management.createMenu(owner, store.id, { name: '음식', price: 5000 });
    const endpoint = `/api/owner/stores/${store.id}/photos`;
    assert.equal((await server.request('POST', endpoint, { body: imageForm(whitePng()) })).status, 401);
    assert.equal((await server.request('POST', '/api/owner/stores/1/photos', { headers, body: imageForm(whitePng()) })).status, 403);
    for (const image of [Buffer.from('<svg></svg>'), corruptPng()]) {
      assert.equal((await server.request('POST', endpoint, { headers, body: imageForm(image) })).status, 400);
    }
    assert.equal((await server.request('POST', endpoint, { headers, body: imageForm(Buffer.alloc(10 * 1024 * 1024 + 1)) })).status, 413);
    const uploaded = await server.request('POST', endpoint, { headers, body: imageForm(whitePng()) });
    assert.equal(uploaded.status, 201);
    const image = await fetch(server.base + uploaded.body.url);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), whitePng());
    const menuEndpoint = `/api/owner/stores/${store.id}/menus/${menu.id}/photo`;
    const first = await server.request('POST', menuEndpoint, { headers, body: imageForm(whitePng()) });
    const replacement = await server.request('POST', menuEndpoint, { headers, body: imageForm(whitePng()) });
    assert.equal(replacement.status, 201);
    assert.equal((await fetch(server.base + first.body.url)).status, 404);
    const detail = await server.request('GET', `/api/stores/${store.id}`);
    assert.equal(detail.body.photos[0].uuid, uploaded.body.uuid);
    assert.equal(detail.body.menu[0].photo.uuid, replacement.body.uuid);
    for (let i = 1; i < 10; i++) assert.equal((await server.request('POST', endpoint, { headers, body: imageForm(whitePng()) })).status, 201);
    assert.equal((await server.request('POST', endpoint, { headers, body: imageForm(whitePng()) })).status, 409);
    assert.equal((await server.request('DELETE', `${endpoint}/${uploaded.body.uuid}`, { headers })).status, 204);
    assert.equal((await fetch(server.base + uploaded.body.url)).status, 404);
    management.deleteMenu(owner, store.id, menu.id);
    assert.equal((await fetch(server.base + replacement.body.url)).status, 404);
  } finally { await server.close(); }
});
