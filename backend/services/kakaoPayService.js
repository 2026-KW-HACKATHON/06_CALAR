const { randomUUID } = require('node:crypto');
const db = require('../db');
const { transaction } = require('./transaction');
const credit = require('./creditService');
const HttpError = require('../utils/httpError');

function configuration() {
  const key = process.env.KAKAOPAY_SECRET_KEY?.trim();
  const cid = process.env.KAKAOPAY_CID?.trim();
  const mode = process.env.KAKAOPAY_MODE;
  if (!key || !cid || !['test', 'live'].includes(mode)) throw new HttpError(503, 'KakaoPay is not configured');
  if ((mode === 'live' && cid.startsWith('TC')) || (mode === 'test' && cid !== 'TC0ONETIME')) throw new HttpError(503, 'Invalid KakaoPay mode');
  let url;
  try { url = new URL(process.env.CALAR_PUBLIC_URL); } catch { throw new HttpError(503, 'Payment return URL is not configured'); }
  if (!['http:', 'https:'].includes(url.protocol) || (mode === 'live' && url.protocol !== 'https:')) throw new HttpError(503, 'Live payments require HTTPS');
  return { key, cid, mode, url };
}

function settings() {
  try { return { enabled: true, mode: configuration().mode }; }
  catch { return { enabled: false, mode: null }; }
}

async function request(action, body) {
  const config = configuration();
  let response, data;
  try {
    response = await fetch(`https://open-api.kakaopay.com/online/v1/payment/${action}`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `SECRET_KEY ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid: config.cid, ...body }),
    });
    data = await response.json();
  } catch { throw new HttpError(503, 'Payment provider unavailable'); }
  if (!response.ok) {
    console.error('[KakaoPay] Request failed:', action, response.status);
    throw new HttpError(502, 'Payment provider rejected request');
  }
  return data;
}

function payment(userId, id) {
  if (typeof id !== 'string' || !id) throw new HttpError(400, 'paymentId is required');
  const row = db.prepare('SELECT * FROM credit_payments WHERE uuid = ? AND user_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Payment not found');
  return row;
}

function publicPayment(row) { return { paymentId: row.uuid, amount: row.amount, status: row.status, redirectPc: row.redirect_pc, redirectMobile: row.redirect_mobile }; }

async function ready(userId, body) {
  const config = configuration();
  credit.balance(userId);
  if (!Number.isSafeInteger(body?.amount) || body.amount < 1000 || body.amount > 1000000 || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new HttpError(400, 'Invalid payment amount or requestId');
  const old = db.prepare('SELECT * FROM credit_payments WHERE user_id = ? AND request_id = ?').get(userId, body.requestId);
  if (old) {
    if (old.amount !== body.amount) throw new HttpError(409, 'Payment request already used');
    if (old.status === 'preparing' || old.status === 'failed') throw new HttpError(409, 'Payment preparation incomplete');
    return publicPayment(old);
  }
  const id = randomUUID();
  db.prepare('INSERT INTO credit_payments (uuid, user_id, request_id, amount, cid) VALUES (?, ?, ?, ?, ?)').run(id, userId, body.requestId, body.amount, config.cid);
  const callback = (outcome) => {
    const url = new URL(body.client === 'mobile' ? '/mobile/payment-result' : '/customer/payment-result', config.url);
    url.search = new URLSearchParams({ paymentId: id, outcome }).toString(); return url.toString();
  };
  try {
    const data = await module.exports.request('ready', {
      partner_order_id: id, partner_user_id: String(userId), item_name: '월계 크레딧 충전', quantity: 1,
      total_amount: body.amount, tax_free_amount: 0,
      approval_url: callback('success'), cancel_url: callback('cancel'), fail_url: callback('fail'),
    });
    const safeUrl = (value) => {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !['kakaopay.com', 'kakao.com'].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error('Invalid provider redirect');
      return url.toString();
    };
    if (typeof data.tid !== 'string' || !data.tid) throw new Error('Missing payment id');
    db.prepare("UPDATE credit_payments SET tid = ?, status = 'ready', redirect_pc = ?, redirect_mobile = ? WHERE uuid = ?")
      .run(data.tid, safeUrl(data.next_redirect_pc_url), safeUrl(data.next_redirect_mobile_url), id);
    return publicPayment(payment(userId, id));
  } catch (error) {
    db.prepare("UPDATE credit_payments SET status = 'failed' WHERE uuid = ?").run(id);
    throw error instanceof HttpError ? error : new HttpError(502, 'Invalid payment provider response');
  }
}

function grant(row, result) {
  if (result.tid !== row.tid || result.cid !== row.cid || result.partner_order_id !== row.uuid || result.partner_user_id !== String(row.user_id) || result.amount?.total !== row.amount) {
    db.prepare("UPDATE credit_payments SET status = 'review' WHERE uuid = ? AND status != 'approved'").run(row.uuid);
    throw new HttpError(409, 'Payment verification mismatch');
  }
  transaction(() => {
    const fresh = payment(row.user_id, row.uuid);
    if (fresh.status === 'approved') return;
    credit.change(row.user_id, row.amount, 'topup', `kakaopay:${row.tid}`);
    db.prepare("UPDATE credit_payments SET status = 'approved', approved_at = datetime('now') WHERE uuid = ?").run(row.uuid);
  });
  return { ...publicPayment(payment(row.user_id, row.uuid)), credit: credit.balance(row.user_id) };
}

async function approve(userId, body) {
  credit.balance(userId);
  const row = payment(userId, body?.paymentId);
  if (row.status === 'approved') return { ...publicPayment(row), credit: credit.balance(userId) };
  if (row.cid !== configuration().cid || !['ready', 'approving'].includes(row.status)) throw new HttpError(409, 'Payment cannot be approved');
  // If approval timed out, query the provider before attempting any further charge.
  if (row.status === 'approving') {
    const result = await module.exports.request('order', { tid: row.tid });
    if (result.status === 'SUCCESS_PAYMENT') return grant(row, result);
    throw new HttpError(409, 'Payment approval pending');
  }
  if (typeof body.pgToken !== 'string' || !body.pgToken || body.pgToken.length > 1000) throw new HttpError(400, 'Payment token is required');
  const reserved = db.prepare("UPDATE credit_payments SET status = 'approving' WHERE uuid = ? AND status = 'ready'").run(row.uuid);
  if (!reserved.changes) throw new HttpError(409, 'Payment approval pending');
  try {
    const result = await module.exports.request('approve', { tid: row.tid, partner_order_id: row.uuid, partner_user_id: String(userId), pg_token: body.pgToken, total_amount: row.amount });
    return grant(row, result);
  } catch (error) {
    if (error.message === 'Payment verification mismatch') throw error;
    try {
      const result = await module.exports.request('order', { tid: row.tid });
      if (result.status === 'SUCCESS_PAYMENT') return grant(row, result);
      if (['READY', 'SEND_TMS', 'OPEN_PAYMENT', 'SELECT_METHOD', 'ARS_WAITING', 'AUTH_PASSWORD'].includes(result.status)) db.prepare("UPDATE credit_payments SET status = 'ready' WHERE uuid = ? AND status = 'approving'").run(row.uuid);
    } catch { /* Keep approving state for later reconciliation; never grant unverified credit. */ }
    throw error;
  }
}

module.exports = { configuration, settings, request, ready, approve };
