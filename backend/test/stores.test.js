// 가게 관련 API 테스트: 목록, 상세(방문수), 추천, 공통 에러
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

// 현재 시각을 한국 시간 2026-10-01 12:00으로 고정 (모든 샘플 가게가 영업중인 시간)
const NOON_KST = Date.parse('2026-10-01T03:00:00Z');
const MIN = 60 * 1000;

let server;
test.before(async () => {
  test.mock.timers.enable({ apis: ['Date'], now: NOON_KST });
  server = await startServer();
});
test.after(async () => {
  await server.close();
  test.mock.timers.reset();
});

const get = (path, opts) => server.request('GET', path, opts);
const ids = (list) => list.map((s) => s.id);

test('GET /api/stores: 전체 목록 + openStatus 계산', async () => {
  test.mock.timers.setTime(NOON_KST);
  const res = await get('/api/stores');
  assert.equal(res.status, 200);
  assert.deepEqual(ids(res.body), [1, 2, 3, 4, 5]);
  assert.ok(res.body.every((s) => s.openStatus === 'open'));

  test.mock.timers.setTime(NOON_KST + 11 * 60 * MIN + 30 * MIN); // 23:30
  const night = await get('/api/stores');
  assert.ok(night.body.every((s) => s.openStatus === 'closed'));
  test.mock.timers.setTime(NOON_KST);
});

test('GET /api/stores: category / keyword 필터', async () => {
  assert.deepEqual(ids((await get('/api/stores?category=' + encodeURIComponent('음식점'))).body), [1]);
  assert.deepEqual(ids((await get('/api/stores?category=' + encodeURIComponent(' 카페 '))).body), [5]);
  assert.deepEqual(ids((await get('/api/stores?category=' + encodeURIComponent('없는업종'))).body), []);
  assert.deepEqual(ids((await get('/api/stores?keyword=' + encodeURIComponent('손 칼국수'))).body), [1]);
  assert.deepEqual(ids((await get('/api/stores?keyword=' + encodeURIComponent('월계'))).body), [1, 4]);
  assert.deepEqual(ids((await get('/api/stores?keyword=' + encodeURIComponent('세탁'))).body), [2]);
  // 공백뿐인 값은 필터 없음
  assert.deepEqual(ids((await get('/api/stores?keyword=%20%20&category=')).body), [1, 2, 3, 4, 5]);
  // 같은 키를 두 번 → 400
  assert.equal((await get('/api/stores?category=a&category=b')).status, 400);
  assert.equal((await get('/api/stores?keyword=a&keyword=b')).status, 400);
});

test('GET /api/stores: 거리순 정렬과 좌표 검사', async () => {
  const res = await get('/api/stores?lat=37.6227&lng=127.0623'); // 4번 가게 위치
  assert.equal(res.status, 200);
  assert.equal(res.body[0].id, 4);
  assert.equal(res.body.length, 5);

  for (const query of ['lat=37.6', 'lng=127', 'lat=abc&lng=127', 'lat=&lng=127', 'lat=999&lng=127', 'lat=37&lng=0x10']) {
    const bad = await get('/api/stores?' + query);
    assert.equal(bad.status, 400, query);
    assert.equal(typeof bad.body.error, 'string');
  }
});

test('GET /api/stores/:id: 상세 조회와 404', async () => {
  const res = await get('/api/stores/1');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, '월계 손칼국수');
  assert.equal(res.body.openStatus, 'open');
  assert.equal(res.body.menu[0].id, 101);

  for (const id of ['999', '0', '-1', 'abc', '1.0', '0x1', '01']) {
    const bad = await get('/api/stores/' + id);
    assert.equal(bad.status, 404, id);
    assert.deepEqual(bad.body, { error: 'Store not found' });
  }
});

test('GET /api/stores/:id: 같은 사용자의 반복 조회는 30분 동안 1번만 센다', async () => {
  test.mock.timers.setTime(NOON_KST);
  const ua = { 'user-agent': 'visit-test-A' };
  const before = (await server.request('HEAD', '/api/stores/2', { headers: ua })).status;
  assert.equal(before, 200); // HEAD는 세지 않음

  const first = (await get('/api/stores/2', { headers: ua })).body.visits;
  const again = (await get('/api/stores/2', { headers: ua })).body.visits; // 새로고침 / StrictMode 중복 호출
  assert.equal(again, first);

  const other = (await get('/api/stores/2', { headers: { 'user-agent': 'visit-test-B' } })).body.visits;
  assert.equal(other, first + 1); // 다른 사용자

  test.mock.timers.setTime(NOON_KST + 29 * MIN);
  assert.equal((await get('/api/stores/2', { headers: ua })).body.visits, first + 1);
  test.mock.timers.setTime(NOON_KST + 30 * MIN);
  assert.equal((await get('/api/stores/2', { headers: ua })).body.visits, first + 2); // 30분 지나면 다시 셈
  test.mock.timers.setTime(NOON_KST);
});

test('GET /api/stores/recommendations: 신규 → 저활성 순서', async () => {
  const res = await get('/api/stores/recommendations');
  assert.equal(res.status, 200);
  // 신규(30일 이내): 5, 4 (9/25, 방문 적은 순) → 3 (9/20) / 저활성: 2 / 1번은 오래되고 방문 많아 제외
  assert.deepEqual(ids(res.body), [5, 4, 3, 2]);
  assert.ok(res.body.every((s) => s.openStatus));

  assert.deepEqual(ids((await get('/api/stores/recommendations?lat=37.62&lng=127.06')).body), [5, 4, 3, 2]);
  assert.deepEqual((await get('/api/stores/recommendations?lat=35.1&lng=129.0')).body, []); // 부산: 반경 밖
  assert.equal((await get('/api/stores/recommendations?lat=37.6')).status, 400);
  assert.equal((await get('/api/stores/recommendations?lat=x&lng=y')).status, 400);
});

test('공통: 없는 주소, 깨진 URL, CORS', async () => {
  assert.deepEqual((await get('/api/nope')).body, { error: 'Not found' });
  assert.equal((await server.request('DELETE', '/api/stores/1')).status, 404);

  const broken = await get('/api/stores/%E0%A4%A');
  assert.equal(broken.status, 400);
  assert.equal(typeof broken.body.error, 'string');

  const res = await get('/api/stores', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const preflight = await server.request('OPTIONS', '/api/orders/1/status', {
    headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'PATCH' },
  });
  assert.equal(preflight.status, 204);
});
