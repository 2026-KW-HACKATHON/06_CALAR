const stores = require('../data/stores');

// 현재 한국 시간(KST)을 자정부터 지난 분으로 반환
function nowMinutesKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

// "HH:MM" -> 분
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

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

// 두 좌표 사이 거리(km)
function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
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

// id로 가게 하나 찾기 (없으면 null)
function getStoreById(id) {
  const storeId = Number(id);
  const store = stores.find((s) => s.id === storeId);
  return store ? withOpenStatus(store) : null;
}

module.exports = { getAllStores, getStoreById };
