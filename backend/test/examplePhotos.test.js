const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./helpers');
const db = require('../db');
const photos = require('../services/photoService');

test('SQL seeds all five example photos, serves PNGs and preserves removal across reinitialization', async () => {
  const server = await startServer();
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../setup.sql'), 'utf8');
    db.exec(schema);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM example_photos').get().count, 5);
    const store = await server.request('GET', '/api/stores/1');
    assert.equal(store.body.photos.length, 2);
    assert.ok(store.body.menu.find((menu) => menu.id === 101).photo);
    for (const row of db.prepare('SELECT uuid, filename FROM example_photos').all()) {
      const response = await fetch(`${server.base}/api/photos/${row.uuid}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(__dirname, '../../frontend/public/examples', row.filename)));
    }
    const food = photos.list(1, 101)[0];
    photos.remove(1, food.uuid);
    db.exec(schema);
    assert.equal(photos.list(1, 101).length, 0);
    assert.equal((await fetch(server.base + food.url)).status, 404);
  } finally { await server.close(); }
});
