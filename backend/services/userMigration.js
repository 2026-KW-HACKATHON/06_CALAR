const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Preserve identities while normalizing original and split account schemas.
module.exports = function migrateUsers(db) {
  const source = db.prepare("SELECT type FROM sqlite_master WHERE name = 'users'").get();
  if (!source) return;
  if (source.type === 'view' && !db.prepare('PRAGMA table_info(customer_users)').all().some(c => c.name === 'role')) return;
  const schema = fs.readFileSync(path.join(__dirname, '../setup.sql'), 'utf8').split('CREATE TABLE IF NOT EXISTS business_registrations')[0];
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    if (source.type === 'table') {
      const columns = db.prepare('PRAGMA table_info(users)').all();
      for (const [name, type] of [['credit', 'INTEGER NOT NULL DEFAULT 0'], ['email_verified_at', 'TEXT'], ['deleted_at', 'TEXT'], ['uuid', 'TEXT']]) {
        if (!columns.some(c => c.name === name)) db.exec('ALTER TABLE users ADD COLUMN ' + name + ' ' + type);
      }
    }
    const rows = db.prepare('SELECT * FROM users').all();
    const sequence = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(source.type === 'table' ? 'users' : 'account_ids')?.seq ?? 0;
    if (source.type === 'table') {
      db.exec('ALTER TABLE users RENAME TO account_ids');
    } else {
      db.exec('DROP TRIGGER IF EXISTS users_insert; DROP TRIGGER IF EXISTS users_update; DROP TRIGGER IF EXISTS users_delete; DROP VIEW users;');
      for (const role of ['customer', 'owner', 'admin']) db.exec('DROP TABLE ' + role + '_users');
    }
    db.exec('DROP TABLE account_ids');
    db.exec(schema);
    for (const row of rows) {
      if (!['customer', 'owner', 'admin'].includes(row.role)) throw new Error('Unknown legacy account role');
      db.prepare('INSERT INTO account_ids (user_id, uuid) VALUES (?, ?)').run(row.user_id, row.uuid || randomUUID());
      db.prepare('INSERT INTO ' + row.role + '_users (user_id, display_name, phone, address, is_active, credit, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(row.user_id, row.display_name, row.phone, row.address, row.is_active, row.credit, row.created_at, row.deleted_at);
      // SMS accounts require no artificial email or password. Preserve real legacy logins.
      if (row.email && !row.email.endsWith('@phone.calar.invalid')) {
        db.prepare('INSERT INTO email_credentials (user_id, email, password_hash, email_verified_at) VALUES (?, ?, ?, ?)')
          .run(row.user_id, row.email, row.password_hash, row.email_verified_at);
      }
    }
    db.prepare('UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = ?').run(sequence, 'account_ids');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Account migration would break foreign keys');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
};
