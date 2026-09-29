const stores = require('../data/stores');

// 전체 가게 목록 반환
function getAllStores() {
  return stores;
}

// id로 가게 하나 찾기 (없으면 null)
function getStoreById(id) {
  const storeId = Number(id);
  return stores.find((store) => store.id === storeId) ?? null;
}

module.exports = { getAllStores, getStoreById };
