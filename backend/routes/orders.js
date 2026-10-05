const express = require('express');
const orderService = require('../services/orderService');
const HttpError = require('../utils/httpError');
const { parseId } = require('../utils/validate');

const router = express.Router();

// 주문/예약 생성 (고객용)
router.post('/', (req, res) => {
  const order = orderService.createOrder(req.body);
  res.status(201).json(order);
});

// 주문 상태 조회 (고객용)
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  const order = id && orderService.getOrderById(id);
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  res.json(order);
});

// 주문 상태 변경 — 수락/거절/완료 (점주용)
router.patch('/:id/status', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    throw new HttpError(404, 'Order not found');
  }
  res.json(orderService.updateOrderStatus(id, req.body));
});

module.exports = router;
