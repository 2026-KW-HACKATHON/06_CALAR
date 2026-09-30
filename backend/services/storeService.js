const stores = require('../data/stores');
const { nowMinutesKST, toMinutes, daysSince } = require('../utils/time');
const { distanceKm } = require('../utils/geo');

// 추천 기준값 (팀 협의 전 임시값)
const NEW_STORE_DAYS = 30; // 등록 30일 이내면 "신규 가게"
const LOW_VISITS = 30; // 방문수 30 이하면 "저활성 가게"
const RECOMMEND_RADIUS_KM = 2; // 좌표를 보내면 이 반경 안의 가게만 추천
const RECOMMEND_LIMIT = 10;

// openHours("11:00-21:00") 기준으로 영업중 여부 계산 (자정 넘기는 영업도 처리)
function getOpenStatus(openHours) {
  if (!openHours) return 'closed';
  const [open, close] = openHours.split('-').map(toMinutes);
  const now = nowMinutesKST();
  const isOpen = open <= close ? now >= open && now < close : now >= open || now < close;
  return isOpen ? 'open' : 'closed';
}

// 응답용 가게 객체 (openStatus 포함)
function withOpenStatus(store) {
  return { ...store, openStatus: getOpenStatus(store.openHours) };
}

// 가게 목록 반환 (category/keyword 필터, 좌표가 있으면 거리순 정렬)
function getAllStores({ category, keyword, lat, lng } = {}) {
  let result = stores;

  if (category) {
    result = result.filter((store) => store.category === category);
  }

  if (keyword) {
    result = result.filter(
      (store) =>
        store.name.includes(keyword) ||
        store.signKeywords.some((k) => k.includes(keyword))
    );
  }

  if (lat !== undefined && lng !== undefined) {
    const origin = { lat, lng };
    result = [...result].sort(
      (a, b) => distanceKm(origin, a.location) - distanceKm(origin, b.location)
    );
  }

  return result.map(withOpenStatus);
}

// 원본 가게 객체 찾기 (내부용 — 없으면 null)
function findStore(id) {
  const storeId = Number(id);
  return stores.find((s) => s.id === storeId) ?? null;
}

// id로 가게 하나 찾기 (없으면 null). 상세 조회 1번 = 방문수 1 증가
function getStoreById(id) {
  const store = findStore(id);
  if (!store) return null;
  store.visits += 1;
  return withOpenStatus(store);
}

// 오늘의 동네 추천: 신규 가게(최근 등록순) → 저활성 가게(방문 적은 순)
function getRecommendedStores({ lat, lng } = {}) {
  let candidates = stores;

  if (lat !== undefined && lng !== undefined) {
    const origin = { lat, lng };
    candidates = candidates.filter(
      (store) => distanceKm(origin, store.location) <= RECOMMEND_RADIUS_KM
    );
  }

  const isNew = (store) => daysSince(store.createdAt) <= NEW_STORE_DAYS;
  const newStores = candidates
    .filter(isNew)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.visits - b.visits);
  const lowStores = candidates
    .filter((store) => !isNew(store) && store.visits <= LOW_VISITS)
    .sort((a, b) => a.visits - b.visits);

  return [...newStores, ...lowStores].slice(0, RECOMMEND_LIMIT).map(withOpenStatus);
}

// 공백 제거 + 소문자 (간판 글자와 키워드 비교용)
function normalize(text) {
  return text.replace(/\s+/g, '').toLowerCase();
}

// 인식된 간판 글자와 가게 이름/signKeywords를 비교해 매칭되는 가게 목록 반환 (점수 높은 순)
function matchStoresByText(text) {
  const target = normalize(text);
  if (!target) return [];

  return stores
    .map((store) => {
      let score = 0;
      if (target.includes(normalize(store.name))) score += 10; // 가게 이름이 통째로 보이면 가장 확실
      for (const keyword of store.signKeywords) {
        if (target.includes(normalize(keyword))) score += 1;
      }
      return { store, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ store }) => ({ id: store.id, name: store.name }));
}

module.exports = {
  getAllStores,
  findStore,
  getStoreById,
  getRecommendedStores,
  matchStoresByText,
};
