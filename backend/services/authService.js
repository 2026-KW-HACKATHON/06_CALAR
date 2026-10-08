const { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } = require('node:crypto');
const db = require('../db');
const { transaction } = require('./transaction');
const HttpError = require('../utils/httpError');
const { isPlainObject } = require('../utils/validate');

const configuredSessionDays = Number(process.env.CALAR_SESSION_DAYS ?? 90);
const SESSION_DAYS = Number.isInteger(configuredSessionDays) && configuredSessionDays >= 1 && configuredSessionDays <= 365 ? configuredSessionDays : 90;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\s-]{7,24}$/;

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function normalizeBusinessNumber(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function isValidBusinessNumber(value) {
  const digits = normalizeBusinessNumber(value);
  if (digits.length !== 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

function publicUser(userId) {
  const user = db.prepare(`
    SELECT user_id AS id, uuid, email, email_verified_at AS emailVerifiedAt, credit, display_name AS displayName, phone, address, role, created_at AS createdAt
    FROM users WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL
  `).get(userId);
  if (!user) return null;
  user.phoneVerifiedAt = db.prepare('SELECT verified_at FROM phone_identities WHERE user_id = ?').get(userId)?.verified_at ?? null;
  if (user.role === 'owner') {
    user.business = db.prepare(`
      SELECT uuid, business_number AS businessNumber, legal_name AS legalName,
        representative_name AS representativeName, address, status,
        rejection_reason AS rejectionReason, verified_at AS verifiedAt
      FROM business_registrations WHERE user_id = ? AND deleted_at IS NULL
    `).get(userId) ?? null;
  }
  return user;
}

function register(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const role = body.role ?? 'customer';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new HttpError(400, 'Invalid email');
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw new HttpError(400, 'Password must be between 10 and 128 characters');
  }
  if (!displayName || displayName.length > 80) throw new HttpError(400, 'displayName is required');
  if (!['customer', 'owner'].includes(role)) throw new HttpError(400, 'Invalid role');
  if (body.phone !== undefined && body.phone !== '' && (typeof body.phone !== 'string' || !PHONE_PATTERN.test(body.phone))) {
    throw new HttpError(400, 'Invalid phone');
  }
  if (body.address !== undefined && (typeof body.address !== 'string' || body.address.length > 240)) {
    throw new HttpError(400, 'Invalid address');
  }

  let business;
  if (role === 'owner') {
    const details = body.business;
    if (!isPlainObject(details)) throw new HttpError(400, 'Business registration is required for owners');
    const businessNumber = normalizeBusinessNumber(details.businessNumber);
    const legalName = typeof details.legalName === 'string' ? details.legalName.trim() : '';
    const representativeName = typeof details.representativeName === 'string' ? details.representativeName.trim() : '';
    const address = typeof details.address === 'string' ? details.address.trim() : '';
    if (!isValidBusinessNumber(businessNumber)) throw new HttpError(400, 'Invalid business registration number checksum');
    if (!legalName || legalName.length > 120 || !representativeName || representativeName.length > 80 || !address || address.length > 240) {
      throw new HttpError(400, 'Complete business name, representative, and address are required');
    }
    business = { businessNumber, legalName, representativeName, address };
  }

  db.exec('BEGIN');
  try {
    const result = db.prepare(`
      INSERT INTO users (uuid, email, password_hash, display_name, phone, address, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), email, hashPassword(password), displayName, body.phone || null, body.address || null, role);
    const userId = Number(result.lastInsertRowid);

    if (business) {
      const businessResult = db.prepare(`
        INSERT INTO business_registrations (uuid, user_id, business_number, legal_name, representative_name, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), userId, business.businessNumber, business.legalName, business.representativeName, business.address);

    }
    db.exec('COMMIT');
    return publicUser(userId);
  } catch (error) {
    db.exec('ROLLBACK');
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.errcode === 2067) {
      throw new HttpError(409, 'Email or business registration number is already registered');
    }
    throw error;
  }
}

