export const REGIONS = [
  { id: 'wolgye', name: '월계동', latitude: 37.6205, longitude: 127.0601 },
  { id: 'gongneung', name: '공릉동', latitude: 37.6256, longitude: 127.0730 },
  { id: 'hagye', name: '하계동', latitude: 37.6362, longitude: 127.0678 },
];
export function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function savePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function visibleRecommendations(stores, hidden, now = Date.now()) {
  const values = hidden && typeof hidden === 'object' && !Array.isArray(hidden) ? hidden : {};
  return stores.filter((store) => !Number.isFinite(values[String(store.id)]) || values[String(store.id)] <= now);
}
export function nearbyStores(stores, keyword, location, distance) {
  const query = keyword.trim().toLocaleLowerCase();
  const located = Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  const items = stores.filter((store) => !query || `${store.name} ${store.category}`.toLocaleLowerCase().includes(query))
    .map((store) => ({ store, km: located ? distance(location, store.location) : null }));
  return located ? items.filter((item) => item.km !== null && item.km <= 2).sort((a, b) => a.km - b.km) : items;
}
