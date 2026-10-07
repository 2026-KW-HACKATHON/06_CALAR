// 주문 관련 API 테스트: 생성(검증), 조회, 가게별 목록, 상태 변경
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

// 현재 시각을 한국 시간 2026-10-01 12:00으로 고정
const NOON_KST = Date.parse('2026-10-01T03:00:00Z');

let server;
let adminHeaders;
let customerHeaders;
test.before(async () => {
  test.mock.timers.enable({ apis: ['Date'], now: NOON_KST });
  server = await startServer();
  const login = await server.request('POST', '/api/auth/login', {
    json: { email: 'test-admin@calar.local', password: 'test-admin-password-2026' },
  });
  const customer = await server.request('POST', '/api/auth/register', {
    json: { email: 'orders-customer@calar.local', password: 'orders-customer-password', displayName: 'Order Customer' },
  });
  assert.equal(customer.status, 201);
  const customerLogin = await server.request('POST', '/api/auth/login', {
    json: { email: 'orders-customer@calar.local', password: 'orders-customer-password' },
  });
  customerHeaders = { authorization: `Bearer ${customerLogin.body.token}` };
  adminHeaders = { authorization: `Bearer ${login.body.token}` };
});
test.after(async () => {
  await server.close();
  test.mock.timers.reset();
});

const valid = () => ({
  storeId: 1,
  items: [{ menuId: 101, quantity: 2 }],
  pickupTime: '2026-10-02T12:30',
  customerPhone: '010-1234-5678',
});
const post = (json) => server.request('POST', '/api/orders', { json, headers: customerHeaders });
const patch = (id, json) => server.request('PATCH', `/api/orders/${id}/status`, { json, headers: adminHeaders });

// 400 + 에러 메시지 확인
async function expectError(res, status, error) {
  const r = await res;
  assert.equal(r.status, status, JSON.stringify(r.body));
  if (error instanceof RegExp) assert.match(r.body.error, error);
  else assert.deepEqual(r.body, { error });
}

