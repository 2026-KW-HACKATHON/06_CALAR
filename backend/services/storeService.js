const db = require('../db');
const { nowMinutesKST, nowKSTString, toMinutes, daysSince } = require('../utils/time');
const { distanceKm } = require('../utils/geo');

// 추천 기준값 (팀 협의 전 임시값)
const NEW_STORE_DAYS = 30; // 등록 30일 이내면 "신규 가게"
const LOW_VISITS = 30; // 방문수 30 이하면 "저활성 가게"
const RECOMMEND_RADIUS_KM = 2; // 좌표를 보내면 이 반경 안의 가게만 추천
const RECOMMEND_LIMIT = 10;
// 추천 카드에 그대로 보여줄 추천 이유 (프론트 RecommendationReason)
const REASON_NEW = '새로 오픈했어요';
const REASON_LOW_VISITS = '숨어있는 동네 가게예요';

// 간판 매칭 기준: 가게 이름 전체가 보이면 10점, 키워드 하나당 1점. 2점 이상이어야 매칭으로 인정
const NAME_MATCH_SCORE = 10;
const MIN_MATCH_SCORE = 2;

// 방문수 집계: 같은 사용자(IP + 브라우저)가 같은 가게를 다시 조회해도 이 시간 안에는 1번만 센다
const VISIT_DEDUP_MS = 30 * 60 * 1000;
const MAX_VISIT_RECORDS = 50000; // 기록이 무한히 쌓이지 않도록 상한
const recentVisits = new Map(); // "가게id|사용자" -> 마지막으로 센 시각(ms). 오래된 것부터 앞에 있다

// "11:00-21:00" → { open, close } (분 단위). 형식이 틀리면 null
function parseOpenHours(openHours) {
  if (typeof openHours !== 'string') return null;
  const parts = openHours.split('-');
  if (parts.length !== 2) return null;
  const [open, close] = parts.map(toMinutes);
  if (open === null || close === null || open === 24 * 60) return null;
  return { open, close };
}

