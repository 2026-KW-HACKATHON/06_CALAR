const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers');
const auth = require('../services/authService');
const management = require('../services/managementService');
const { findStore } = require('../services/storeService');
test('virtual store flags persist, survive unrelated updates and reject nonboolean values', () => {
  const admin = auth.provisionAdmin({ email: 'virtual-admin@example.com', password: 'long-test-password' });
  const body = { name: 'Virtual store', address: 'Seoul', categoryId: 1, openHours: '00:00-24:00', orderType: 'preorder', isVirtual: true };
  const store = management.createStore(admin, body, true);
  assert.equal(findStore(store.id).isVirtual, true);
  assert.equal(management.updateStore(admin, store.id, { description: 'Changed' }, true).isVirtual, true);
  assert.equal(management.updateStore(admin, store.id, { isVirtual: false }, true).isVirtual, false);
  for (const isVirtual of [1, 'true', []]) assert.throws(() => management.createStore(admin, { ...body, isVirtual }, true), /isVirtual/);
  assert.equal(findStore(1).isVirtual, true);
});
