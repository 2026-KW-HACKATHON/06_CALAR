const { randomUUID, randomInt, scryptSync, timingSafeEqual } = require('node:crypto');
const db = require('../db');
const { transaction } = require('./transaction');
const HttpError = require('../utils/httpError');
const sms = require('./smsService');

function normalizePhone(value) {
  const input = String(value || '').replace(/[\s()-]/g, '');
  if (/^010\d{8}$/.test(input)) return `+82${input.slice(1)}`;
  if (/^\+8210\d{8}$/.test(input)) return input;
  throw new HttpError(400, 'Invalid mobile phone');
}

function hashCode(code, requestId) { return scryptSync(code, requestId, 32).toString('hex'); }

async function sendCode(body) {
  const phone = normalizePhone(body?.phone);
  sms.configuration();
  const uuid = randomUUID();
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const hash = hashCode(code, uuid);
  transaction(() => {
    const recent = db.prepare('SELECT expires_at FROM phone_verification_requests WHERE phone = ? ORDER BY expires_at DESC LIMIT 1').get(phone);
    if (recent && Date.parse(recent.expires_at) - 10 * 60 * 1000 > Date.now() - 60000) throw new HttpError(429, 'Wait before requesting another SMS');
    db.prepare("INSERT INTO phone_verification_requests (uuid, phone, code_hash, expires_at, used_at) VALUES (?, ?, ?, ?, datetime('now'))")
      .run(uuid, phone, hash, new Date(Date.now() + 10 * 60 * 1000).toISOString());
  });
  try {
    const result = await sms.sendCode(phone, code);
    transaction(() => {
      db.prepare("UPDATE phone_verification_requests SET used_at = datetime('now') WHERE phone = ? AND used_at IS NULL").run(phone);
      db.prepare('UPDATE phone_verification_requests SET used_at = NULL WHERE uuid = ?').run(uuid);
    });
    return { requestId: uuid, expiresIn: 600, ...(result.mock ? { mock: true, mockCode: code } : {}) };
  } catch (error) {
    db.prepare('DELETE FROM phone_verification_requests WHERE uuid = ?').run(uuid);
    throw error;
  }
}

async function checkCode(body) {
  if (typeof body?.requestId !== 'string' || typeof body?.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new HttpError(400, 'Invalid SMS code');
  const request = db.prepare('SELECT * FROM phone_verification_requests WHERE uuid = ? AND used_at IS NULL AND expires_at > ?').get(body.requestId, new Date().toISOString());
  if (!request || !request.code_hash || request.attempts >= 5) throw new HttpError(400, 'Invalid or expired SMS code');
  db.prepare('UPDATE phone_verification_requests SET attempts = attempts + 1 WHERE uuid = ?').run(request.uuid);
  const expected = Buffer.from(request.code_hash, 'hex');
  const actual = Buffer.from(hashCode(body.code, request.uuid), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new HttpError(400, 'Invalid SMS code');
  return require('./authService').authenticatePhone(request.phone, request.uuid);
}

module.exports = { normalizePhone, hashCode, sendCode, checkCode };
