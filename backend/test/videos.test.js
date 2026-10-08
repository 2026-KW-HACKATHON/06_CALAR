const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const db = require('../db');
const auth = require('../services/authService');
const management = require('../services/managementService');

// Minimal container fixture; playback is handled by the browser's native player.
function mp4() {
  const box = (name, body) => { const header = Buffer.alloc(8); header.writeUInt32BE(8 + body.length); header.write(name, 4); return Buffer.concat([header, body]); };
  return Buffer.concat([box('ftyp', Buffer.from('isom0000isommp42')), box('moov', Buffer.alloc(8)), box('mdat', Buffer.alloc(24))]);
}
function form(buffer = mp4()) {
  const data = new FormData(); data.append('video', new Blob([buffer], { type: 'video/mp4' }), 'video.mp4'); return data;
}
test('video upload enforces ownership and limits, preserves photos and supports byte-range playback', async () => {
  const server = await startServer();
  try {
    const credentials = { role: 'owner', email: 'videos@example.com', password: 'long-test-password', displayName: 'Owner',
      business: { businessNumber: '1234567891', legalName: 'Store', representativeName: 'Owner', address: 'Seoul' } };
    const owner = auth.register(credentials);
    db.prepare("UPDATE business_registrations SET status = 'verified' WHERE user_id = ?").run(owner.id);
    const login = await server.request('POST', '/api/auth/login', { json: credentials });
    const headers = { authorization: `Bearer ${login.body.token}` };
    const store = management.createStore(owner, { name: 'Video store', address: 'Seoul', categoryId: 1, openHours: '00:00-24:00', orderType: 'preorder' });
    const menu = management.createMenu(owner, store.id, { name: '음식', price: 5000 });
    const endpoint = `/api/owner/stores/${store.id}/videos`;
    assert.equal((await server.request('POST', endpoint, { body: form() })).status, 401);
    assert.equal((await server.request('POST', '/api/owner/stores/1/videos', { headers, body: form() })).status, 403);
    assert.equal((await server.request('POST', endpoint, { headers, body: form(Buffer.from('fake mp4')) })).status, 400);
    assert.equal((await server.request('POST', endpoint, { headers, body: form(mp4().subarray(0, 30)) })).status, 400);
    const saved = await server.request('POST', endpoint, { headers, body: form() });
    assert.equal(saved.status, 201);
    const range = await fetch(server.base + saved.body.url, { headers: { range: 'bytes=8-15' } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-type'), 'video/mp4');
    assert.equal(range.headers.get('content-range'), `bytes 8-15/${mp4().length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), mp4().subarray(8, 16));
    const suffix = await fetch(server.base + saved.body.url, { headers: { range: 'bytes=-8' } });
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), mp4().subarray(-8));
    assert.equal((await fetch(server.base + saved.body.url, { headers: { range: 'bytes=9999-' } })).status, 416);
    const menuEndpoint = `/api/owner/stores/${store.id}/menus/${menu.id}/video`;
    const first = await server.request('POST', menuEndpoint, { headers, body: form() });
    const second = await server.request('POST', menuEndpoint, { headers, body: form() });
    assert.equal(second.status, 201);
    assert.equal((await fetch(server.base + first.body.url)).status, 404);
    const detail = await server.request('GET', `/api/stores/${store.id}`);
    assert.equal(detail.body.videos[0].uuid, saved.body.uuid);
    assert.equal(detail.body.menu[0].video.uuid, second.body.uuid);
    assert.equal((await server.request('POST', endpoint, { headers, body: form() })).status, 201);
    assert.equal((await server.request('POST', endpoint, { headers, body: form() })).status, 201);
    assert.equal((await server.request('POST', endpoint, { headers, body: form() })).status, 409);
    assert.equal((await server.request('DELETE', `${endpoint}/${saved.body.uuid}`, { headers })).status, 204);
    assert.equal((await fetch(server.base + saved.body.url)).status, 404);
  } finally { await server.close(); }
});
