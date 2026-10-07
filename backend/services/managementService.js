const { randomUUID } = require('node:crypto');
const db = require('../db');
const { transaction } = require('./transaction');
const orderService = require('./orderService');
const storeService = require('./storeService');
const HttpError = require('../utils/httpError');

const PHONE_PATTERN = /^[0-9+()\s-]{7,24}$/;

function requireOwnerApproval(userId) {
  const business = db.prepare('SELECT status FROM business_registrations WHERE user_id = ? AND deleted_at IS NULL').get(userId);
  if (!business || business.status !== 'verified') {
    throw new HttpError(403, 'A verified business registration is required');
  }
}

function assertStoreAccess(user, storeId) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  const store = db.prepare('SELECT owner_id FROM stores WHERE store_id = ? AND deleted_at IS NULL').get(storeId);
  if (!store) throw new HttpError(404, 'Store not found');
  if (user.role !== 'admin' && store.owner_id !== user.id) {
    throw new HttpError(403, 'You do not manage this store');
  }
  return store;
}

function assertOrderAccess(user, orderId) {
  if (user.role === 'admin') return;
  requireOwnerApproval(user.id);
  const order = db.prepare(`
    SELECT stores.owner_id FROM orders
    JOIN stores ON stores.store_id = orders.store_id
    WHERE orders.order_id = ?
  `).get(orderId);
  if (!order || order.owner_id !== user.id) throw new HttpError(403, 'You do not manage this order');
}

function assertOrderReadAccess(user, orderId) {
  const order = db.prepare(`
    SELECT orders.customer_id, stores.owner_id FROM orders
    JOIN stores ON stores.store_id = orders.store_id
    WHERE orders.order_id = ?
  `).get(orderId);
  if (!order || order.customer_id == null) return;
  if (user?.role === 'admin' || user?.id === order.customer_id || user?.id === order.owner_id) return;
  if (!user) throw new HttpError(401, 'Authentication required to view this order');
  throw new HttpError(403, 'You do not have access to this order');
}

function managementStore(storeId) {
  const store = storeService.findStore(storeId);
  if (!store) throw new HttpError(404, 'Store not found');
  store.ownerId = db.prepare('SELECT owner_id FROM stores WHERE store_id = ? AND deleted_at IS NULL').get(storeId).owner_id;
  return store;
}

function getOwnerDashboard(user) {
  const business = db.prepare(`
    SELECT business_number AS businessNumber, legal_name AS legalName,
      representative_name AS representativeName, address, status,
      rejection_reason AS rejectionReason, verified_at AS verifiedAt
    FROM business_registrations WHERE user_id = ? AND deleted_at IS NULL
  `).get(user.id) ?? null;
  const stores = db.prepare('SELECT store_id FROM stores WHERE owner_id = ? AND deleted_at IS NULL ORDER BY store_id').all(user.id)
    .map((row) => managementStore(row.store_id));
  const pendingOrders = db.prepare(`
    SELECT COUNT(*) AS count FROM orders
    JOIN stores ON stores.store_id = orders.store_id
    WHERE stores.owner_id = ? AND orders.status = 'pending'
  `).get(user.id).count;
  return { user, business, stores, pendingOrders };
}

function updateProfile(userId, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const user = db.prepare('SELECT display_name, phone, address FROM users WHERE user_id = ? AND deleted_at IS NULL').get(userId);
  if (!user) throw new HttpError(404, 'User not found');
  const displayName = body.displayName === undefined ? user.display_name : typeof body.displayName === 'string' ? body.displayName.trim() : null;
  const phone = body.phone === undefined ? user.phone : typeof body.phone === 'string' ? body.phone.trim() : null;
  const address = body.address === undefined ? user.address : typeof body.address === 'string' ? body.address.trim() : null;
  if (typeof displayName !== 'string' || !displayName || displayName.length > 80) throw new HttpError(400, 'Invalid displayName');
  if (phone && !PHONE_PATTERN.test(phone)) throw new HttpError(400, 'Invalid phone');
  if (address && (typeof address !== 'string' || address.length > 240)) throw new HttpError(400, 'Invalid address');
  const after = { display_name: displayName, phone: phone || null, address: address || null };
  transaction(() => {
    db.prepare('UPDATE users SET display_name = ?, phone = ?, address = ? WHERE user_id = ?')
      .run(displayName, after.phone, after.address, userId);

  });
  return require('../services/authService').publicUser(userId);
}