test('POST /api/orders: 정상 생성, 서버가 가격·상태·시각을 정함', async () => {
  const res = await post({
    ...valid(),
    items: [
      { menuId: 101, quantity: 2 },
      { menuId: 102, quantity: 1 },
      { menuId: 101, quantity: 1 }, // 같은 메뉴는 합쳐짐
    ],
    totalPrice: 1, // 무시됨
    status: 'done', // 무시됨
    id: 999, // 무시됨
    extra: 'ignored',
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, {
    id: res.body.id,
    uuid: res.body.uuid,
    storeId: 1,
    items: [
      { menuId: 101, uuid: res.body.items[0].uuid, quantity: 3 },
      { menuId: 102, uuid: res.body.items[1].uuid, quantity: 1 },
    ],
    totalPrice: 8000 * 3 + 6000,
    pickupTime: '2026-10-02T12:30',
    customerPhone: '010-1234-5678',
    status: 'pending',
    createdAt: '2026-10-01T12:00',
  });
  assert.match(res.body.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(res.body.id, 999);

  // 예약만 받는 가게도 주문 가능, 다양한 전화번호 형식
  for (const customerPhone of ['01012345678', '02-123-4567', '031-1234-5678', '0212345678']) {
    const ok = await post({ ...valid(), storeId: 3, items: [{ menuId: 301, quantity: 1 }], customerPhone });
    assert.equal(ok.status, 201, customerPhone);
  }
});

test('POST /api/orders: body 형식', async () => {
  await expectError(server.request('POST', '/api/orders', { headers: customerHeaders }), 400, 'Request body must be a JSON object');
  await expectError(post([valid()]), 400, 'Request body must be a JSON object');
  await expectError(
    server.request('POST', '/api/orders', { body: '{"storeId":', headers: { ...customerHeaders, 'content-type': 'application/json' } }),
    400,
    'Invalid JSON body'
  );
  await expectError(
    server.request('POST', '/api/orders', { body: 'storeId=1', headers: { ...customerHeaders, 'content-type': 'application/x-www-form-urlencoded' } }),
    400,
    'Request body must be a JSON object'
  );
  await expectError(post({ ...valid(), memo: 'x'.repeat(200 * 1024) }), 413, 'Request body too large');
});

test('POST /api/orders: 필수값과 storeId', async () => {
  for (const field of ['storeId', 'items', 'pickupTime', 'customerPhone']) {
    for (const empty of [undefined, null, '']) {
      await expectError(post({ ...valid(), [field]: empty }), 400, `${field} is required`);
    }
  }
  for (const storeId of ['1', 1.5, 0, -1, true, [1], { id: 1 }]) {
    await expectError(post({ ...valid(), storeId }), 400, 'Invalid storeId');
  }
  await expectError(post({ ...valid(), storeId: 999 }), 404, 'Store not found');
  await expectError(post({ ...valid(), storeId: 5, items: [{ menuId: 501, quantity: 1 }] }), 400, 'This store does not accept orders');
});

test('POST /api/orders: items와 수량', async () => {
  for (const items of [[], 'abc', { menuId: 101, quantity: 1 }, 5]) {
    await expectError(post({ ...valid(), items }), 400, 'items must be a non-empty array');
  }
  for (const item of [null, 5, 'x', [101, 1]]) {
    await expectError(post({ ...valid(), items: [item] }), 400, 'Each item must be an object with menuId and quantity');
  }
  await expectError(post({ ...valid(), items: [{ menuId: 999, quantity: 1 }] }), 400, 'Invalid menuId: 999');
  await expectError(post({ ...valid(), items: [{ menuId: 201, quantity: 1 }] }), 400, 'Invalid menuId: 201'); // 다른 가게 메뉴
  await expectError(post({ ...valid(), items: [{ menuId: '101', quantity: 1 }] }), 400, 'Invalid menuId: 101');
  await expectError(post({ ...valid(), items: [{ quantity: 1 }] }), 400, 'Invalid menuId: undefined');
  for (const quantity of [0, -1, 1.5, '2', null, undefined]) {
    await expectError(post({ ...valid(), items: [{ menuId: 101, quantity }] }), 400, 'Invalid quantity for menuId: 101');
  }
  await expectError(post({ ...valid(), items: [{ menuId: 101, quantity: 100 }] }), 400, 'Quantity for menuId: 101 exceeds 99');
  await expectError(post({ ...valid(), items: [{ menuId: 101, quantity: 1e15 }] }), 400, 'Quantity for menuId: 101 exceeds 99');
  await expectError(
    post({ ...valid(), items: [{ menuId: 101, quantity: 60 }, { menuId: 101, quantity: 60 }] }),
    400,
    'Quantity for menuId: 101 exceeds 99'
  );
  assert.equal((await post({ ...valid(), items: [{ menuId: 101, quantity: 99 }] })).status, 201);
});

test('POST /api/orders: pickupTime (형식, 실제 날짜, 과거, 30일, 영업시간)', async () => {
  const withTime = (pickupTime) => post({ ...valid(), pickupTime });

  for (const bad of ['2026-02-30T12:00', '2026-13-01T12:00', '2026-10-32T12:00', '2026-10-02T24:00', '2026-10-02 12:30', '2026-10-2T12:30', '내일 점심', 20261002]) {
    await expectError(withTime(bad), 400, 'Invalid pickupTime format (YYYY-MM-DDTHH:mm)');
  }
  await expectError(withTime('2026-10-01T11:59'), 400, 'pickupTime must not be in the past');
  await expectError(withTime('2025-10-02T12:00'), 400, 'pickupTime must not be in the past');
  assert.equal((await withTime('2026-10-01T12:00')).status, 201); // 지금 이 분은 허용
  assert.equal((await withTime('2026-10-31T12:00')).status, 201); // 딱 30일 뒤
  await expectError(withTime('2026-10-31T12:01'), 400, 'pickupTime must be within 30 days');
  // 1번 가게 영업시간 11:00-21:00
  await expectError(withTime('2026-10-02T10:59'), 400, 'pickupTime is outside business hours');
  await expectError(withTime('2026-10-02T21:00'), 400, 'pickupTime is outside business hours');
  await expectError(withTime('2026-10-02T03:00'), 400, 'pickupTime is outside business hours');
  assert.equal((await withTime('2026-10-02T11:00')).status, 201);
  assert.equal((await withTime('2026-10-02T20:59')).status, 201);
});

test('POST /api/orders: customerPhone', async () => {
  for (const customerPhone of ['---------', '12345', '010-1234-567', '010-12345-6789', '010 1234 5678', '+82-10-1234-5678', 'abc-defg-hijk', 1012345678]) {
    await expectError(post({ ...valid(), customerPhone }), 400, 'Invalid customerPhone format');
  }
});

test('GET /api/orders/:id', async () => {
  const created = (await post(valid())).body;
  const res = await server.request('GET', `/api/orders/${created.id}`, { headers: customerHeaders });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, created);
  for (const id of ['99999', '0', 'abc', '1.0']) {
    await expectError(server.request('GET', `/api/orders/${id}`), 404, 'Order not found');
  }
});

test('GET /api/stores/:id/orders: 필터와 정렬', async () => {
  const list = async (query = '') => server.request('GET', `/api/stores/4/orders${query}`, { headers: adminHeaders });
  const a = (await post({ ...valid(), storeId: 4, items: [{ menuId: 401, quantity: 1 }], pickupTime: '2026-10-03T09:00' })).body;
  const b = (await post({ ...valid(), storeId: 4, items: [{ menuId: 402, quantity: 1 }], pickupTime: '2026-10-02T09:00' })).body;
  const c = (await post({ ...valid(), storeId: 4, items: [{ menuId: 402, quantity: 2 }], pickupTime: '2026-10-02T09:00' })).body;
  await patch(a.id, { status: 'accepted' });

  const all = (await list()).body;
  assert.ok(all.every((o) => o.storeId === 4));
  const mine = all.filter((o) => [a.id, b.id, c.id].includes(o.id)).map((o) => o.id);
  assert.deepEqual(mine, [b.id, c.id, a.id]); // 픽업 빠른 순, 같으면 먼저 들어온 순

  assert.ok((await list('?status=pending')).body.every((o) => o.status === 'pending'));
  assert.ok((await list('?status=accepted')).body.some((o) => o.id === a.id));
  assert.equal((await list('?status=')).body.length, all.length); // 빈 값 = 전체
  await expectError(list('?status=foo'), 400, 'Invalid status value');
  await expectError(list('?status=pending&status=done'), 400, /status/);
  await expectError(server.request('GET', '/api/stores/999/orders', { headers: adminHeaders }), 404, 'Store not found');
  await expectError(server.request('GET', '/api/stores/abc/orders', { headers: adminHeaders }), 404, 'Store not found');
  assert.deepEqual((await server.request('GET', '/api/stores/5/orders', { headers: adminHeaders })).body, []); // 주문 안 받는 가게
});

test('PATCH /api/orders/:id/status: 상태 전이 규칙', async () => {
  const id = (await post(valid())).body.id;

  await expectError(patch(id, {}), 400, 'status is required');
  await expectError(server.request('PATCH', `/api/orders/${id}/status`, { headers: adminHeaders }), 400, 'status is required');
  await expectError(patch(id, [{ status: 'accepted' }]), 400, 'status is required');
  await expectError(patch(id, { status: 'pending' }), 400, 'Cannot change status to pending');
  for (const status of ['foo', 'ACCEPTED', 123, ['accepted'], { v: 1 }]) {
    await expectError(patch(id, { status }), 400, 'Invalid status value');
  }
  await expectError(patch(id, { status: 'done' }), 409, 'Cannot change status from pending to done');

  assert.equal((await patch(id, { status: 'accepted' })).body.status, 'accepted');
  await expectError(patch(id, { status: 'accepted' }), 409, 'Cannot change status from accepted to accepted');
  await expectError(patch(id, { status: 'rejected' }), 409, 'Cannot change status from accepted to rejected');
  assert.equal((await patch(id, { status: 'done' })).body.status, 'done');
  await expectError(patch(id, { status: 'rejected' }), 409, 'Order status cannot be changed anymore');
  await expectError(patch(id, { status: 'pending' }), 400, 'Cannot change status to pending');

  const rejected = (await post(valid())).body.id;
  assert.equal((await patch(rejected, { status: 'rejected' })).status, 200);
  await expectError(patch(rejected, { status: 'accepted' }), 409, 'Order status cannot be changed anymore');

  await expectError(patch(99999, { status: 'accepted' }), 404, 'Order not found');
  await expectError(patch('abc', { status: 'accepted' }), 404, 'Order not found');
  assert.equal((await server.request('GET', `/api/orders/${id}`, { headers: customerHeaders })).body.status, 'done'); // 실제로 저장됨
});
