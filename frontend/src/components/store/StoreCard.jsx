import Icon from '../common/Icon';
import OpenBadge from './OpenBadge';

// 가게 카드 (Home 목록 / 직접 검색 결과 / 오늘의 추천 공용)
// 카드 전체가 하나의 버튼이고, 오른쪽 "보기 >" 글자로 누를 수 있다는 걸 알려줍니다.
// props
//  - store        : 가게 데이터 (name, category, openStatus)
//  - distanceText : "120m" 같은 거리 글자 (없으면 생략)
//  - extra        : 카드 아래에 덧붙일 내용 (예: 추천 이유)
//  - onClick(store)
const StoreCard = ({ store, distanceText, extra, onClick }) => {
  const meta = [store.category, distanceText].filter(Boolean).join(' · ');

  return (
    <button type="button" className="store-card" onClick={() => onClick(store)}>
      <span className="store-card__main">
        <span className="store-card__top">
          <span className="store-card__name">{store.name}</span>
          <OpenBadge status={store.openStatus} />
        </span>
        {meta && <span className="store-card__meta">{meta}</span>}
        {store.ratingCount > 10 && <span className="store-card__meta">{`★ ${store.rating.toFixed(1)} (${store.ratingCount})`}</span>}
        {extra}
      </span>
      <span className="store-card__go">
        보기
        <Icon name="chevron_right" />
      </span>
    </button>
  );
};

export default StoreCard;