// 하루 중 minutes(분) 시각에 영업중인지
// - 자정을 넘기는 영업("18:00-02:00")도 처리
// - 여는 시각 = 닫는 시각("00:00-00:00", "00:00-24:00")이면 24시간 영업
function isOpenAt(openHours, minutes) {
  const hours = parseOpenHours(openHours);
  if (!hours) return false;
  const { open } = hours;
  const close = hours.close % (24 * 60);
  if (open === close) return true;
  return open < close ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

// 응답용 가게 객체 (openStatus 포함)
function withOpenStatus(store) {
  return { ...store, openStatus: isOpenAt(store.openHours, nowMinutesKST()) ? 'open' : 'closed' };
}

function mapStore(row) {
  const rating = db.prepare(`SELECT AVG(r.score) AS average, COUNT(*) AS count FROM order_ratings r
    JOIN orders o ON o.order_id = r.order_id WHERE o.store_id = ? AND o.status = 'done'`).get(row.id);
  const signKeywords = db.prepare('SELECT name FROM signKeyWords WHERE store_id = ? AND deleted_at IS NULL ORDER BY id').all(row.id);
  const menu = db.prepare('SELECT menu_id AS id, uuid, name, price FROM menus WHERE store_id = ? AND deleted_at IS NULL ORDER BY menu_id').all(row.id);
  // 사용 기간(valid_from ~ valid_until, 한국 날짜 기준) 안의 쿠폰만 고객에게 보여준다
  const today = nowKSTString().slice(0, 10);
  const coupon = db.prepare(`SELECT uuid, title, discount_rate AS discountRate FROM coupons
    WHERE store_id = ? AND deleted_at IS NULL AND is_active = 1
      AND (valid_from IS NULL OR valid_from <= ?) AND (valid_until IS NULL OR valid_until >= ?)
    ORDER BY coupon_id LIMIT 1`).get(row.id, today, today);
  return {
    id: row.id,
    rating: rating.average === null ? null : Math.round(rating.average * 10) / 10,
    ratingCount: rating.count,
    uuid: row.uuid,
    name: row.name,
    category: row.category,
    description: row.description,
    phone: row.phone,
    address: row.address,
    location: { lat: row.location_lat, lng: row.location_lng },
    openHours: row.open_hours,
    orderType: row.order_type,
    signKeywords: signKeywords.map((keyword) => keyword.name),
    menu,
    coupon: coupon ?? null,
    visits: row.visits,
    createdAt: row.created_at,
  };
}

function listStores() {
  const rows = db.prepare(`
    SELECT stores.store_id AS id, stores.uuid, stores.name, categories.name AS category,
      stores.description, stores.phone, stores.address, stores.location_lat,
      stores.location_lng, stores.open_hours, stores.order_type, stores.visits,
      stores.created_at
    FROM stores
    LEFT JOIN categories ON categories.category_id = stores.category_id AND categories.deleted_at IS NULL
    WHERE stores.deleted_at IS NULL
    ORDER BY stores.store_id
  `).all();
  return rows.map(mapStore);
}

// 공백·특수문자 제거 + 소문자 + 유니코드 정규화 (간판 글자와 키워드 비교용)
// 예: "월계·손 칼국수!" → "월계손칼국수"
function normalize(text) {
  return String(text).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// 가게 목록 반환 (category 일치, keyword는 이름·signKeywords 부분 일치, 좌표가 있으면 거리순 정렬)
function getAllStores({ category, keyword, lat, lng } = {}) {
  let result = listStores();

  if (category !== undefined) {
    result = result.filter((store) => store.category === category);
  }

  if (keyword !== undefined) {
    const target = normalize(keyword);
    if (target) {
      result = result.filter(
        (store) =>
          normalize(store.name).includes(target) ||
          store.signKeywords.some((k) => normalize(k).includes(target))
      );
    }
  }

  if (lat !== undefined && lng !== undefined) {
    const origin = { lat, lng };
    result = [...result].sort(
      (a, b) => distanceKm(origin, a.location) - distanceKm(origin, b.location)
    );
  }

  return result.map(withOpenStatus);
}

// 원본 가게 객체 찾기 (내부용 — 없으면 null). id는 이미 검사된 정수
function findStore(id) {
  const row = db.prepare(`
    SELECT stores.store_id AS id, stores.uuid, stores.name, categories.name AS category,
      stores.description, stores.phone, stores.address, stores.location_lat,
      stores.location_lng, stores.open_hours, stores.order_type, stores.visits,
      stores.created_at
    FROM stores
    LEFT JOIN categories ON categories.category_id = stores.category_id AND categories.deleted_at IS NULL
    WHERE stores.store_id = ? AND stores.deleted_at IS NULL
  `).get(id);
  return row ? mapStore(row) : null;
}

// 방문 1회 기록. 같은 사용자가 VISIT_DEDUP_MS 안에 다시 오면 세지 않는다
function recordVisit(store, visitorKey, now = Date.now()) {
  // 만료된 기록 정리 (Map은 넣은 순서를 유지하므로 앞에서부터 지우다가 만료 안 된 게 나오면 멈춘다)
  for (const [key, time] of recentVisits) {
    if (now - time < VISIT_DEDUP_MS) break;
    recentVisits.delete(key);
  }

  const key = `${store.id}|${visitorKey}`;
  if (recentVisits.has(key)) return;

  db.prepare('UPDATE stores SET visits = visits + 1 WHERE store_id = ?').run(store.id);
  store.visits += 1;
  recentVisits.set(key, now);
  if (recentVisits.size > MAX_VISIT_RECORDS) {
    recentVisits.delete(recentVisits.keys().next().value);
  }
}

// id로 가게 하나 찾기 (없으면 null). visitorKey를 넘기면 방문수 집계
function getStoreById(id, { visitorKey } = {}) {
  const store = findStore(id);
  if (!store) return null;
  if (visitorKey !== undefined) recordVisit(store, visitorKey);
  return withOpenStatus(store);
}

function hasLocation(store) {
  return Number.isFinite(store.location?.lat) && Number.isFinite(store.location?.lng);
}

// 오늘의 동네 추천: 신규 가게(최근 등록순) → 저활성 가게(방문 적은 순), 각 가게에 추천 이유(reason) 포함
function getRecommendedStores({ lat, lng } = {}) {
  let candidates = listStores();

  if (lat !== undefined && lng !== undefined) {
    const origin = { lat, lng };
    // 점주가 직접 등록한 가게는 좌표가 없을 수 있다. 거리를 모를 뿐이니 반경 필터에서 빼지 않는다
    // (안 그러면 추천의 주 대상인 신규 가게가 위치를 보낸 사용자에게는 전부 사라진다)
    candidates = candidates.filter(
      (store) => !hasLocation(store) || distanceKm(origin, store.location) <= RECOMMEND_RADIUS_KM
    );
  }

  const isNew = (store) => daysSince(store.createdAt) <= NEW_STORE_DAYS;
  const newStores = candidates
    .filter(isNew)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.visits - b.visits)
    .map((store) => ({ ...store, reason: REASON_NEW }));
  const lowStores = candidates
    .filter((store) => !isNew(store) && store.visits <= LOW_VISITS)
    .sort((a, b) => a.visits - b.visits)
    .map((store) => ({ ...store, reason: REASON_LOW_VISITS }));

  return [...newStores, ...lowStores].slice(0, RECOMMEND_LIMIT).map(withOpenStatus);
}

// 인식된 간판 글자와 가게 이름/signKeywords를 비교해 매칭되는 가게 목록 반환 (점수 높은 순)
function matchStoresByText(text) {
  const target = normalize(text);
  if (!target) return [];

  return listStores()
    .map((store) => {
      const name = normalize(store.name);
      const hits = [...new Set(store.signKeywords.map(normalize))].filter(
        (k) => k && target.includes(k)
      );
      // '칼국수'처럼 다른 매칭 키워드('손칼국수')에 포함된 키워드는 따로 점수를 주지 않는다
      // (안 그러면 '엄마손칼국수' 간판 하나로 2점이 되어 다른 가게로 매칭됨)
      const distinct = hits.filter((k) => !hits.some((other) => other !== k && other.includes(k)));
      const score = (name && target.includes(name) ? NAME_MATCH_SCORE : 0) + distinct.length;
      return { store, score };
    })
    .filter(({ score }) => score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score || a.store.id - b.store.id)
    .map(({ store }) => ({ id: store.id, name: store.name }));
}

module.exports = {
  isOpenAt,
  getAllStores,
  findStore,
  getStoreById,
  getRecommendedStores,
  matchStoresByText,
};