function updateBusinessRegistration(userId, body) {
  const user = db.prepare('SELECT role FROM users WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL').get(userId);
  if (!user || user.role !== 'owner') throw new HttpError(403, 'Owner account required');
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const businessNumber = normalizeBusinessNumber(body.businessNumber);
  const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
  const representativeName = typeof body.representativeName === 'string' ? body.representativeName.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!isValidBusinessNumber(businessNumber)) throw new HttpError(400, 'Invalid business registration number checksum');
  if (!legalName || legalName.length > 120 || !representativeName || representativeName.length > 80 || !address || address.length > 240) {
    throw new HttpError(400, 'Complete business name, representative, and address are required');
  }
  try {
    const before = db.prepare(`
      SELECT registration_id, legal_name, representative_name, address, status, rejection_reason
      FROM business_registrations WHERE user_id = ? AND deleted_at IS NULL
    `).get(userId);
    if (!before) throw new HttpError(404, 'Business registration not found');
    const after = {
      legal_name: legalName,
      representative_name: representativeName,
      address,
      status: 'pending',
      rejection_reason: null,
    };
    transaction(() => {
      db.prepare(`
        UPDATE business_registrations
        SET business_number = ?, legal_name = ?, representative_name = ?, address = ?,
          status = 'pending', rejection_reason = NULL, verified_at = NULL, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(businessNumber, legalName, representativeName, address, userId);

    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.errcode === 2067) throw new HttpError(409, 'Business registration number is already registered');
    throw error;
  }
  return publicUser(userId);
}

function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO user_sessions (uuid, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, tokenHash, expiresAt);
  return { token, expiresAt };
}

function login(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const user = db.prepare('SELECT user_id, password_hash FROM users WHERE email = ? AND is_active = 1 AND deleted_at IS NULL').get(email);
  if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user.password_hash)) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  // expires_at은 ISO 형식(2026-10-08T01:00:00.000Z)이라 SQLite datetime('now')(공백 구분)와 문자열 비교하면 안 맞는다
  db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  return { ...createSession(user.user_id), user: publicUser(user.user_id) };
}

function userFromToken(token) {
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = db.prepare(`
    SELECT user_id FROM user_sessions WHERE token_hash = ? AND expires_at > ?
  `).get(tokenHash, new Date().toISOString());
  return session ? publicUser(session.user_id) : null;
}

function logout(token) {
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
  }
}

function listUserOrders(userId) {
  return db.prepare('SELECT order_id AS id FROM orders WHERE customer_id = ? ORDER BY created_at DESC, order_id DESC')
    .all(userId)
    .map(({ id }) => require('./orderService').getOrderById(id));
}

// promoteExisting: 이미 있는 일반 계정을 관리자로 올릴지. 서버 콘솔 스크립트에서만 true(비밀번호도 함께 재설정)
function provisionAdmin({ email: rawEmail, password, resetPassword = true, promoteExisting = true }) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new Error('A valid admin email is required');
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    throw new Error('Admin password must be between 6 and 128 characters');
  }
  return transaction(() => {
    const existing = db.prepare('SELECT user_id, role, is_active, deleted_at FROM users WHERE email = ?').get(email);
    if (!existing) {
      const result = db.prepare(`
        INSERT INTO users (uuid, email, password_hash, display_name, role)
        VALUES (?, ?, ?, 'CALAR 관리자', 'admin')
      `).run(randomUUID(), email, hashPassword(password));
      const id = Number(result.lastInsertRowid);

      return publicUser(id);
    }
    if (existing.deleted_at) throw new Error('Cannot promote a deleted account');
    if (existing.role !== 'admin' && !promoteExisting) {
      throw Object.assign(
        new Error(`An account with ${email} already exists and is not an admin. Run "npm run admin:provision" from the server console to promote it (this also resets its password).`),
        { code: 'ADMIN_EMAIL_TAKEN' }
      );
    }
    db.prepare('UPDATE users SET role = ?, is_active = 1 WHERE user_id = ?').run('admin', existing.user_id);

    if (resetPassword) {
      db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(hashPassword(password), existing.user_id);
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(existing.user_id);
    }
    return publicUser(existing.user_id);
  });
}

async function requestEmailVerification(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new HttpError(400, 'Invalid email');
  const mail = require('./mailService');
  try { mail.configuration(); } catch { throw new HttpError(503, 'Email verification is not configured'); }
  const user = db.prepare('SELECT user_id FROM users WHERE email = ? AND is_active = 1 AND deleted_at IS NULL AND email_verified_at IS NULL').get(email);
  if (!user) return;
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  db.prepare('INSERT INTO email_verification_tokens (uuid, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), user.user_id, hash, new Date(Date.now() + 15 * 60 * 1000).toISOString());
  try { await mail.sendVerification(email, token); }
  catch {
    db.prepare('DELETE FROM email_verification_tokens WHERE token_hash = ?').run(hash);
    console.error('[mail] Email verification delivery failed');
  }
}

function verifyEmail(body) {
  if (!isPlainObject(body) || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new HttpError(400, 'Invalid or expired verification link');
  const hash = createHash('sha256').update(body.token).digest('hex');
  transaction(() => {
    const record = db.prepare(`SELECT email_verification_tokens.user_id FROM email_verification_tokens
      JOIN users ON users.user_id = email_verification_tokens.user_id
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND users.is_active = 1 AND users.deleted_at IS NULL AND users.email_verified_at IS NULL`)
      .get(hash, new Date().toISOString());
    if (!record) throw new HttpError(400, 'Invalid or expired verification link');
    db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE user_id = ?").run(record.user_id);
    db.prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL").run(record.user_id);
  });
}

async function requestPasswordRecovery(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new HttpError(400, 'Invalid email');
  const mail = require('./mailService');
  try { mail.configuration(); } catch { throw new HttpError(503, 'Email recovery is not configured'); }
  const user = db.prepare('SELECT user_id FROM users WHERE email = ? AND is_active = 1 AND deleted_at IS NULL').get(email);
  if (!user) return;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  db.prepare('INSERT INTO password_reset_tokens (uuid, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), user.user_id, tokenHash, new Date(Date.now() + 15 * 60 * 1000).toISOString());
  try { await mail.sendPasswordReset(email, token); }
  catch {
    db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenHash);
    // Keep the public response identical for registered and unknown emails.
    console.error('[mail] Password recovery delivery failed');
  }
}

function completePasswordRecovery(body) {
  if (!isPlainObject(body) || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new HttpError(400, 'Invalid or expired recovery link');
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 10 || body.newPassword.length > 128) throw new HttpError(400, 'Password must be between 10 and 128 characters');
  const tokenHash = createHash('sha256').update(body.token).digest('hex');
  transaction(() => {
    const record = db.prepare(`SELECT password_reset_tokens.user_id FROM password_reset_tokens
      JOIN users ON users.user_id = password_reset_tokens.user_id
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND users.is_active = 1 AND users.deleted_at IS NULL`)
      .get(tokenHash, new Date().toISOString());
    if (!record) throw new HttpError(400, 'Invalid or expired recovery link');
    db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(hashPassword(body.newPassword), record.user_id);
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL").run(record.user_id);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(record.user_id);
  });
}

function resetPassword(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const user = db.prepare('SELECT user_id, password_hash FROM users WHERE email = ? AND is_active = 1 AND deleted_at IS NULL').get(email);
  if (!user || typeof body.currentPassword !== 'string' || body.currentPassword.length > 128 || !verifyPassword(body.currentPassword, user.password_hash)) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 10 || body.newPassword.length > 128) {
    throw new HttpError(400, 'Password must be between 10 and 128 characters');
  }
  if (body.newPassword === body.currentPassword) throw new HttpError(400, 'New password must be different');
  transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(hashPassword(body.newPassword), user.user_id);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.user_id);
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL").run(user.user_id);
  });
}

function authenticatePhone(phone, requestId) {
  return transaction(() => {
    const consumed = db.prepare("UPDATE phone_verification_requests SET used_at = datetime('now') WHERE uuid = ? AND phone = ? AND used_at IS NULL AND expires_at > ?")
      .run(requestId, phone, new Date().toISOString());
    if (consumed.changes !== 1) throw new HttpError(400, 'Invalid or expired SMS code');
    const identity = db.prepare('SELECT user_id FROM phone_identities WHERE phone = ?').get(phone);
    let userId = identity?.user_id;
    if (userId) {
      const existing = publicUser(userId);
      if (!existing || existing.role !== 'customer') throw new HttpError(403, 'Phone account unavailable');
    } else {
      // Never attach phone login to an owner/admin account based on an unverified profile phone.
      const result = db.prepare("INSERT INTO users (uuid, email, password_hash, display_name, phone, role) VALUES (?, ?, ?, '고객', ?, 'customer')")
        .run(randomUUID(), `${randomUUID()}@phone.calar.invalid`, hashPassword(randomBytes(32).toString('hex')), `0${phone.slice(3)}`);
      userId = Number(result.lastInsertRowid);
      db.prepare('INSERT INTO phone_identities (phone, user_id) VALUES (?, ?)').run(phone, userId);
    }
    db.prepare("UPDATE phone_identities SET verified_at = datetime('now') WHERE phone = ?").run(phone);
    db.prepare("UPDATE phone_verification_requests SET used_at = datetime('now') WHERE phone = ? AND used_at IS NULL").run(phone);
    return { ...createSession(userId), user: publicUser(userId) };
  });
}

function bootstrapAdmin() {
  const email = process.env.CALAR_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.CALAR_ADMIN_PASSWORD;
  if (!email && !password) return;
  // 서버 시작 때는 관리자 계정을 "없으면 만들기"만 한다. 같은 이메일로 누군가 먼저 가입해 둔 일반 계정을
  // 자동 승격하면 그 사람이 정한 비밀번호로 관리자 로그인이 되므로 승격은 콘솔 스크립트로만 한다
  try {
    provisionAdmin({ email, password, resetPassword: false, promoteExisting: false });
  } catch (error) {
    if (error.code !== 'ADMIN_EMAIL_TAKEN') throw error;
    console.error(`[관리자 계정] ${error.message}`);
  }
}

bootstrapAdmin();

module.exports = {
  authenticatePhone,
  requestEmailVerification,
  verifyEmail,
  requestPasswordRecovery,
  completePasswordRecovery,
  resetPassword,
  provisionAdmin,
  bootstrapAdmin,
  createSession,
  isValidBusinessNumber,
  login,
  listUserOrders,
  logout,
  publicUser,
  register,
  userFromToken,
  updateBusinessRegistration,
};
