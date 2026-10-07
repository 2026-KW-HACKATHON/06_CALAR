import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import RecommendationCard from '../../components/recommendation/RecommendationCard';
import { getRecommendedStores } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';
import useGeolocation from '../../hooks/useGeolocation';
import useFetch from '../../hooks/useFetch';

// 오늘의 동네 추천 화면: 디자인 시안이 아직 없어서 Home 의 가게 카드/상태 박스를 그대로 재사용했습니다.
const Recommendation = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const userLocation = latitude != null && longitude != null ? { latitude, longitude } : null;

  const { status, data, retrying, reload } = useFetch(
    () => getRecommendedStores({ lat: latitude ?? undefined, lng: longitude ?? undefined }),
    [latitude, longitude],
    { keepData: true }
  );
  const stores = data || [];

  return (
    <div className="screen">
      <Header title="오늘의 동네 추천" showBackButton />

      <main className="screen__body screen__body--tight">
        {status === 'loading' && (
          <>
            <LoadingBox>추천 가게를 찾고 있어요…</LoadingBox>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {status === 'error' && (
          <MessageBox
            tone="error"
            icon="wifi_off"
            title="추천 가게를 불러오지 못했어요"
            body={
              <>
                인터넷 연결을 확인한 뒤
                <br />
                아래 버튼을 눌러주세요.
              </>
            }
            actionLabel="다시 시도"
            actionIcon="refresh"
            onAction={reload}
            actionLoading={retrying}
          />
        )}

        {status === 'ready' && stores.length === 0 && (
          <MessageBox
            tone="empty"
            icon="storefront"
            title="오늘은 추천할 가게가 없어요"
            body="조금 뒤에 다시 확인해 주세요."
          />
        )}

        {status === 'ready' && stores.length > 0 && (
          <ul className="store-list">
            {stores.map((store) => (
              <li key={store.id}>
                <RecommendationCard
                  store={store}
                  userLocation={userLocation}
                  onClick={(id) => navigate(ROUTES.storeDetail(id))}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Recommendation;
