const test = require('node:test');
const assert = require('node:assert/strict');
test('discovery searches categories, filters two km, orders distances, and handles zero coordinates', async () => {
  const { nearbyStores, visibleRecommendations } = await import('../../frontend/src/utils/discoveryPreferences.js');
  const { getDistanceKm } = await import('../../frontend/src/utils/distance.js');
  const stores = [
    { id: 1, name: '세탁소', category: '세탁소', location: { lat: 0, lng: .01 } },
    { id: 2, name: '국수', category: '음식점', location: { lat: 0, lng: .005 } },
    { id: 3, name: '먼 가게', category: '음식점', location: { lat: 0, lng: 1 } },
    { id: 4, name: '위치 없음', category: '음식점', location: {} },
  ];
  assert.deepEqual(nearbyStores(stores, '', { latitude: 0, longitude: 0 }, getDistanceKm).map((item) => item.store.id), [2, 1]);
  assert.deepEqual(nearbyStores(stores, '음식점', {}, getDistanceKm).map((item) => item.store.id), [2, 3, 4]);
  assert.equal(nearbyStores(stores, '없는 이름', {}, getDistanceKm).length, 0);
  assert.deepEqual(visibleRecommendations(stores, { 1: 200, 2: 100 }, 100).map((item) => item.id), [2, 3, 4]);
  assert.equal(visibleRecommendations(stores, null).length, 4);
});