function categoryIdFrom(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || !db.prepare('SELECT 1 FROM categories WHERE category_id = ? AND deleted_at IS NULL').get(id)) {
    throw new HttpError(400, 'Invalid categoryId');
  }
  return id;
}

function normalizedStore(body, current = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const value = { ...current, ...body };
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const address = typeof value.address === 'string' ? value.address.trim() : '';
  const description = value.description == null ? '' : typeof value.description === 'string' ? value.description.trim() : null;
  const phone = value.phone == null ? '' : typeof value.phone === 'string' ? value.phone.trim() : null;
  if (!name || name.length > 120) throw new HttpError(400, 'Invalid store name');
  if (!address || address.length > 240) throw new HttpError(400, 'Store address is required');
  if (description === null || description.length > 500) throw new HttpError(400, 'Description is too long');
  if (phone === null || phone && !PHONE_PATTERN.test(phone)) throw new HttpError(400, 'Invalid store phone');
  if (!['preorder', 'reservation', 'none'].includes(value.orderType)) throw new HttpError(400, 'Invalid orderType');
  if (typeof value.openHours !== 'string' || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value.openHours)) {
    throw new HttpError(400, 'Invalid openHours');
  }
  const lat = value.locationLat === '' || value.locationLat == null ? null : Number(value.locationLat);
  const lng = value.locationLng === '' || value.locationLng == null ? null : Number(value.locationLng);
  if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180))) {
    throw new HttpError(400, 'Invalid store coordinates');
  }
  return {
    name,
    categoryId: categoryIdFrom(value.categoryId),
    description,
    phone: phone || null,
    address,
    lat,
    lng,
    openHours: value.openHours,
    orderType: value.orderType,
  };
}

function validateOwnerAssignment(ownerId) {
  if (ownerId == null || ownerId === '') return null;
  const owner = db.prepare(`
    SELECT users.user_id FROM users
    JOIN business_registrations ON business_registrations.user_id = users.user_id
    WHERE users.user_id = ? AND users.role = 'owner' AND users.is_active = 1
      AND business_registrations.status = 'verified' AND users.deleted_at IS NULL AND business_registrations.deleted_at IS NULL
  `).get(ownerId);
  if (!owner) throw new HttpError(400, 'Store owner must have a verified business registration');
  return Number(ownerId);
}

