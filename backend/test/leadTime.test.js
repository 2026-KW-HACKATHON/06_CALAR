const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers');
const db = require('../db');
const auth = require('../services/authService');
const management = require('../services/managementService');
const orders = require('../services/orderService');
const { findStore } = require('../services/storeService');

test('store lead times persist and reject early orders and visits at the server', () => {
  const admin = auth.provisionAdmin({ email: 'lead-admin@example.com', password: 'long-test-password' });
  const owner = auth.register({ role: 'owner', email: 'lead-owner@example.com', password: 'long-test-password', displayName: 'Owner',
    business: { businessNumber: '1234567891', legalName: 'Store', representativeName: 'Owner', address: 'Seoul' } });
  db.prepare("UPDATE business_registrations SET status = 'verified' WHERE user_id = ?").run(owner.id);
  const created = management.createStore(owner, { name: 'Lead store', address: 'Seoul', categoryId: 1, openHours: '00:00-24:00', orderType: 'reservation', minOrderMinutes: 30 });
  assert.equal(created.minOrderMinutes, 30);
  assert.equal(management.updateStore(owner, created.id, { minOrderMinutes: 60 }).minOrderMinutes, 60);
  assert.equal(management.updateStore(owner, created.id, { description: 'Updated' }).minOrderMinutes, 60);
  assert.throws(() => management.updateStore({ id: admin.id, role: 'customer' }, created.id, { minOrderMinutes: 0 }), /verified business/);
  for (const minOrderMinutes of [-1, 1.5, '30', 43201]) assert.throws(() => management.updateStore(owner, created.id, { minOrderMinutes }), /minOrderMinutes/);
  const savedNow = Date.now;
  Date.now = () => Date.parse('2026-10-08T12:00:00+09:00');
  try {
    const body = { storeId: created.id, kind: 'reservation', partySize: 2, items: [], pickupTime: '2026-10-08T12:59' };
    assert.throws(() => orders.createOrder(body), /at least 60 minutes/);
    assert.equal(orders.createOrder({ ...body, pickupTime: '2026-10-08T13:00' }).status, 'pending');
    management.updateStore(owner, created.id, { minOrderMinutes: 0 });
    assert.equal(orders.createOrder({ ...body, pickupTime: '2026-10-08T12:05' }).status, 'pending');
    management.updateStore(admin, 1, { minOrderMinutes: 30 }, true);
    assert.equal(findStore(1).minOrderMinutes, 30);
    assert.throws(() => orders.createOrder({ storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime: '2026-10-08T12:25' }), /at least 30 minutes/);
  } finally { Date.now = savedNow; }
});
