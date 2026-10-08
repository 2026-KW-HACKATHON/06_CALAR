const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const databasePath = process.env.CALAR_DB_PATH || path.join(__dirname, '06_calar.sqlite');
if (databasePath !== ':memory:') {
  fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
}

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON');
require('./services/userMigration')(db);
if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'stores'").get() && !db.prepare('PRAGMA table_info(stores)').all().some(column => column.name === 'is_virtual')) {
  db.exec('ALTER TABLE stores ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0 CHECK (is_virtual IN (0, 1))');
  db.exec("UPDATE stores SET is_virtual = 1 WHERE store_id BETWEEN 1 AND 5 AND address LIKE '%가상 주소%'");
}
db.exec(fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8'));
if (!db.prepare('PRAGMA table_info(coupons)').all().some(column => column.name === 'target_menu_id')) {
  db.exec('ALTER TABLE coupons ADD COLUMN target_menu_id INTEGER NOT NULL DEFAULT 0 CHECK (target_menu_id >= 0)');
}

db.exec('DROP TABLE IF EXISTS importantDetailsUpdate');
if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'credit')) {
  db.exec('ALTER TABLE users ADD COLUMN credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0)');
}
if (!db.prepare('PRAGMA table_info(orders)').all().some((column) => column.name === 'payment_method')) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'onsite' CHECK (payment_method IN ('onsite', 'credit'))");
}
if (!db.prepare('PRAGMA table_info(orders)').all().some((column) => column.name === 'payment_reference')) {
  db.exec('ALTER TABLE orders ADD COLUMN payment_reference TEXT');
}
const phoneRequestColumns = db.prepare('PRAGMA table_info(phone_verification_requests)').all();
if (!phoneRequestColumns.some((column) => column.name === 'code_hash')) {
  db.exec('ALTER TABLE phone_verification_requests ADD COLUMN code_hash TEXT');
  db.exec("UPDATE phone_verification_requests SET used_at = datetime('now') WHERE used_at IS NULL");
}
if (phoneRequestColumns.some((column) => column.name === 'verification_sid')) {
  db.exec('ALTER TABLE phone_verification_requests DROP COLUMN verification_sid');
}
if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'email_verified_at')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
}
for (const table of ['users', 'business_registrations', 'categories', 'stores', 'coupons', 'signKeyWords', 'menus']) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === 'deleted_at')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`);
  }
}

const uuidTables = [
  ['account_ids', 'user_id'],
  ['business_registrations', 'registration_id'],
  ['user_sessions', 'session_id'],
  ['categories', 'category_id'],
  ['stores', 'store_id'],
  ['coupons', 'coupon_id'],
  ['signKeyWords', 'id'],
  ['menus', 'menu_id'],
  ['orders', 'order_id'],
  ['items', 'item_id'],
];

// Approval is represented solely by status; remove the former duplicate flag.
const businessColumns = db.prepare('PRAGMA table_info(business_registrations)').all();
db.exec('DROP TRIGGER IF EXISTS business_granted_insert; DROP TRIGGER IF EXISTS business_granted_status_update;');
if (businessColumns.some((column) => column.name === 'isGranted')) {
  db.exec('ALTER TABLE business_registrations DROP COLUMN isGranted');
}

for (const [table, primaryKey] of uuidTables) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === 'uuid')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN uuid TEXT`);
  }
  const missingUuids = db.prepare(`SELECT ${primaryKey} AS id FROM ${table} WHERE uuid IS NULL OR uuid = ''`).all();
  const updateUuid = db.prepare(`UPDATE ${table} SET uuid = ? WHERE ${primaryKey} = ?`);
  for (const row of missingUuids) updateUuid.run(randomUUID(), row.id);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uuid ON ${table}(uuid)`);
}

const storeColumns = db.prepare('PRAGMA table_info(stores)').all();
if (!storeColumns.some(column => column.name === 'min_order_minutes')) db.exec('ALTER TABLE stores ADD COLUMN min_order_minutes INTEGER NOT NULL DEFAULT 0 CHECK (min_order_minutes BETWEEN 0 AND 43200)');
if (!storeColumns.some((column) => column.name === 'owner_id')) {
  db.exec('ALTER TABLE stores ADD COLUMN owner_id INTEGER REFERENCES account_ids(user_id) ON DELETE SET NULL');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id)');

const orderColumns = db.prepare('PRAGMA table_info(orders)').all();
if (!orderColumns.some(column => column.name === 'party_size')) db.exec('ALTER TABLE orders ADD COLUMN party_size INTEGER CHECK (party_size BETWEEN 1 AND 99)');
if (!orderColumns.some(column => column.name === 'coupon_uuid')) db.exec('ALTER TABLE orders ADD COLUMN coupon_uuid TEXT');
if (!orderColumns.some(column => column.name === 'discount_amount')) db.exec('ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)');
if (!orderColumns.some((column) => column.name === 'customer_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES account_ids(user_id) ON DELETE SET NULL');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(customer_id, payment_reference)');

module.exports = db;
