const express = require('express');
const authService = require('../services/authService');
const managementService = require('../services/managementService');
const HttpError = require('../utils/httpError');

const router = express.Router();

function bearerToken(req) {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(header);
  return match?.[1] ?? null;
}

function requireUser(req, res, next) {
  const user = authService.userFromToken(bearerToken(req));
  if (!user) return next(new HttpError(401, 'Authentication required'));
  req.user = user;
  req.token = bearerToken(req);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Insufficient permissions'));
    next();
  };
}

function optionalUser(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  const user = authService.userFromToken(token);
  if (!user) return next(new HttpError(401, 'Invalid or expired session'));
  req.user = user;
  req.token = token;
  next();
}

// IP별 요청 제한 (15분 단위). 용도마다 따로 센다.
// 문자 인증은 고객 로그인 수단이라, 가게·행사장처럼 여러 사람이 같은 와이파이(같은 IP)를 쓰면
// 이메일 복구와 같은 바구니로 10번만 허용할 때 정상 사용자도 막힌다
const LIMIT_WINDOW_MS = 15 * 60 * 1000;
const limitBuckets = new Map();
function ipLimit(name, max, { countFailuresOnly = false } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of limitBuckets) if (value.until <= now) limitBuckets.delete(key);
    const key = `${name}|${req.ip}`;
    const value = limitBuckets.get(key) || { count: 0, until: now + LIMIT_WINDOW_MS };
    if (value.count >= max) return next(new HttpError(429, 'Too many recovery attempts'));
    limitBuckets.set(key, value);
    if (countFailuresOnly) {
      res.on('finish', () => { if (res.statusCode >= 400) value.count += 1; });
    } else {
      value.count += 1;
    }
    next();
  };
}
// 문자 발송: 비용이 드니 IP당 상한 (같은 번호 재발송은 phoneService가 60초 간격으로 따로 막는다)
const smsSendLimit = ipLimit('sms-send', 30);
// 코드 확인: 틀린 시도만 센다 (요청 1건당 5회 제한은 phoneService가 따로 한다)
const smsCheckLimit = ipLimit('sms-check', 20, { countFailuresOnly: true });
const recoveryLimit = ipLimit('recovery', 10);

router.post('/phone/send-code', smsSendLimit, async (req, res) => {
  res.json(await require('../services/phoneService').sendCode(req.body));
});
router.post('/phone/check-code', smsCheckLimit, async (req, res) => {
  res.json(await require('../services/phoneService').checkCode(req.body));
});

router.post('/request-email-verification', recoveryLimit, async (req, res) => {
  await authService.requestEmailVerification(req.body);
  res.json({ message: 'If verification is needed, an email will be sent' });
});
router.post('/verify-email', recoveryLimit, (req, res) => {
  authService.verifyEmail(req.body);
  res.status(204).end();
});

router.post('/forgot-password', recoveryLimit, async (req, res) => {
  await authService.requestPasswordRecovery(req.body);
  res.json({ message: 'If the account exists, a recovery email will be sent' });
});
router.post('/recover-password', recoveryLimit, (req, res) => {
  authService.completePasswordRecovery(req.body);
  res.status(204).end();
});

router.post('/reset-password', (req, res) => {
  authService.resetPassword(req.body);
  res.status(204).end();
});

router.post('/register', (req, res) => {
  res.status(201).json({ user: authService.register(req.body) });
});

router.post('/login', (req, res) => {
  res.json(authService.login(req.body));
});

router.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});

router.get('/wallet', requireUser, (req, res) => {
  res.json(require('../services/creditService').wallet(req.user.id));
});
router.post('/wallet/dev-topup', requireUser, (req, res) => {
  res.json(require('../services/creditService').topup(req.user.id, req.body));
});

router.get('/orders', requireUser, (req, res) => {
  res.json(authService.listUserOrders(req.user.id));
});

router.patch('/profile', requireUser, (req, res) => {
  res.json({ user: managementService.updateProfile(req.user.id, req.body) });
});

router.put('/business', requireUser, (req, res) => {
  res.json({ user: authService.updateBusinessRegistration(req.user.id, req.body) });
});

router.post('/logout', requireUser, (req, res) => {
  authService.logout(req.token);
  res.status(204).end();
});

module.exports = { optionalUser, router, requireRole, requireUser };