function createStore(user, body, admin = false) {
  if (!admin) requireOwnerApproval(user.id);
  const store = normalizedStore(body);
  const ownerId = admin ? validateOwnerAssignment(body.ownerId) : user.id;
  return transaction(() => {
    const result = db.prepare(`
      INSERT INTO stores (uuid, owner_id, name, category_id, description, phone, address,
        location_lat, location_lng, open_hours, order_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), ownerId, store.name, store.categoryId, store.description, store.phone, store.address,
      store.lat, store.lng, store.openHours, store.orderType);
    const storeId = Number(result.lastInsertRowid);
    const after = {
      owner_id: ownerId,
      name: store.name,
      category_id: store.categoryId,
      description: store.description,
      phone: store.phone,
      address: store.address,
      location_lat: store.lat,
      location_lng: store.lng,
      open_hours: store.openHours,
      order_type: store.orderType,
    };

    return managementStore(storeId);
  });
}

function updateStore(user, storeId, body, admin = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  if (!admin) requireOwnerApproval(user.id);
  const currentOwner = assertStoreAccess(user, storeId);
  const current = managementStore(storeId);
  const store = normalizedStore(body, {
    name: current.name,
    categoryId: db.prepare('SELECT category_id FROM stores WHERE store_id = ? AND deleted_at IS NULL').get(storeId).category_id,
    description: current.description,
    phone: current.phone,
    address: current.address,
    locationLat: current.location.lat,
    locationLng: current.location.lng,
    openHours: current.openHours,
    orderType: current.orderType,
  });
  const ownerId = admin && Object.hasOwn(body, 'ownerId') ? validateOwnerAssignment(body.ownerId) : currentOwner.owner_id;
  return transaction(() => {
    db.prepare(`
      UPDATE stores SET owner_id = ?, name = ?, category_id = ?, description = ?, phone = ?,
        address = ?, location_lat = ?, location_lng = ?, open_hours = ?, order_type = ?
      WHERE store_id = ?
    `).run(ownerId, store.name, store.categoryId, store.description, store.phone, store.address,
      store.lat, store.lng, store.openHours, store.orderType, storeId);

    return managementStore(storeId);
  });
}

function deleteStore(user, storeId) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  transaction(() => {
    db.prepare("UPDATE stores SET deleted_at = datetime('now') WHERE store_id = ?").run(storeId);
    for (const table of ['menus', 'coupons', 'signKeyWords']) {
      db.prepare(`UPDATE ${table} SET deleted_at = datetime('now') WHERE store_id = ? AND deleted_at IS NULL`).run(storeId);
    }
  });
}

function listStores(user) {
  const rows = user.role === 'admin'
    ? db.prepare('SELECT store_id FROM stores WHERE deleted_at IS NULL ORDER BY store_id').all()
    : db.prepare('SELECT store_id FROM stores WHERE owner_id = ? AND deleted_at IS NULL ORDER BY store_id').all(user.id);
  return rows.map((row) => managementStore(row.store_id));
}

function assertMenuBelongs(storeId, menuId) {
  const menu = db.prepare('SELECT menu_id FROM menus WHERE menu_id = ? AND store_id = ? AND deleted_at IS NULL').get(menuId, storeId);
  if (!menu) throw new HttpError(404, 'Menu not found');
}

function listMenus(user, storeId) {
  assertStoreAccess(user, storeId);
  return db.prepare('SELECT menu_id AS id, uuid, name, price FROM menus WHERE store_id = ? AND deleted_at IS NULL ORDER BY menu_id').all(storeId);
}

function createMenu(user, storeId, body) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const price = body?.price;
  if (!name || name.length > 120) throw new HttpError(400, 'Invalid menu name');
  if (!Number.isSafeInteger(price) || price < 0) throw new HttpError(400, 'Invalid menu price');
  return transaction(() => {
    const result = db.prepare('INSERT INTO menus (uuid, name, store_id, price) VALUES (?, ?, ?, ?)').run(randomUUID(), name, storeId, price);
    const menuId = Number(result.lastInsertRowid);

    return db.prepare('SELECT menu_id AS id, uuid, name, price FROM menus WHERE menu_id = ?').get(menuId);
  });
}

function updateMenu(user, storeId, menuId, body) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  assertMenuBelongs(storeId, menuId);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const current = db.prepare('SELECT name, price FROM menus WHERE menu_id = ?').get(menuId);
  const name = body.name === undefined ? current.name : typeof body.name === 'string' ? body.name.trim() : null;
  const price = body?.price === undefined ? current.price : body.price;
  if (typeof name !== 'string' || !name || name.length > 120) throw new HttpError(400, 'Invalid menu name');
  if (!Number.isSafeInteger(price) || price < 0) throw new HttpError(400, 'Invalid menu price');
  return transaction(() => {
    db.prepare('UPDATE menus SET name = ?, price = ? WHERE menu_id = ?').run(name, price, menuId);

    return db.prepare('SELECT menu_id AS id, uuid, name, price FROM menus WHERE menu_id = ?').get(menuId);
  });
}

function deleteMenu(user, storeId, menuId) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  assertMenuBelongs(storeId, menuId);
  db.prepare("UPDATE menus SET deleted_at = datetime('now') WHERE menu_id = ?").run(menuId);
}

function couponRow(couponId) {
  return db.prepare(`
    SELECT coupon_id AS id, uuid, store_id AS storeId, title, description,
      discount_rate AS discountRate, valid_from AS validFrom, valid_until AS validUntil,
      is_active AS isActive
    FROM coupons WHERE coupon_id = ?
  `).get(couponId);
}

function normalizedCoupon(body, current = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const title = typeof body?.title === 'string' ? body.title.trim() : current.title;
  const description = body?.description === undefined ? current.description : body.description;
  const discountRate = body?.discountRate === undefined ? current.discountRate : body.discountRate;
  const validFrom = body?.validFrom === undefined ? current.validFrom : body.validFrom;
  const validUntil = body?.validUntil === undefined ? current.validUntil : body.validUntil;
  const isActive = body?.isActive === undefined ? current.isActive ?? 1 : body.isActive;
  if (typeof title !== 'string' || !title || title.length > 120) throw new HttpError(400, 'Invalid coupon title');
  if (description != null && (typeof description !== 'string' || description.length > 500)) throw new HttpError(400, 'Invalid coupon description');
  if (discountRate !== null && (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100)) {
    throw new HttpError(400, 'Invalid discountRate');
  }
  for (const date of [validFrom, validUntil]) {
    if (date && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
      throw new HttpError(400, 'Invalid coupon validity date');
    }
  }
  if (validFrom && validUntil && validFrom > validUntil) throw new HttpError(400, 'validFrom must not be after validUntil');
  if (![0, 1, false, true].includes(isActive)) throw new HttpError(400, 'Invalid isActive');
  return { title, description: description || null, discountRate, validFrom: validFrom || null, validUntil: validUntil || null, isActive: Number(isActive) };
}

function listCoupons(user, storeId) {
  assertStoreAccess(user, storeId);
  return db.prepare(`
    SELECT coupon_id AS id, uuid, store_id AS storeId, title, description,
      discount_rate AS discountRate, valid_from AS validFrom, valid_until AS validUntil,
      is_active AS isActive
    FROM coupons WHERE store_id = ? AND deleted_at IS NULL ORDER BY coupon_id
  `).all(storeId);
}

function createCoupon(user, storeId, body) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  const coupon = normalizedCoupon(body);
  return transaction(() => {
    const result = db.prepare(`
      INSERT INTO coupons (uuid, store_id, title, description, discount_rate, valid_from, valid_until, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), storeId, coupon.title, coupon.description, coupon.discountRate, coupon.validFrom, coupon.validUntil, coupon.isActive);
    const couponId = Number(result.lastInsertRowid);

    return couponRow(couponId);
  });
}

