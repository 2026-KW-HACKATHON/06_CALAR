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

const recoveryAttempts = new Map();
function recoveryLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of recoveryAttempts) if (value.until <= now) recoveryAttempts.delete(key);
  const key = req.ip;
  const value = recoveryAttempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (value.count >= 10) return next(new HttpError(429, 'Too many recovery attempts'));
  value.count += 1; recoveryAttempts.set(key, value); next();
}

router.post('/phone/send-code', recoveryLimit, async (req, res) => {
  res.json(await require('../services/phoneService').sendCode(req.body));
});
router.post('/phone/check-code', recoveryLimit, async (req, res) => {
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
