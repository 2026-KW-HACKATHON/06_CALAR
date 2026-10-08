const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./helpers');
const db = require('../db');
const auth = require('../services/authService');
const orders = require('../services/orderService');
const credit = require('../services/creditService');
const { available } = require('../services/couponService');
const { nowKSTString } = require('../utils/time');

test('coupons discount server prices and credit payments, persist snapshots and reject unavailable coupons', () => {
  const customerId = auth.createCustomerSession().user.id;
  const uuid = randomUUID();
  const today = nowKSTString().slice(0, 10);
  db.prepare('INSERT INTO coupons (uuid, store_id, title, discount_rate, valid_from, valid_until) VALUES (?, 1, ?, 12.5, ?, ?)')
    .run(uuid, 'Test discount', today, today);
  const body = { storeId: 1, items: [{ menuId: 101, quantity: 1 }], pickupTime: new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + 'T12:30', couponUuid: uuid };
  const subtotal = db.prepare('SELECT price FROM menus WHERE menu_id = 101').get().price;
  const expected = subtotal - Math.floor(subtotal * 12.5 / 100);
  assert.equal(available(1, uuid).uuid, uuid);
  const onsite = orders.createOrder({ ...body, totalPrice: 1, discountRate: 100 }, { customerId });
  assert.equal(onsite.totalPrice, expected);
  assert.equal(onsite.discountAmount, subtotal - expected);
  db.exec('BEGIN');
  credit.change(customerId, 100000, 'topup', randomUUID());
  db.exec('COMMIT');
  const payment = { ...body, paymentMethod: 'credit', requestId: randomUUID() };
  const paid = orders.createOrder(payment, { customerId });
  assert.equal(credit.balance(customerId), 100000 - expected);
  db.prepare('UPDATE coupons SET discount_rate = 50, is_active = 0 WHERE uuid = ?').run(uuid);
  assert.equal(orders.createOrder(payment, { customerId }).id, paid.id);
  assert.equal(orders.getOrderById(paid.id).totalPrice, expected);
  assert.throws(() => orders.createOrder({ ...payment, couponUuid: null }, { customerId }), /already used/);
  orders.updateOrderStatus(paid.id, { status: 'rejected' });
  assert.equal(credit.balance(customerId), 100000);
  const assertUnavailable = () => assert.throws(() => orders.createOrder(body, { customerId }), /not available/);
  assertUnavailable();
  for (const patch of ["is_active = 1, deleted_at = datetime('now')", "deleted_at = NULL, store_id = 2", "store_id = 1, valid_until = '2000-01-01'", "valid_until = NULL, valid_from = '2999-01-01'"]) {
    db.prepare(`UPDATE coupons SET ${patch} WHERE uuid = ?`).run(uuid);
    assertUnavailable();
    assert.equal(available(1, uuid), undefined);
  }
  assert.equal(orders.createOrder({ ...body, couponUuid: null }, { customerId }).totalPrice, subtotal);
});