function updateCoupon(user, storeId, couponId, body) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  const current = db.prepare(`
    SELECT title, description, discount_rate, valid_from, valid_until, is_active
    FROM coupons WHERE coupon_id = ? AND store_id = ? AND deleted_at IS NULL
  `).get(couponId, storeId);
  if (!current) throw new HttpError(404, 'Coupon not found');
  const coupon = normalizedCoupon(body, couponRow(couponId));
  const after = {
    title: coupon.title,
    description: coupon.description,
    discount_rate: coupon.discountRate,
    valid_from: coupon.validFrom,
    valid_until: coupon.validUntil,
    is_active: coupon.isActive,
  };
  return transaction(() => {
    db.prepare(`
      UPDATE coupons SET title = ?, description = ?, discount_rate = ?, valid_from = ?, valid_until = ?, is_active = ?
      WHERE coupon_id = ?
    `).run(coupon.title, coupon.description, coupon.discountRate, coupon.validFrom, coupon.validUntil, coupon.isActive, couponId);

    return couponRow(couponId);
  });
}

function deleteCoupon(user, storeId, couponId) {
  if (user.role !== 'admin') requireOwnerApproval(user.id);
  assertStoreAccess(user, storeId);
  const current = db.prepare('SELECT coupon_id FROM coupons WHERE coupon_id = ? AND store_id = ? AND deleted_at IS NULL').get(couponId, storeId);
  if (!current) throw new HttpError(404, 'Coupon not found');
  db.prepare("UPDATE coupons SET deleted_at = datetime('now') WHERE coupon_id = ?").run(couponId);
}

