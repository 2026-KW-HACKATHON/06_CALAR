import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import StoreCard from '../../components/store/StoreCard';
import { getStores } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';
import useGeolocation from '../../hooks/useGeolocation';
import useFetch from '../../hooks/useFetch';
import { getDistanceKm, formatDistance } from '../../utils/distance';

const Home = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const hasLocation = latitude != null && longitude != null;

  // 위치가 늦게 도착해서 다시 불러올 때도 이미 보이는 목록은 지우지 않습니다 (keepData)
  const { status, data, retrying, reload } = useFetch(
    () => getStores({ lat: latitude ?? undefined, lng: longitude ?? undefined }),
    [latitude, longitude],
    { keepData: true }
  );

  // 내 위치가 있으면 가까운 순으로 정렬하고 거리 글자를 붙입니다.
  const items = useMemo(() => {
    const list = (data || []).map((store) => ({
      store,
      km: hasLocation ? getDistanceKm({ latitude, longitude }, store.location) : null,
    }));
    if (hasLocation) list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    return list;
  }, [data, hasLocation, latitude, longitude]);

  return (
    <div className="screen">
      <Header title="월계" variant="brand" />

      <main className="screen__body">
        <div className="stack">
          <p className="lead">
            어떤 가게를
            <br />
            찾으세요?
          </p>

          <button type="button" className="hero-btn hero-btn--primary" onClick={() => navigate(ROUTES.camera)}>
            <span className="hero-btn__icon">
              <Icon name="photo_camera" />
            </span>
            <span className="hero-btn__text">
              <span className="hero-btn__title">간판 찍고 가게 찾기</span>
              <span className="hero-btn__desc">사진 한 장이면 가게 정보가 나와요</span>
            </span>
          </button>

          <button type="button" className="hero-btn hero-btn--secondary" onClick={() => navigate(ROUTES.recommendation)}>
            <span className="hero-btn__icon">
              <Icon name="storefront" />
            </span>
            <span className="hero-btn__text">
              <span className="hero-btn__title">오늘의 동네 추천 보기</span>
            </span>
          </button>
        </div>

        <section className="stack">
          <div className="section-head">
            <h2 className="section-title">주변 가게</h2>
            {status === 'ready' && hasLocation && items.length > 0 && (
              <span className="section-head__note">가까운 순</span>
            )}
          </div>

          {status === 'loading' && (
            <>
              <LoadingBox>주변 가게를 찾고 있어요…</LoadingBox>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {status === 'error' && (
            <MessageBox
              tone="error"
              icon="wifi_off"
              title="가게 목록을 불러오지 못했어요"
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

          {status === 'ready' && items.length === 0 && (
            <MessageBox
              tone="empty"
              icon="location_searching"
              title="근처에 등록된 가게가 없어요"
              body={
                <>
                  가게 이름을 알면
                  <br />
                  직접 찾아볼 수 있어요.
                </>
              }
              actionLabel="가게 이름으로 찾기"
              actionIcon="search"
              onAction={() => navigate(ROUTES.camera, { state: { tab: 'manual' } })}
            />
          )}

          {status === 'ready' && items.length > 0 && (
            <ul className="store-list">
              {items.map(({ store, km }) => (
                <li key={store.id}>
                  <StoreCard
                    store={store}
                    distanceText={km != null ? formatDistance(km) : undefined}
                    onClick={(s) => navigate(ROUTES.storeDetail(s.id))}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default Home;
