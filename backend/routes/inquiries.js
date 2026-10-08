const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const auth = require('./auth');
const HttpError = require('../utils/httpError');
const { parseId } = require('../utils/validate');
const router = express.Router();
router.use(auth.requireUser);

function messages(customerId) {
  return db.prepare(`SELECT * FROM (SELECT message_id AS id, uuid, author_id AS authorId,
    body, created_at AS createdAt FROM inquiry_messages WHERE customer_id = ?
    ORDER BY message_id DESC LIMIT 200) ORDER BY id`).all(customerId);
}
function send(req, res, customerId) {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const requestId = req.body?.requestId;
  if (!body || body.length > 2000 || typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new HttpError(400, 'Invalid inquiry message');
  const existing = db.prepare('SELECT author_id, body FROM inquiry_messages WHERE customer_id = ? AND request_id = ?').get(customerId, requestId);
  if (existing && (existing.author_id !== req.user.id || existing.body !== body)) throw new HttpError(409, 'Message request already used');
  if (!existing) db.prepare('INSERT INTO inquiry_messages (uuid, customer_id, author_id, body, request_id) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), customerId, req.user.id, body, requestId);
  res.status(existing ? 200 : 201).json(messages(customerId));
}
router.get('/mine', auth.requireRole('customer'), (req, res) => res.json(messages(req.user.id)));
router.post('/mine', auth.requireRole('customer'), (req, res) => send(req, res, req.user.id));
router.get('/', auth.requireRole('admin'), (req, res) => res.json(db.prepare(`
  SELECT m.customer_id AS customerId, c.display_name AS displayName, m.body,
    m.created_at AS createdAt FROM inquiry_messages m JOIN customer_users c ON c.user_id = m.customer_id
  WHERE m.message_id IN (SELECT MAX(message_id) FROM inquiry_messages GROUP BY customer_id)
  ORDER BY m.message_id DESC`).all()));
router.use('/:customerId', auth.requireRole('admin'), (req, res, next) => {
  const id = parseId(req.params.customerId);
  if (!id || !db.prepare('SELECT user_id FROM customer_users WHERE user_id = ? AND deleted_at IS NULL').get(id)) throw new HttpError(404, 'Customer not found');
  req.customerId = id; next();
});
router.get('/:customerId', (req, res) => res.json(messages(req.customerId)));
router.post('/:customerId', (req, res) => send(req, res, req.customerId));
module.exports = router;
