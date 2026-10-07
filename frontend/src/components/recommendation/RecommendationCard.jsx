import StoreCard from '../store/StoreCard';
import RecommendationReason from './RecommendationReason';
import { getDistanceKm, formatDistance } from '../../utils/distance';

// 오늘의 동네 추천 카드 = Home 의 가게 카드(StoreCard) + 추천 이유
// 백엔드 데이터에 imageUrl/isNew 필드가 없어서 이미지는 쓰지 않고,
// 거리는 프론트에서 location 으로 직접 계산해서 표시합니다.
const RecommendationCard = ({ store, userLocation, onClick }) => {
  const distanceKm = userLocation ? getDistanceKm(userLocation, store.location) : null;

  return (
    <StoreCard
      store={store}
      distanceText={distanceKm != null ? formatDistance(distanceKm) : undefined}
      extra={<RecommendationReason reason={store.reason} />}
      onClick={() => onClick(store.id)}
    />
  );
};

export default RecommendationCard;
