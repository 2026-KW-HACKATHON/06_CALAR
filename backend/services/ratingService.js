const { randomUUID } = require('node:crypto');
const db = require('../db');
const HttpError = require('../utils/httpError');

function rate(userId, orderId, body) {
  if (!Number.isInteger(body?.score) || body.score < 1 || body.score > 5) throw new HttpError(400, 'Score must be an integer from 1 to 5');
  const order = db.prepare('SELECT customer_id, status FROM orders WHERE order_id = ?').get(orderId);
  if (!order || order.customer_id !== userId) throw new HttpError(404, 'Order not found');
  if (order.status !== 'done') throw new HttpError(409, 'Only completed orders can be rated');
  if (db.prepare('SELECT 1 FROM order_ratings WHERE order_id = ?').get(orderId)) throw new HttpError(409, 'Order already rated');
  db.prepare('INSERT INTO order_ratings (uuid, order_id, score) VALUES (?, ?, ?)').run(randomUUID(), orderId, body.score);
  return { score: body.score };
}

function mine(userId) {
  return db.prepare(`SELECT o.order_id AS id, o.store_id AS storeId, s.name AS storeName,
    o.status, o.total_price AS totalPrice, o.created_at AS createdAt, r.score AS rating,
    o.pickup_time AS pickupTime, o.party_size AS partySize
    FROM orders o JOIN stores s ON s.store_id = o.store_id
    LEFT JOIN order_ratings r ON r.order_id = o.order_id
    WHERE o.customer_id = ? ORDER BY o.order_id DESC LIMIT 100`).all(userId);
}
module.exports = { rate, mine };
