const { randomUUID } = require('node:crypto');
const db = require('../db');
const { transaction } = require('./transaction');
const HttpError = require('../utils/httpError');

function balance(userId) {
  const user = db.prepare('SELECT credit FROM users WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL').get(userId);
  if (!user) throw new HttpError(404, 'User not found');
  return user.credit;
}

// Must run within the caller's transaction so order/payment and balance commit together.
function change(userId, amount, kind, reference) {
  if (!Number.isSafeInteger(amount) || typeof reference !== 'string' || !reference || reference.length > 128) throw new HttpError(400, 'Invalid credit transaction');
  if (!['topup', 'payment', 'refund'].includes(kind) || (kind === 'payment' ? amount > 0 : amount <= 0)) throw new HttpError(400, 'Invalid credit transaction');
  const existing = db.prepare('SELECT amount FROM credit_transactions WHERE user_id = ? AND kind = ? AND reference = ?').get(userId, kind, reference);
  if (existing) {
    if (existing.amount !== amount) throw new HttpError(409, 'Credit reference already used');
    return;
  }
  const result = db.prepare(`UPDATE users SET credit = credit + ? WHERE user_id = ? ${kind === 'refund' ? '' : 'AND deleted_at IS NULL AND is_active = 1'} AND credit + ? >= 0 AND credit + ? <= 9007199254740991`)
    .run(amount, userId, amount, amount);
  if (!result.changes) throw new HttpError(400, 'Insufficient credit');
  const after = db.prepare('SELECT credit FROM users WHERE user_id = ?').get(userId).credit;
  db.prepare('INSERT INTO credit_transactions (uuid, user_id, amount, balance_after, kind, reference) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, amount, after, kind, reference);
}

function wallet(userId) {
  return { credit: balance(userId), kakaoPay: require('./kakaoPayService').settings(), devTopupEnabled: devTopupEnabled(), transactions: db.prepare(`SELECT uuid, amount, balance_after AS balanceAfter, kind, created_at AS createdAt
    FROM credit_transactions WHERE user_id = ? ORDER BY transaction_id DESC LIMIT 100`).all(userId) };
}

function devTopupEnabled() { return process.env.NODE_ENV !== 'production' && process.env.KAKAOPAY_MODE !== 'live' && process.env.CALAR_DEV_CREDIT === 'true'; }
function topup(userId, body) {
  if (!devTopupEnabled()) throw new HttpError(403, 'Development topup is disabled');
  if (!Number.isSafeInteger(body?.amount) || body.amount < 1000 || body.amount > 1000000 || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new HttpError(400, 'Invalid topup amount or requestId');
  transaction(() => { change(userId, body.amount, 'topup', body.requestId); });
  return wallet(userId);
}

module.exports = { balance, change, wallet, topup, devTopupEnabled };
