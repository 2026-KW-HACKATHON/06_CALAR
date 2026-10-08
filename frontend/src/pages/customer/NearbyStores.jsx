import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import StoreCard from '../../components/store/StoreCard';
import { getStores } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';
import useDiscoveryLocation from '../../hooks/useDiscoveryLocation';
import { REGIONS, nearbyStores } from '../../utils/discoveryPreferences';
import BigButton from '../../components/common/BigButton';
import useFetch from '../../hooks/useFetch';
import { getDistanceKm, formatDistance } from '../../utils/distance';

const NearbyStores = () => {
  const navigate = useNavigate();
  const location = useDiscoveryLocation();
  const { latitude, longitude, loading: locationLoading } = location;
  const [keyword, setKeyword] = useState('');
  const hasLocation = latitude != null && longitude != null;

  // 위치가 늦게 도착해서 다시 불러올 때도 이미 보이는 목록은 지우지 않습니다 (keepData)
  const { status, data, retrying, reload } = useFetch(
    () => getStores({ lat: latitude ?? undefined, lng: longitude ?? undefined }),
    [latitude, longitude],
    { keepData: true }
  );

  // 내 위치가 있으면 가까운 순으로 정렬하고 거리 글자를 붙입니다.
  const items = useMemo(() => {
    return nearbyStores(data || [], keyword, { latitude, longitude }, getDistanceKm);
  }, [data, hasLocation, latitude, longitude, keyword]);

  return (
    <div className="screen">
      <Header title="가게" />

      <main className="screen__body">
        <section className="stack">
          <p className="nearby-intro">우리 동네 가게를 둘러보세요.</p>
          <label className="field"><span>가게 이름·업종 검색</span><input className="input" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="예: 칼국수, 세탁소" /></label>
          <label className="field"><span>지역 선택·변경</span><select className="input" value={REGIONS.find((region) => region.name === location.label)?.id || ''} onChange={(event) => location.selectRegion(event.target.value)}><option value="">지역을 선택해 주세요</option>{REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
          <BigButton variant="secondary" icon="my_location" loading={locationLoading} onClick={location.request}>현재 위치 사용</BigButton>
          <p className="nearby-location-note" role="status">{hasLocation ? `${location.label} 주변 2km 가게를 가까운 순으로 보여드려요.` : '위치 사용에 동의하거나 기본 지역인 월계동을 선택해 주세요. 선택 전에는 전체 가게가 보여요.'}</p>
          {location.error && <p role="alert">위치를 확인하지 못했어요. 브라우저 위치 권한을 확인하거나 지역을 선택해 주세요.</p>}
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
              title={keyword ? '검색 조건에 맞는 가게가 없어요' : '근처에 등록된 가게가 없어요'}
              body={
                <>
                  가게 이름을 알면
                  <br />
                  직접 찾아볼 수 있어요.
                </>
              }
              actionLabel="검색 조건 지우기"
              actionIcon="search"
              onAction={() => setKeyword('')}
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

export default NearbyStores;
