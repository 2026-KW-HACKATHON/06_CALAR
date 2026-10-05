const orders = require('../data/orders');
const { findStore, isOpenAt } = require('./storeService');
const HttpError = require('../utils/httpError');
const { DAY_MS, nowKSTString, parseLocalDateTime } = require('../utils/time');
const { isPlainObject } = require('../utils/validate');

const ORDER_STATUSES = ['pending', 'accepted', 'rejected', 'done'];

// 상태 변경 규칙: 현재 상태 -> 바꿀 수 있는 상태들
const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['done'],
  rejected: [],
  done: [],
};

const MAX_QUANTITY = 99; // 메뉴 하나당 최대 수량
const MAX_PICKUP_DAYS = 30; // 픽업/예약은 최대 30일 뒤까지

// 휴대폰(010-1234-5678), 서울(02-123-4567), 지역번호(031-123-4567), 하이픈 없는 형식 허용
const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

let nextId = Math.max(0, ...orders.map((o) => o.id)) + 1;

// items 검사 + 같은 메뉴는 하나로 합침 → { orderItems, totalPrice }
function buildOrderItems(store, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array');
  }

  const quantities = new Map(); // menuId -> 합친 수량 (넣은 순서 유지)
  for (const item of items) {
    if (!isPlainObject(item)) {
      throw new HttpError(400, 'Each item must be an object with menuId and quantity');
    }
    const menu = store.menu.find((m) => m.id === item.menuId);
    if (!menu) {
      throw new HttpError(400, `Invalid menuId: ${item.menuId}`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new HttpError(400, `Invalid quantity for menuId: ${item.menuId}`);
    }
    quantities.set(menu.id, (quantities.get(menu.id) ?? 0) + item.quantity);
  }

  let totalPrice = 0;
  const orderItems = [];
  for (const [menuId, quantity] of quantities) {
    if (quantity > MAX_QUANTITY) {
      throw new HttpError(400, `Quantity for menuId: ${menuId} exceeds ${MAX_QUANTITY}`);
    }
    totalPrice += store.menu.find((m) => m.id === menuId).price * quantity;
    orderItems.push({ menuId, quantity });
  }
  return { orderItems, totalPrice };
}

// pickupTime 검사: 형식·실제 날짜 → 과거 아님 → 30일 이내 → 가게 영업시간 안
function validatePickupTime(store, pickupTime) {
  const parsed = parseLocalDateTime(pickupTime);
  if (!parsed) {
    throw new HttpError(400, 'Invalid pickupTime format (YYYY-MM-DDTHH:mm)');
  }

  const now = Date.now();
  if (parsed.epochMs + 60 * 1000 <= now) {
    throw new HttpError(400, 'pickupTime must not be in the past'); // 지금 이 분(minute)까지는 허용
  }
  if (parsed.epochMs > now + MAX_PICKUP_DAYS * DAY_MS) {
    throw new HttpError(400, `pickupTime must be within ${MAX_PICKUP_DAYS} days`);
  }
  if (!isOpenAt(store.openHours, parsed.minutesOfDay)) {
    throw new HttpError(400, 'pickupTime is outside business hours');
  }
}

// 주문 생성 (검증 실패 시 HttpError를 던진다)
function createOrder(body) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const { storeId, items, pickupTime, customerPhone } = body;

  for (const field of ['storeId', 'items', 'pickupTime', 'customerPhone']) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw new HttpError(400, `${field} is required`);
    }
  }

  if (!Number.isSafeInteger(storeId) || storeId < 1) {
    throw new HttpError(400, 'Invalid storeId');
  }

  const store = findStore(storeId);
  if (!store) {
    throw new HttpError(404, 'Store not found');
  }
  if (store.orderType === 'none') {
    throw new HttpError(400, 'This store does not accept orders');
  }

  // totalPrice는 프론트 값이 아니라 가게 메뉴 가격으로 서버가 직접 계산
  const { orderItems, totalPrice } = buildOrderItems(store, items);
  validatePickupTime(store, pickupTime);

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

// id로 주문 하나 찾기 (없으면 null). id는 이미 검사된 정수
function getOrderById(id) {
  return orders.find((o) => o.id === id) ?? null;
}

// 가게로 들어온 주문 목록 (status 필터, 픽업 시간 빠른 순 → 같으면 먼저 들어온 순)
function getOrdersByStore(storeId, status) {
  if (!findStore(storeId)) {
    throw new HttpError(404, 'Store not found');
  }
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    throw new HttpError(400, 'Invalid status value');
  }

  return orders
    .filter((o) => o.storeId === storeId)
    .filter((o) => status === undefined || o.status === status)
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime) || a.id - b.id);
}

// 주문 상태 변경 (수락/거절/완료)
function updateOrderStatus(id, body) {
  const order = getOrderById(id);
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }

  const status = isPlainObject(body) ? body.status : undefined;
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
