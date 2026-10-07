const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
test('mobile payment return uses a fixed app scheme and only forwards payment fields', async () => {
  const server = await startServer();
  try {
    const response = await fetch(server.base + '/mobile/payment-result?paymentId=p1&outcome=success&pg_token=test-token&redirect=https://example.com', { redirect: 'manual' });
    assert.equal(response.status, 302);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.protocol, 'calar:');
    assert.equal(target.hostname, 'payment-result');
    assert.equal(target.searchParams.get('pg_token'), 'test-token');
    assert.equal(target.searchParams.has('redirect'), false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { await server.close(); }
});
