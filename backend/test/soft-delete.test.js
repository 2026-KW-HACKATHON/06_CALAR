const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('소프트 삭제는 원본과 주문을 보존하고 목록, 로그인, 수정에서 제외한다', () => {
  const databasePath = path.join(os.tmpdir(), `calar-soft-delete-${process.pid}.sqlite`);
  process.env.CALAR_DB_PATH = databasePath;
  const db = require('../db');
  const management = require('../services/managementService');
  const stores = require('../services/storeService');
  const auth = require('../services/authService');
  const orders = require('../services/orderService');
  const admin = { id: 99999, role: 'admin' };
  try {
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'importantDetailsUpdate'").get(), undefined);
    management.deleteMenu(admin, 1, 101);
    assert.ok(db.prepare('SELECT deleted_at FROM menus WHERE menu_id = 101').get().deleted_at);
    assert.equal(stores.findStore(1).menu.some((menu) => menu.id === 101), false);
    assert.throws(() => management.updateMenu(admin, 1, 101, { price: 9000 }), /Menu not found/);
    assert.equal(orders.getOrderById(1).items[0].menuId, 101);

    management.deleteStore(admin, 1);
    assert.equal(stores.findStore(1), null);
    assert.equal(stores.getAllStores().some((store) => store.id === 1), false);
    assert.equal(stores.matchStoresByText('월계 손칼국수').some((store) => store.id === 1), false);
    assert.ok(db.prepare('SELECT deleted_at FROM coupons WHERE coupon_id = 1').get().deleted_at);
    assert.ok(orders.getOrderById(1));
    assert.throws(() => management.deleteStore(admin, 1), /Store not found/);

    const category = management.createCategory({ name: '삭제할 상위 업종' });
    const childId = Number(db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run('하위 업종', category.id).lastInsertRowid);
    management.deleteCategory(category.id);
    assert.ok(db.prepare('SELECT deleted_at FROM categories WHERE category_id = ?').get(childId).deleted_at);
    assert.equal(management.listCategories().some((row) => row.id === childId), false);

    const user = auth.register({ email: 'deleted@example.com', password: 'password-12345', displayName: '삭제 대상' });
    const session = auth.login({ email: user.email, password: 'password-12345' });
    management.deleteUser(user.id, admin.id);
    assert.equal(auth.userFromToken(session.token), null);
    assert.throws(() => auth.login({ email: user.email, password: 'password-12345' }), /incorrect/);
    assert.equal(management.listUsers().some((row) => row.id === user.id), false);
    assert.throws(() => management.updateUser(user.id, { isActive: 1 }, admin.id), /User not found/);

    // Reapplying initialization must not resurrect seeded deleted stores or menus.
    db.exec(fs.readFileSync(path.join(__dirname, '../setup.sql'), 'utf8'));
    assert.ok(db.prepare('SELECT deleted_at FROM stores WHERE store_id = 1').get().deleted_at);
    assert.ok(db.prepare('SELECT deleted_at FROM menus WHERE menu_id = 101').get().deleted_at);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
    fs.rmSync(databasePath, { force: true });
  }
});
