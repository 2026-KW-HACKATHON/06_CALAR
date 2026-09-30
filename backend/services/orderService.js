const orders = require('../data/orders');
const { findStore } = require('./storeService');
const HttpError = require('../utils/httpError');
const { nowKSTString } = require('../utils/time');

const ORDER_STATUSES = ['pending', 'accepted', 'rejected', 'done'];

// 상태 변경 규칙: 현재 상태 -> 바꿀 수 있는 상태들
const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['done'],
  rejected: [],
  done: [],
};

const PICKUP_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/; // YYYY-MM-DDTHH:mm
const PHONE_PATTERN = /^[0-9-]{9,13}$/;

let nextId = Math.max(0, ...orders.map((o) => o.id)) + 1;

// 주문 생성 (검증 실패 시 HttpError를 던진다)
function createOrder(body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Request body is required');
  }

  const { storeId, items, pickupTime, customerPhone } = body;

  for (const field of ['storeId', 'items', 'pickupTime', 'customerPhone']) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw new HttpError(400, `${field} is required`);
    }
  }

  if (!Number.isInteger(storeId)) {
    throw new HttpError(400, 'Invalid storeId');
  }

  const store = findStore(storeId);
  if (!store) {
    throw new HttpError(404, 'Store not found');
  }
  if (store.orderType === 'none') {
    throw new HttpError(400, 'This store does not accept orders');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array');
  }

  // totalPrice는 프론트 값이 아니라 가게 메뉴 가격으로 서버가 직접 계산
  let totalPrice = 0;
  const orderItems = items.map((item) => {
    const menu = store.menu.find((m) => m.id === item?.menuId);
    if (!menu) {
      throw new HttpError(400, `Invalid menuId: ${item?.menuId}`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new HttpError(400, `Invalid quantity for menuId: ${item.menuId}`);
    }
    totalPrice += menu.price * item.quantity;
    return { menuId: item.menuId, quantity: item.quantity };
  });

  if (typeof pickupTime !== 'string' || !PICKUP_TIME_PATTERN.test(pickupTime)) {
    throw new HttpError(400, 'Invalid pickupTime format (YYYY-MM-DDTHH:mm)');
  }
  if (typeof customerPhone !== 'string' || !PHONE_PATTERN.test(customerPhone)) {
    throw new HttpError(400, 'Invalid customerPhone format');
  }

  const order = {
    id: nextId++,
    storeId,
    items: orderItems,
    totalPrice,
    pickupTime,
    customerPhone,
    status: 'pending',
    createdAt: nowKSTString(),
  };
  orders.push(order);
  return order;
}

// id로 주문 하나 찾기 (없으면 null)
function getOrderById(id) {
  const orderId = Number(id);
  return orders.find((o) => o.id === orderId) ?? null;
}

// 가게로 들어온 주문 목록 (status 필터, 픽업 시간 빠른 순)
function getOrdersByStore(storeId, status) {
  if (!findStore(storeId)) {
    throw new HttpError(404, 'Store not found');
  }
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    throw new HttpError(400, 'Invalid status value');
  }

  return orders
    .filter((o) => o.storeId === Number(storeId))
    .filter((o) => status === undefined || o.status === status)
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
}

// 주문 상태 변경 (수락/거절/완료)
function updateOrderStatus(id, status) {
  const order = getOrderById(id);
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }

  if (status === undefined || status === null || status === '') {
    throw new HttpError(400, 'status is required');
  }
  if (status === 'pending') {
    throw new HttpError(400, 'Cannot change status to pending');
  }
  if (!ORDER_STATUSES.includes(status)) {
    throw new HttpError(400, 'Invalid status value');
  }

  if (order.status === 'done' || order.status === 'rejected') {
    throw new HttpError(409, 'Order status cannot be changed anymore');
  }
  if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
    throw new HttpError(409, `Cannot change status from ${order.status} to ${status}`);
  }

  order.status = status;
  return order;
}

module.exports = { createOrder, getOrderById, getOrdersByStore, updateOrderStatus };
