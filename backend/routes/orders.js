const express = require('express');
const orderService = require('../services/orderService');
const HttpError = require('../utils/httpError');
const { parseId } = require('../utils/validate');
const auth = require('./auth');
const managementService = require('../services/managementService');

const router = express.Router();
router.get('/mine', auth.requireUser, (req, res) => {
  res.json(require('../services/ratingService').mine(req.user.id));
});
router.post('/:id/rating', auth.requireUser, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(404, 'Order not found');
  res.status(201).json(require('../services/ratingService').rate(req.user.id, id, req.body));
});

// 주문/예약 생성 (고객용)
router.post('/', auth.requireUser, (req, res) => {
  if (req.body?.paymentMethod === 'credit') throw new HttpError(410, 'Payments are no longer available');
  const order = orderService.createOrder(req.body, { customerId: req.user?.id });
  res.status(201).json(order);
});

// 주문 상태 조회 (고객용)
router.get('/:id', auth.optionalUser, (req, res) => {
  const id = parseId(req.params.id);
  const order = id && orderService.getOrderById(id);
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  managementService.assertOrderReadAccess(req.user, id);
  res.json(order);
});

// 주문 상태 변경 — 수락/거절/완료 (점주용)
router.patch('/:id/status', auth.requireUser, auth.requireRole('owner', 'admin'), (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    throw new HttpError(404, 'Order not found');
  }
  managementService.assertOrderAccess(req.user, id);
  res.json(orderService.updateOrderStatus(id, req.body));
});

module.exports = router;
