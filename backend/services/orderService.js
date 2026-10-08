const { randomUUID } = require('node:crypto');
const db = require('../db');
const { transaction } = require('./transaction');
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

// 같은 메뉴를 합친 뒤의 주문 항목 비교용 문자열 (저장된 주문은 이미 합쳐져 있다). 형식이 틀리면 null
// 결제 재시도 요청이 기존 주문과 같은지 확인할 때 쓴다
function mergedItemsKey(items) {
  if (!Array.isArray(items) || !items.every(isPlainObject)) return null;
  const merged = new Map();
  for (const { menuId, quantity } of items) {
    if (!Number.isInteger(menuId) || !Number.isInteger(quantity)) return null;
    merged.set(menuId, (merged.get(menuId) ?? 0) + quantity);
  }
  return JSON.stringify([...merged].sort(([a], [b]) => a - b));
}

// pickupTime 검사: 형식·실제 날짜 → 과거 아님 → 30일 이내 → 가게 영업시간 안
function validatePickupTime(store, pickupTime) {
  const parsed = parseLocalDateTime(pickupTime);
  if (!parsed) {
    throw new HttpError(400, 'Invalid pickupTime format (YYYY-MM-DDTHH:mm)');
  }

  const now = Date.now();
  if (parsed.epochMs < now + (store.minOrderMinutes ?? 0) * 60000 && store.minOrderMinutes > 0) {
    throw new HttpError(400, `pickupTime must be at least ${store.minOrderMinutes} minutes from now`);
  }
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
function createOrder(body, { customerId } = {}) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const { storeId, items, pickupTime } = body;
  const reservation = body.kind === 'reservation';
  if (body.kind !== undefined && !['reservation', 'preorder'].includes(body.kind)) throw new HttpError(400, 'Invalid order kind');
  if (reservation && (!Number.isInteger(body.partySize) || body.partySize < 1 || body.partySize > 99)) throw new HttpError(400, 'Invalid partySize');
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone : '';
  const couponUuid = body.couponUuid ?? null;
  if (couponUuid !== null && (typeof couponUuid !== 'string' || !/^[0-9a-f-]{36}$/i.test(couponUuid))) throw new HttpError(400, 'Invalid coupon');
  const paymentMethod = body.paymentMethod ?? 'onsite';
  if (reservation && (paymentMethod !== 'onsite' || couponUuid !== null)) throw new HttpError(400, 'Visit reservations do not require payment or a coupon');
  if (!['onsite', 'credit'].includes(paymentMethod)) throw new HttpError(400, 'Invalid paymentMethod');
  if (paymentMethod === 'credit' && (!customerId || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId))) throw new HttpError(400, 'Credit payment requires a requestId and login');
  if (paymentMethod === 'credit') {
    const previous = db.prepare('SELECT order_id FROM orders WHERE customer_id = ? AND payment_reference = ?').get(customerId, body.requestId);
    if (previous) {
      const existing = getOrderById(previous.order_id);
      const requested = mergedItemsKey(items);
      if (requested === null || existing.storeId !== storeId || existing.pickupTime !== pickupTime || existing.customerPhone !== customerPhone || (existing.couponUuid ?? null) !== couponUuid || mergedItemsKey(existing.items) !== requested) throw new HttpError(409, 'Payment request already used for another order');
      return existing;
    }
  }

  for (const field of ['storeId', 'items', 'pickupTime']) {
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
  if (reservation && store.orderType !== 'reservation') throw new HttpError(400, 'This store does not accept visit reservations');
  if (reservation && (!Array.isArray(items) || items.length !== 0)) throw new HttpError(400, 'Visit reservations must not include menu items');

  // totalPrice는 프론트 값이 아니라 가게 메뉴 가격으로 서버가 직접 계산
  const { orderItems, totalPrice: subtotal } = reservation ? { orderItems: [], totalPrice: 0 } : buildOrderItems(store, items);
  validatePickupTime(store, pickupTime);



  const createdAt = nowKSTString();
  let orderId;
  db.exec('BEGIN');
  try {
    const coupon = couponUuid ? require('./couponService').available(storeId, couponUuid) : null;
    if (couponUuid && !coupon) throw new HttpError(400, 'Coupon is not available');
    const eligibleSubtotal = coupon ? orderItems.filter(item => coupon.targetMenuId === 0 || item.menuId === coupon.targetMenuId).reduce((sum, item) => sum + store.menu.find(menu => menu.id === item.menuId).price * item.quantity, 0) : 0;
    if (coupon && eligibleSubtotal === 0) throw new HttpError(400, 'Coupon target menu is not in this order');
    const discountAmount = coupon ? Math.floor(eligibleSubtotal * coupon.discountRate / 100) : 0;
    const totalPrice = subtotal - discountAmount;
    const result = db.prepare(`
      INSERT INTO orders (uuid, customer_id, store_id, total_price, pickup_time, customer_phone, status, created_at, coupon_uuid, discount_amount, party_size)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(randomUUID(), customerId ?? null, storeId, totalPrice, pickupTime, customerPhone, createdAt, couponUuid, discountAmount, reservation ? body.partySize : null);
    orderId = Number(result.lastInsertRowid);
    if (paymentMethod === 'credit') {
      db.prepare("UPDATE orders SET payment_method = 'credit', payment_reference = ? WHERE order_id = ?").run(body.requestId, orderId);
      require('./creditService').change(customerId, -totalPrice, 'payment', String(orderId));
    }

    const insertItem = db.prepare('INSERT INTO items (uuid, order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)');
    for (const item of orderItems) {
      const menu = store.menu.find((entry) => entry.id === item.menuId);
      insertItem.run(randomUUID(), orderId, item.menuId, item.quantity, menu.price);

    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getOrderById(orderId);
}

// id로 주문 하나 찾기 (없으면 null). id는 이미 검사된 정수
function getOrderById(id) {
  const row = db.prepare(`
    SELECT order_id AS id, uuid, store_id AS storeId, total_price AS totalPrice,
      pickup_time AS pickupTime, customer_phone AS customerPhone, status,
      created_at AS createdAt, payment_method, customer_id, coupon_uuid, discount_amount, party_size
    FROM orders WHERE order_id = ?
  `).get(id);
  if (!row) return null;
  const items = db.prepare('SELECT menu_id AS menuId, uuid, quantity FROM items WHERE order_id = ? ORDER BY item_id').all(id);
  const { payment_method, customer_id, coupon_uuid, discount_amount, party_size, ...publicOrder } = row;
  return { ...publicOrder, items, ...(party_size ? { kind: 'reservation', partySize: party_size } : {}), ...(coupon_uuid ? { couponUuid: coupon_uuid, discountAmount: discount_amount } : {}), ...(payment_method === 'credit' ? { paymentMethod: 'credit' } : {}) };
}

// 가게로 들어온 주문 목록 (status 필터, 픽업 시간 빠른 순 → 같으면 먼저 들어온 순)
function getOrdersByStore(storeId, status) {
  if (!findStore(storeId)) {
    throw new HttpError(404, 'Store not found');
  }
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    throw new HttpError(400, 'Invalid status value');
  }

  const rows = status === undefined
    ? db.prepare('SELECT order_id FROM orders WHERE store_id = ? ORDER BY pickup_time, order_id').all(storeId)
    : db.prepare('SELECT order_id FROM orders WHERE store_id = ? AND status = ? ORDER BY pickup_time, order_id').all(storeId, status);
  return rows.map((row) => getOrderById(row.order_id));
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

  transaction(() => {
    db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run(status, id);
    if (status === 'rejected' && order.paymentMethod === 'credit' && order.totalPrice > 0) {
      const payer = db.prepare('SELECT customer_id FROM orders WHERE order_id = ?').get(id);
      require('./creditService').change(payer.customer_id, order.totalPrice, 'refund', String(id));
    }

  });
  order.status = status;
  return order;
}

module.exports = { createOrder, getOrderById, getOrdersByStore, updateOrderStatus };
