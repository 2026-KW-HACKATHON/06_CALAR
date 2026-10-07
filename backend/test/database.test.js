const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const databasePath = path.join(os.tmpdir(), `06-calar-db-test-${process.pid}.sqlite`);
process.env.CALAR_DB_PATH = databasePath;

test('setup.sql 초기화는 반복 가능하고 SQLite 데이터는 다시 열어도 유지된다', () => {
  const db = require('../db');
  db.prepare('UPDATE stores SET visits = 121 WHERE store_id = 1').run();
  db.prepare("UPDATE orders SET status = 'accepted' WHERE order_id = 1").run();
  db.close();

  delete require.cache[require.resolve('../db')];
  const reopenedDb = require('../db');
  try {
    assert.equal(reopenedDb.prepare('SELECT visits FROM stores WHERE store_id = 1').get().visits, 121);
    assert.equal(reopenedDb.prepare('SELECT status FROM orders WHERE order_id = 1').get().status, 'accepted');
    assert.equal(reopenedDb.prepare('SELECT COUNT(*) AS count FROM stores').get().count, 5);
  } finally {
    reopenedDb.close();
    fs.rmSync(databasePath, { force: true });
  }
});

test('기존 SQLite 스키마에도 owner_id와 customer_id 마이그레이션을 적용한다', () => {
  const legacyPath = path.join(os.tmpdir(), `06-calar-legacy-test-${process.pid}.sqlite`);
  const legacyDb = new DatabaseSync(legacyPath);
  legacyDb.exec(`
    CREATE TABLE categories (category_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, parent_id INTEGER);
    CREATE TABLE stores (
      store_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category_id INTEGER,
      description TEXT, phone TEXT, address TEXT, location_lat REAL, location_lng REAL,
      open_hours TEXT, order_type TEXT DEFAULT 'none', visits INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')) NOT NULL
    );
    CREATE TABLE orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL,
      total_price INTEGER, pickup_time TEXT NOT NULL, customer_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );
  `);
  legacyDb.close();

  process.env.CALAR_DB_PATH = legacyPath;
  delete require.cache[require.resolve('../db')];
  const migratedDb = require('../db');
  try {
    assert.ok(migratedDb.prepare('PRAGMA table_info(stores)').all().some((column) => column.name === 'owner_id'));
    assert.ok(migratedDb.prepare('PRAGMA table_info(orders)').all().some((column) => column.name === 'customer_id'));
    assert.equal(migratedDb.prepare('SELECT COUNT(*) AS count FROM stores').get().count, 5);
  } finally {
    migratedDb.close();
    fs.rmSync(legacyPath, { force: true });
  }
});

test('모든 저장 테이블의 레코드에 고유한 UUID v4가 있다', () => {
  const uuidDatabasePath = path.join(os.tmpdir(), `06-calar-uuid-test-${process.pid}.sqlite`);
  process.env.CALAR_DB_PATH = uuidDatabasePath;
  delete require.cache[require.resolve('../db')];
  const db = require('../db');
  const tables = ['users', 'business_registrations', 'user_sessions', 'categories', 'stores', 'coupons', 'signKeyWords', 'menus', 'orders', 'items'];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  try {
    for (const table of tables) {
      const rows = db.prepare(`SELECT uuid FROM ${table}`).all();
      const uuids = rows.map((row) => row.uuid);
      assert.ok(uuids.every((uuid) => uuidPattern.test(uuid)), `${table} contains a missing or invalid UUID`);
      assert.equal(new Set(uuids).size, uuids.length, `${table} contains duplicate UUIDs`);
    }
  } finally {
    db.close();
    delete require.cache[require.resolve('../db')];
    fs.rmSync(uuidDatabasePath, { force: true });
  }
});