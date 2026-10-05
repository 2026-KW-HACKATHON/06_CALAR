import api from './api';

// 가게 목록/검색 (Home, ManualInput에서 사용)
export const getStores = async ({ category, keyword, lat, lng } = {}) => {
  const res = await api.get('/api/stores', {
    params: { category, keyword, lat, lng },
  });
  return res.data;
};

// 가게 상세 조회
// QR 코드는 별도 API 없이, QR 안에 storeId만 담아서 이 함수로 조회합니다.
export const getStoreDetail = async (storeId) => {
  const res = await api.get(`/api/stores/${storeId}`);
  return res.data;
};

// 간판 인식 (사진 -> 매칭되는 가게)
export const recognizeSignboard = async (imageBlob) => {
  const formData = new FormData();
  formData.append('image', imageBlob, 'signboard.jpg');

  const res = await api.post('/api/stores/recognize', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data; // { matched, stores }
};

// 오늘의 동네 추천 목록
export const getRecommendedStores = async ({ lat, lng } = {}) => {
  const res = await api.get('/api/stores/recommendations', {
    params: { lat, lng },
  });
  return res.data;
};
