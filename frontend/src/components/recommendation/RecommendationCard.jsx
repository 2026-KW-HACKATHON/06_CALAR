import RecommendationReason from './RecommendationReason';
import { getDistanceKm, formatDistance } from '../../utils/distance';

// 백엔드 데이터에 imageUrl/isNew 필드가 없어서, 이미지는 당장 미노출,
// 거리는 프론트에서 location으로 직접 계산해서 표시합니다.
const RecommendationCard = ({ store, userLocation, onClick }) => {
  const distanceKm = userLocation ? getDistanceKm(userLocation, store.location) : null;

  return (
    <div onClick={() => onClick(store.id)}>
      <h3>{store.name}</h3>
      <p>{store.category}</p>
      {distanceKm != null && <p>{formatDistance(distanceKm)}</p>}
      <RecommendationReason reason={store.reason} />
    </div>
  );
};

export default RecommendationCard;
