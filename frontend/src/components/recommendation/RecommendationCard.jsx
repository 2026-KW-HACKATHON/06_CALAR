import StoreCard from '../store/StoreCard';
import RecommendationReason from './RecommendationReason';

// 추천 카드는 가게 이름 아래에 영업 상태를 표시합니다.
const RecommendationCard = ({ store, onClick }) => {

  return (
    <StoreCard
      store={store}
      recommendation
      extra={<RecommendationReason reason={store.reason} />}
      onClick={() => onClick(store.id)}
    />
  );
};

export default RecommendationCard;
