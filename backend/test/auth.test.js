const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const db = require('../db');

let server;
let adminToken;
let ownerToken;
let ownerId;
let storeId;
let menuId;
let customerToken;
let customerId;
let orderId;

test.before(async () => {
  server = await startServer();
  const login = await server.request('POST', '/api/auth/login', {
    json: { email: 'test-admin@calar.local', password: 'test-admin-password-2026' },
  });
  assert.equal(login.status, 200);
  adminToken = login.body.token;
});

test.after(async () => server.close());

const request = (method, path, json, token) => server.request(method, path, {
  json,
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

test('이메일 인증은 일회용 링크로만 완료되고 복구 토큰과 구분된다', async () => {
  const auth = require('../services/authService');
  const mail = require('../services/mailService');
  const tokens = [];
  const configMock = test.mock.method(mail, 'configuration', () => ({}));
  const sendMock = test.mock.method(mail, 'sendVerification', async (_email, token) => tokens.push(token));
  try {
    const user = auth.register({ email: 'verify@calar.local', password: 'verification-password', displayName: 'Verify test' });
    assert.equal(user.emailVerifiedAt, null);
    await auth.requestEmailVerification({ email: user.email });
    assert.equal(tokens.length, 1);
    assert.throws(() => auth.completePasswordRecovery({ token: tokens[0], newPassword: 'another-password-2026' }), /Invalid or expired/);
    assert.equal((await request('POST', '/api/auth/verify-email', { token: tokens[0] })).status, 204);
    assert.ok(auth.publicUser(user.id).emailVerifiedAt);
    assert.throws(() => auth.verifyEmail({ token: tokens[0] }), /Invalid or expired/);
    await auth.requestEmailVerification({ email: user.email });
    assert.equal(tokens.length, 1);
    const expired = auth.register({ email: 'expired-verify@calar.local', password: 'verification-password', displayName: 'Expired test' });
    await auth.requestEmailVerification({ email: expired.email });
    db.prepare("UPDATE email_verification_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?").run(expired.id);
    assert.throws(() => auth.verifyEmail({ token: tokens[1] }), /Invalid or expired/);
    assert.equal(auth.publicUser(expired.id).emailVerifiedAt, null);
  } finally { configMock.mock.restore(); sendMock.mock.restore(); }
});

test('비밀번호 변경은 본인 확인 후 적용되고 기존 세션을 종료한다', async () => {
  const email = 'password-reset@calar.local';
  const password = 'previous-password-2026';
  const newPassword = 'updated-password-2026';
  assert.equal((await request('POST', '/api/auth/register', { email, password, displayName: 'Reset test' })).status, 201);
  const token = (await request('POST', '/api/auth/login', { email, password })).body.token;
  assert.equal((await request('POST', '/api/auth/reset-password', { email, currentPassword: 'wrong', newPassword })).status, 401);
  assert.equal((await request('GET', '/api/auth/me', undefined, token)).status, 200);
  assert.equal((await request('POST', '/api/auth/reset-password', { email, currentPassword: password, newPassword: 'short' })).status, 400);
  assert.equal((await request('POST', '/api/auth/reset-password', { email, currentPassword: password, newPassword })).status, 204);
  assert.equal((await request('GET', '/api/auth/me', undefined, token)).status, 401);
  assert.equal((await request('POST', '/api/auth/login', { email, password })).status, 401);
  assert.equal((await request('POST', '/api/auth/login', { email, password: newPassword })).status, 200);
});

test('이메일 복구 링크는 해시로 저장되며 만료, 재사용, 삭제 계정을 거부한다', async () => {
  const mail = require('../services/mailService');
  const tokens = [];
  const configMock = test.mock.method(mail, 'configuration', () => ({}));
  const sendMock = test.mock.method(mail, 'sendPasswordReset', async (_email, token) => tokens.push(token));
  try {
    const email = 'email-recovery@calar.local';
    const password = 'previous-password-2026';
    await request('POST', '/api/auth/register', { email, password, displayName: 'Recovery test' });
    const session = (await request('POST', '/api/auth/login', { email, password })).body.token;
    const response = await request('POST', '/api/auth/forgot-password', { email });
    const unknown = await request('POST', '/api/auth/forgot-password', { email: 'unknown@calar.local' });
    assert.deepEqual(response.body, unknown.body);
    assert.equal(response.status, 200);
    assert.equal(tokens.length, 1);
    assert.equal(JSON.stringify(response.body).includes(tokens[0]), false);
    assert.equal(db.prepare('SELECT token_hash FROM password_reset_tokens ORDER BY reset_id DESC LIMIT 1').get().token_hash.includes(tokens[0]), false);
    const body = { token: tokens[0], newPassword: 'recovered-password-2026' };
    assert.equal((await request('POST', '/api/auth/recover-password', body)).status, 204);
    assert.equal((await request('POST', '/api/auth/recover-password', body)).status, 400);
    assert.equal((await request('GET', '/api/auth/me', undefined, session)).status, 401);
    assert.equal((await request('POST', '/api/auth/login', { email, password: body.newPassword })).status, 200);
    await request('POST', '/api/auth/forgot-password', { email });
    db.prepare("UPDATE password_reset_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE used_at IS NULL").run();
    assert.equal((await request('POST', '/api/auth/recover-password', { ...body, token: tokens[1] })).status, 400);
    await request('POST', '/api/auth/forgot-password', { email });
    db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE email = ?").run(email);
    assert.equal((await request('POST', '/api/auth/recover-password', { ...body, token: tokens[2] })).status, 400);
  } finally { configMock.mock.restore(); sendMock.mock.restore(); }
});

test('가입, 사업자 승인, 점주 및 관리자 CRUD, 고객 주문 권한', async () => {
  const invalidBusiness = await request('POST', '/api/auth/register', {
    email: 'bad-owner@calar.local',
    password: 'owner-password-2026',
    displayName: 'Bad Owner',
    role: 'owner',
    business: { businessNumber: '123-45-67890', legalName: 'Bad Shop', representativeName: 'Owner', address: 'Seoul' },
  });
  assert.equal(invalidBusiness.status, 400);

  const ownerRegistration = await request('POST', '/api/auth/register', {
    email: 'owner@calar.local',
    password: 'owner-password-2026',
    displayName: 'Shop Owner',
    role: 'owner',
    address: '서울 노원구 월계동 1',
    business: {
      businessNumber: '123-45-67891',
      legalName: '월계 사업자',
      representativeName: '점주',
      address: '서울 노원구 월계동 1',
    },
  });
  assert.equal(ownerRegistration.status, 201, JSON.stringify(ownerRegistration.body));
  ownerId = ownerRegistration.body.user.id;
  assert.match(ownerRegistration.body.user.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(ownerRegistration.body.user.business.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(ownerRegistration.body.user.business.status, 'pending');
  const duplicateEmail = await request('POST', '/api/auth/register', {
    email: 'owner@calar.local', password: 'owner-password-2026', displayName: 'Duplicate',
  });
  assert.equal(duplicateEmail.status, 409);
  const duplicateBusiness = await request('POST', '/api/auth/register', {
    email: 'duplicate-business@calar.local', password: 'owner-password-2026', displayName: 'Duplicate', role: 'owner',
    business: { businessNumber: '123-45-67891', legalName: 'Duplicate', representativeName: 'Owner', address: 'Seoul' },
  });
  assert.equal(duplicateBusiness.status, 409);
  assert.equal(duplicateBusiness.body.error, 'Email or business registration number is already registered');
  assert.equal(db.prepare('SELECT user_id FROM users WHERE email = ?').get('duplicate-business@calar.local'), undefined);
  assert.equal((await request('POST', '/api/owner/stores', {}, null)).status, 401);

  const ownerLogin = await request('POST', '/api/auth/login', { email: 'owner@calar.local', password: 'owner-password-2026' });
  ownerToken = ownerLogin.body.token;
  const pendingStore = await request('POST', '/api/owner/stores', { name: 'Pending', address: 'Seoul' }, ownerToken);
  assert.equal(pendingStore.status, 403);

  const businesses = await request('GET', '/api/admin/businesses?status=pending', undefined, adminToken);
  assert.equal(businesses.status, 200);
  assert.equal(businesses.body[0].businessNumber, '1234567891');
  const review = await request('PATCH', `/api/admin/businesses/${businesses.body[0].id}`, { status: 'verified' }, adminToken);
  assert.equal(review.status, 200);
  assert.equal(review.body.status, 'verified');

  const categories = await request('GET', '/api/admin/categories', undefined, adminToken);
  const category = await request('POST', '/api/admin/categories', { name: '감사 로그 업종' }, adminToken);
  assert.equal(category.status, 201);
  await request('PATCH', `/api/admin/categories/${category.body.id}`, { name: '수정된 감사 업종' }, adminToken);
  await request('DELETE', `/api/admin/categories/${category.body.id}`, undefined, adminToken);
  const store = await request('POST', '/api/owner/stores', {
    name: '월계 테스트 가게',
    categoryId: categories.body[0].id,
    address: '서울 노원구 월계동 1',
    phone: '02-1234-5678',
    locationLat: 37.62,
    locationLng: 127.06,
    openHours: '09:00-18:00',
    orderType: 'preorder',
  }, ownerToken);
  assert.equal(store.status, 201, JSON.stringify(store.body));
  assert.match(store.body.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  storeId = store.body.id;
  assert.equal(store.body.ownerId, ownerId);

  const menu = await request('POST', `/api/owner/stores/${storeId}/menus`, { name: '테스트 메뉴', price: 4500 }, ownerToken);
  assert.equal(menu.status, 201);
  assert.match(menu.body.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  menuId = menu.body.id;
  const menuUpdate = await request('PATCH', `/api/owner/stores/${storeId}/menus/${menuId}`, { price: 5000 }, ownerToken);
  assert.equal(menuUpdate.body.price, 5000);
  const unusedMenu = await request('POST', `/api/owner/stores/${storeId}/menus`, { name: '삭제 메뉴', price: 1000 }, ownerToken);
  assert.equal((await request('DELETE', `/api/owner/stores/${storeId}/menus/${unusedMenu.body.id}`, undefined, ownerToken)).status, 204);

  const coupon = await request('POST', `/api/owner/stores/${storeId}/coupons`, { title: '첫 주문', discountRate: 10 }, ownerToken);
  assert.equal(coupon.status, 201);
  assert.match(coupon.body.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal((await request('PATCH', `/api/owner/stores/${storeId}/coupons/${coupon.body.id}`, { isActive: false }, ownerToken)).body.isActive, 0);
  assert.equal((await request('DELETE', `/api/owner/stores/${storeId}/coupons/${coupon.body.id}`, undefined, ownerToken)).status, 204);

  const customer = await request('POST', '/api/auth/register', {
    email: 'customer@calar.local', password: 'customer-password-2026', displayName: 'Customer', address: '서울 노원구 월계동 2',
  });
  assert.equal(customer.status, 201);
  customerId = customer.body.user.id;
  customerToken = (await request('POST', '/api/auth/login', { email: 'customer@calar.local', password: 'customer-password-2026' })).body.token;
  const profile = await request('PATCH', '/api/auth/profile', { phone: '010-1234-5678' }, customerToken);
  assert.equal(profile.body.user.phone, '010-1234-5678');
  assert.equal((await request('GET', '/api/admin/dashboard', undefined, customerToken)).status, 403);

  const pickupTime = new Date(Date.now() + 9 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + 'T12:30';
  const order = await request('POST', '/api/orders', {
    storeId, items: [{ menuId, quantity: 1 }], pickupTime, customerPhone: '010-1234-5678',
  }, customerToken);
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.match(order.body.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  orderId = order.body.id;
  assert.equal((await request('GET', '/api/auth/orders', undefined, customerToken)).body[0].id, orderId);
  assert.equal((await request('GET', `/api/orders/${orderId}`)).status, 401);
  assert.equal((await request('GET', `/api/orders/${orderId}`, undefined, ownerToken)).status, 200);
  assert.equal((await request('GET', `/api/owner/stores/${storeId}/orders`, undefined, ownerToken)).body[0].id, orderId);
  assert.equal((await request('PATCH', `/api/orders/${orderId}/status`, { status: 'accepted' }, ownerToken)).body.status, 'accepted');
  assert.equal((await request('DELETE', `/api/owner/stores/${storeId}/menus/${menuId}`, undefined, ownerToken)).status, 204);
  assert.equal((await request('DELETE', `/api/owner/stores/${storeId}`, undefined, ownerToken)).status, 204);

  const users = await request('GET', '/api/admin/users', undefined, adminToken);
  const customerRow = users.body.find((user) => user.id === customerId);
  assert.equal(customerRow.role, 'customer');
  const secondLogin = await request('POST', '/api/auth/login', { email: 'customer@calar.local', password: 'customer-password-2026' });
  assert.equal((await request('POST', '/api/auth/logout', undefined, secondLogin.body.token)).status, 204);
  assert.equal((await request('GET', '/api/auth/me', undefined, secondLogin.body.token)).status, 401);
  assert.equal((await request('PATCH', `/api/admin/users/${customerId}`, { isActive: false }, adminToken)).status, 200);
  assert.equal((await request('GET', '/api/auth/me', undefined, customerToken)).status, 401);
  assert.equal((await request('DELETE', `/api/admin/users/${customerId}`, undefined, adminToken)).status, 204);
  assert.ok(db.prepare('SELECT deleted_at FROM users WHERE user_id = ?').get(customerId).deleted_at);

  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'importantDetailsUpdate'").get(), undefined);
  assert.ok(db.prepare('SELECT deleted_at FROM stores WHERE store_id = ?').get(storeId).deleted_at);
  assert.ok(db.prepare('SELECT deleted_at FROM menus WHERE menu_id = ?').get(menuId).deleted_at);
  assert.ok(db.prepare('SELECT order_id FROM orders WHERE order_id = ?').get(orderId));
});
