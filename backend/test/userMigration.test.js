const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const migrate = require('../services/userMigration');

test('role migration preserves IDs, credentials, balances and foreign keys', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT,
        email TEXT UNIQUE, password_hash TEXT, display_name TEXT, phone TEXT,
        address TEXT, role TEXT, is_active INTEGER, credit INTEGER, created_at TEXT);
      INSERT INTO users VALUES (42, 'old-uuid', 'old@example.com', 'hash', 'Old', 'abc',
        NULL, 'customer', 1, 1200, '2026-01-01');
      CREATE TABLE links (user_id INTEGER REFERENCES users(user_id));
      INSERT INTO links VALUES (42);`);
    migrate(db);
    for (const table of ['customer_users', 'owner_users', 'admin_users']) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
      for (const redundant of ['role', 'email', 'email_verified_at', 'password_hash', 'uuid']) {
        assert.equal(columns.includes(redundant), false, `${table} contains ${redundant}`);
      }
    }
    assert.deepEqual(db.prepare('PRAGMA table_info(account_ids)').all().map(column => column.name), ['user_id', 'uuid']);
    assert.equal(db.prepare('SELECT credit FROM customer_users WHERE user_id = 42').get().credit, 1200);
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE user_id = 42').get().password_hash, 'hash');
    assert.equal(db.prepare('PRAGMA foreign_key_list(links)').get().table, 'account_ids');
    db.exec("UPDATE users SET role = 'admin' WHERE user_id = 42");
    assert.equal(db.prepare('SELECT count(*) AS n FROM customer_users').get().n, 0);
    assert.equal(db.prepare('SELECT credit FROM admin_users WHERE user_id = 42').get().credit, 1200);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    migrate(db);
    db.exec(fs.readFileSync(path.join(__dirname, '../setup.sql'), 'utf8'));
    assert.equal(db.prepare('SELECT role FROM users WHERE user_id = 42').get().role, 'admin');
    assert.throws(() => db.exec("INSERT INTO users (email, password_hash, display_name, role) VALUES ('old@example.com', 'hash', 'Duplicate', 'owner')"), /UNIQUE/);
  } finally { db.close(); }
});

test('existing split tables lose synthetic credentials and redundant columns', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE account_ids (user_id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, uuid TEXT NOT NULL UNIQUE);
      INSERT INTO account_ids VALUES (7, 'fake@phone.calar.invalid', 'phone-uuid');`);
    for (const role of ['customer', 'owner', 'admin']) {
      db.exec(`CREATE TABLE ${role}_users (user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id),
        uuid TEXT, email TEXT, email_verified_at TEXT, password_hash TEXT, display_name TEXT,
        phone TEXT, address TEXT, role TEXT CHECK(role = '${role}'), is_active INTEGER,
        credit INTEGER, created_at TEXT, deleted_at TEXT)`);
    }
    db.exec(`INSERT INTO customer_users VALUES (7, 'phone-uuid', 'fake@phone.calar.invalid', NULL,
      'unused-hash', 'Customer', '01012345678', NULL, 'customer', 1, 1500, '2026-01-01', NULL);
      CREATE VIEW users AS SELECT * FROM customer_users UNION ALL SELECT * FROM owner_users UNION ALL SELECT * FROM admin_users;
      CREATE TABLE existing_sessions (user_id INTEGER REFERENCES account_ids(user_id));
      INSERT INTO existing_sessions VALUES (7);
      UPDATE sqlite_sequence SET seq = 100 WHERE name = 'account_ids';`);
    migrate(db);
    assert.equal(db.prepare('SELECT email FROM users WHERE user_id = 7').get().email, null);
    assert.equal(db.prepare('SELECT credit FROM customer_users WHERE user_id = 7').get().credit, 1500);
    assert.equal(db.prepare('SELECT count(*) AS n FROM email_credentials').get().n, 0);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.exec("INSERT INTO users (uuid, display_name) VALUES ('next-uuid', 'Next')");
    assert.equal(db.prepare("SELECT user_id FROM account_ids WHERE uuid = 'next-uuid'").get().user_id, 101);
    migrate(db);
    assert.equal(db.prepare('SELECT count(*) AS n FROM customer_users').get().n, 2);
  } finally { db.close(); }
});

test('customers accept arbitrary profile phones while owners still validate them', () => {
  process.env.CALAR_DB_PATH = ':memory:';
  const auth = require('../services/authService');
  const management = require('../services/managementService');
  const db = require('../db');
  const phoneOnly = auth.register({ role: 'customer', phone: 'abc' });
  assert.equal(phoneOnly.email, null);
  assert.equal(phoneOnly.phone, 'abc');
  assert.equal(db.prepare('SELECT * FROM email_credentials WHERE user_id = ?').get(phoneOnly.id), undefined);
  assert.equal(auth.userFromToken(auth.createSession(phoneOnly.id).token).id, phoneOnly.id);
  const user = auth.register({ email: 'free-phone@example.com', password: 'long-password-2026', displayName: 'Customer', phone: 'abc' });
  assert.equal(user.phone, 'abc');
  assert.equal(management.updateProfile(user.id, { phone: '123' }).phone, '123');
  assert.throws(() => auth.register({ email: 'owner@example.com', password: 'long-password-2026', displayName: 'Owner', role: 'owner', phone: 'abc' }), /Invalid phone/);
});
