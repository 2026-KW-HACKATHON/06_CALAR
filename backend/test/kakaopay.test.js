const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./helpers');
const auth = require('../services/authService');
const credit = require('../services/creditService');
const db = require('../db');
const kakao = require('../services/kakaoPayService');

test('KakaoPay validates ownership and amount, grants once, and recovers lost approval', async () => {
  const names = ['KAKAOPAY_MODE', 'KAKAOPAY_CID', 'KAKAOPAY_SECRET_KEY', 'CALAR_PUBLIC_URL'];
  const saved = names.map((name) => process.env[name]);
  const original = kakao.request;
  Object.assign(process.env, { KAKAOPAY_MODE: 'test', KAKAOPAY_CID: 'TC0ONETIME', KAKAOPAY_SECRET_KEY: 'test-only', CALAR_PUBLIC_URL: 'http://localhost:5173' });
  try {
    const user = auth.register({ email: 'pay@calar.local', password: 'payment-test-password', displayName: 'Payment' });
    const other = auth.register({ email: 'other-pay@calar.local', password: 'payment-test-password', displayName: 'Other' });
    let approvedCalls = 0;
    let mismatch = false, timeout = false;
    kakao.request = async (action, body) => {
      if (action === 'ready') return { tid: randomUUID(), next_redirect_pc_url: 'https://mockup-pg-web.kakao.com/pay', next_redirect_mobile_url: 'https://mockup-pg-web.kakao.com/pay' };
      const row = db.prepare('SELECT * FROM credit_payments WHERE tid = ?').get(body.tid);
      if (action === 'approve') { approvedCalls++; if (timeout) throw new Error('timeout'); }
      return { status: 'SUCCESS_PAYMENT', tid: row.tid, cid: row.cid, partner_order_id: row.uuid, partner_user_id: String(row.user_id), amount: { total: mismatch ? row.amount + 1 : row.amount } };
    };
    const request = { amount: 10000, requestId: randomUUID() };
    const first = await kakao.ready(user.id, request);
    assert.equal((await kakao.ready(user.id, request)).paymentId, first.paymentId);
    await assert.rejects(kakao.approve(other.id, { paymentId: first.paymentId, pgToken: 'token' }), /not found/);
    await kakao.approve(user.id, { paymentId: first.paymentId, pgToken: 'token' });
    await kakao.approve(user.id, { paymentId: first.paymentId });
    assert.equal(approvedCalls, 1);
    assert.equal(credit.balance(user.id), 10000);
    mismatch = true;
    const bad = await kakao.ready(user.id, { amount: 10000, requestId: randomUUID() });
    await assert.rejects(kakao.approve(user.id, { paymentId: bad.paymentId, pgToken: 'token' }), /mismatch/);
    assert.equal(credit.balance(user.id), 10000);
    mismatch = false; timeout = true;
    const lost = await kakao.ready(user.id, { amount: 20000, requestId: randomUUID() });
    assert.equal((await kakao.approve(user.id, { paymentId: lost.paymentId, pgToken: 'token' })).status, 'approved');
    assert.equal(credit.balance(user.id), 30000);
    process.env.KAKAOPAY_MODE = 'live';
    assert.throws(kakao.configuration, /Invalid KakaoPay mode/);
    assert.equal(credit.devTopupEnabled(), false);
  } finally {
    kakao.request = original;
    names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
  }
});