function listUsers() {
  return db.prepare(`
    SELECT users.user_id AS id, users.uuid, users.email, users.email_verified_at AS emailVerifiedAt, users.display_name AS displayName,
      users.phone, users.address, users.role, users.is_active AS isActive,
      users.created_at AS createdAt,
      business_registrations.uuid AS businessUuid, business_registrations.business_number AS businessNumber,
      business_registrations.legal_name AS legalName,
      business_registrations.status AS businessStatus
    FROM users LEFT JOIN business_registrations ON business_registrations.user_id = users.user_id AND business_registrations.deleted_at IS NULL
    WHERE users.deleted_at IS NULL
    ORDER BY users.created_at DESC, users.user_id DESC
  `).all();
}

function listBusinesses(status) {
  if (status !== undefined && !['pending', 'verified', 'rejected'].includes(status)) {
    throw new HttpError(400, 'Invalid business status');
  }
  const query = `
    SELECT business_registrations.registration_id AS id, business_registrations.uuid,
      users.user_id AS userId, users.uuid AS userUuid,
      users.email, users.display_name AS displayName, users.phone,
      business_registrations.business_number AS businessNumber,
      business_registrations.legal_name AS legalName,
      business_registrations.representative_name AS representativeName,
      business_registrations.address, business_registrations.status,
      business_registrations.rejection_reason AS rejectionReason,
      business_registrations.created_at AS createdAt
    FROM business_registrations JOIN users ON users.user_id = business_registrations.user_id
    WHERE users.deleted_at IS NULL AND business_registrations.deleted_at IS NULL
    ${status === undefined ? '' : 'AND business_registrations.status = ?'}
    ORDER BY business_registrations.created_at, business_registrations.registration_id
  `;
  return status === undefined ? db.prepare(query).all() : db.prepare(query).all(status);
}

function reviewBusiness(registrationId, body) {
  const status = body?.status;
  if (!['verified', 'rejected'].includes(status)) throw new HttpError(400, 'status must be verified or rejected');
  const reason = status === 'rejected' ? String(body.reason ?? '').trim() : null;
  if (status === 'rejected' && (!reason || reason.length > 500)) throw new HttpError(400, 'A rejection reason is required');
  const before = db.prepare('SELECT status, rejection_reason, verified_at FROM business_registrations WHERE registration_id = ? AND deleted_at IS NULL').get(registrationId);
  if (!before) throw new HttpError(404, 'Business registration not found');
  const after = { status, rejection_reason: reason, verified_at: status === 'verified' ? new Date().toISOString() : null };
  transaction(() => {
    db.prepare(`
      UPDATE business_registrations
      SET status = ?, rejection_reason = ?, verified_at = ?, updated_at = datetime('now')
      WHERE registration_id = ?
    `).run(status, reason, after.verified_at, registrationId);

  });
  return listBusinesses().find((business) => business.id === registrationId);
}

function updateUser(userId, body, actorId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const current = db.prepare('SELECT role, is_active FROM users WHERE user_id = ? AND deleted_at IS NULL').get(userId);
  if (!current) throw new HttpError(404, 'User not found');
  if (userId === actorId && (body?.role && body.role !== 'admin' || body?.isActive === false || body?.isActive === 0)) {
    throw new HttpError(400, 'You cannot remove your own admin access');
  }
  const role = body?.role ?? current.role;
  const isActive = body?.isActive === undefined ? current.is_active : Number(body.isActive);
  if (!['customer', 'owner', 'admin'].includes(role)) throw new HttpError(400, 'Invalid role');
  if (![0, 1].includes(isActive)) throw new HttpError(400, 'Invalid isActive');
  if (role === 'owner' && !db.prepare('SELECT 1 FROM business_registrations WHERE user_id = ? AND deleted_at IS NULL').get(userId)) {
    throw new HttpError(400, 'Owner role requires a business registration');
  }
  transaction(() => {
    db.prepare('UPDATE users SET role = ?, is_active = ? WHERE user_id = ?').run(role, isActive, userId);

    if (!isActive) db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  });
  return listUsers().find((user) => user.id === userId);
}

