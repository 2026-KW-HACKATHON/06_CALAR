// 두 좌표 사이 거리 계산 (하버사인 공식, 단위: km)
// 추천 카드에서 "몇 m 거리" 표시할 때 사용
export const getDistanceKm = (from, to) => {
  if (!from?.latitude || !to?.lat) return null;

  const R = 6371; // 지구 반지름 (km)
  const dLat = ((to.lat - from.latitude) * Math.PI) / 180;
  const dLng = ((to.lng - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// km 값을 화면에 보여줄 문자열로 변환 (예: 0.8 -> "800m", 2.3 -> "2.3km")
export const formatDistance = (km) => {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
};