function deleteUser(userId, actorId) {
  if (userId === actorId) throw new HttpError(400, 'You cannot delete your own account');
  if (!db.prepare('SELECT user_id FROM users WHERE user_id = ? AND deleted_at IS NULL').get(userId)) throw new HttpError(404, 'User not found');
  transaction(() => {
    db.prepare("UPDATE users SET deleted_at = datetime('now'), is_active = 0 WHERE user_id = ?").run(userId);
    db.prepare("UPDATE business_registrations SET deleted_at = datetime('now') WHERE user_id = ? AND deleted_at IS NULL").run(userId);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
    const stores = db.prepare('SELECT store_id FROM stores WHERE owner_id = ? AND deleted_at IS NULL').all(userId);
    for (const { store_id: storeId } of stores) {
      db.prepare("UPDATE stores SET deleted_at = datetime('now') WHERE store_id = ?").run(storeId);
      for (const table of ['menus', 'coupons', 'signKeyWords']) {
        db.prepare(`UPDATE ${table} SET deleted_at = datetime('now') WHERE store_id = ? AND deleted_at IS NULL`).run(storeId);
      }
    }
  });
}

function dashboard() {
  return {
    users: db.prepare('SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL').get().count,
    stores: db.prepare('SELECT COUNT(*) AS count FROM stores WHERE deleted_at IS NULL').get().count,
    pendingBusinesses: db.prepare("SELECT COUNT(*) AS count FROM business_registrations WHERE status = 'pending' AND deleted_at IS NULL").get().count,
    pendingOrders: db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'").get().count,
  };
}

function listCategories() {
  return db.prepare('SELECT category_id AS id, uuid, name FROM categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE').all();
}

function createCategory(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) throw new HttpError(400, 'Invalid category name');
  try {
    return transaction(() => {
      const result = db.prepare('INSERT INTO categories (uuid, name) VALUES (?, ?)').run(randomUUID(), name);
      const categoryId = Number(result.lastInsertRowid);

      return db.prepare('SELECT category_id AS id, uuid, name FROM categories WHERE category_id = ? AND deleted_at IS NULL').get(categoryId);
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Category already exists');
    throw error;
  }
}

function updateCategory(categoryId, body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) throw new HttpError(400, 'Invalid category name');
  try {
    const current = db.prepare('SELECT name FROM categories WHERE category_id = ? AND deleted_at IS NULL').get(categoryId);
    if (!current) throw new HttpError(404, 'Category not found');
    return transaction(() => {
      db.prepare('UPDATE categories SET name = ? WHERE category_id = ?').run(name, categoryId);

      return db.prepare('SELECT category_id AS id, uuid, name FROM categories WHERE category_id = ? AND deleted_at IS NULL').get(categoryId);
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Category already exists');
    throw error;
  }
}

function deleteCategory(categoryId) {
  if (!db.prepare('SELECT category_id FROM categories WHERE category_id = ? AND deleted_at IS NULL').get(categoryId)) throw new HttpError(404, 'Category not found');
  db.prepare(`
    WITH RECURSIVE descendants(category_id) AS (
      SELECT category_id FROM categories WHERE category_id = ? AND deleted_at IS NULL
      UNION SELECT categories.category_id FROM categories JOIN descendants ON categories.parent_id = descendants.category_id
    )
    UPDATE categories SET deleted_at = datetime('now')
    WHERE category_id IN (SELECT category_id FROM descendants) AND deleted_at IS NULL
  `).run(categoryId);
}

function ownerOrders(user, storeId, status) {
  assertStoreAccess(user, storeId);
  return orderService.getOrdersByStore(storeId, status);
}

module.exports = {
  assertOrderAccess,
  assertOrderReadAccess,
  createCategory,
  createCoupon,
  createMenu,
  createStore,
  dashboard,
  deleteCategory,
  deleteCoupon,
  deleteMenu,
  deleteStore,
  deleteUser,
  getOwnerDashboard,
  listBusinesses,
  listCategories,
  listCoupons,
  listMenus,
  listStores,
  listUsers,
  ownerOrders,
  reviewBusiness,
  updateCategory,
  updateCoupon,
  updateMenu,
  updateProfile,
  updateStore,
  updateUser,
};
