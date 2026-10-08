import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import { ROUTES } from '../../constants/routes';
import FirstVisitGuide from '../../components/customer/FirstVisitGuide';
import LocationConsent from '../../components/customer/LocationConsent';
import SlideRail from '../../components/customer/SlideRail';
import MileageGoal from '../../components/customer/MileageGoal';
import WalletHistory from '../../components/customer/WalletHistory';
import RecommendationCard from '../../components/recommendation/RecommendationCard';
import useFetch from '../../hooks/useFetch';
import useDiscoveryLocation from '../../hooks/useDiscoveryLocation';
import { getStores, getRecommendedStores } from '../../services/storeService';
import { recommendationPolicy } from '../../services/recommendationPolicy';
import { readPreference, savePreference } from '../../utils/discoveryPreferences';
import api from '../../services/api';
import { ensureCustomerSession } from '../../services/customerSession';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
const PROMOTIONS = [{ id: 'food', title: '메뉴와 쿠폰을 살펴보세요', image: 'food', path: '/customer/nearby' }, { id: 'store', title: '우리 동네 가게를 만나보세요', image: 'store', path: '/customer/nearby' }, { id: 'clothes', title: '세탁·수선도 가까운 곳에서', image: 'clothes', path: '/customer/nearby' }];

export default function Home() {
  const navigate = useNavigate();
  const location = useDiscoveryLocation();
  const [consentTick, setConsentTick] = useState(0);
  const [hidden, setHidden] = useState(() => readPreference('calar.hiddenRecommendations', {}));
  const recommendations = useFetch(() => getRecommendedStores({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);
  const couponStores = useFetch(getStores, []);
  const orders = useFetch(async () => { await ensureCustomerSession(); return (await api.get('/api/orders/mine')).data; }, [consentTick]);
  const stores = recommendationPolicy.select(recommendations.data || [], hidden);
  const dismiss = (id) => { const next = { ...hidden, [id]: Date.now() + 30 * 86400000 }; setHidden(next); savePreference('calar.hiddenRecommendations', next); };
  return <div className="screen">
    <Header title="월계" variant="brand" showRoleSwitch />
    <main className="screen__body">
        <SlideRail auto overlayControls showPlaybackControl={false} label="프로모션" items={PROMOTIONS} renderItem={(promo) => <button className="promotion-slide" type="button" onClick={() => navigate(promo.path)}><img src={`${import.meta.env.BASE_URL}examples/${promo.image}.png`} alt={promo.title} /><span>{promo.title}</span><small>서비스 안내 · 예시 이미지</small></button>} />
        <MileageGoal />
        <WalletHistory orders={orders} couponStores={couponStores} />
        <section className="stack" aria-labelledby="home-recommendation-title">
          <h2 className="section-title home-recommendation-title" id="home-recommendation-title"><Icon name="storefront" />{recommendationPolicy.label}</h2>
          {recommendations.status === 'loading' && <LoadingBox>가게를 불러오고 있어요.</LoadingBox>}
          {recommendations.status === 'error' && <MessageBox title="추천을 불러오지 못했어요" actionLabel="다시 시도" onAction={recommendations.reload} />}
          {recommendations.status === 'ready' && !stores.length && <MessageBox title="표시할 추천 가게가 없어요" actionLabel="가게 둘러보기" onAction={() => navigate(ROUTES.nearbyStores)} />}
          {stores.length > 0 && <SlideRail key={stores.map((store) => store.id).join(',')} label="추천 가게" items={stores} renderItem={(store) => <div className="stack"><RecommendationCard store={store} userLocation={location} onClick={(id) => navigate(`/store/${id}`)} /><button className="discovery-action" type="button" onClick={() => dismiss(store.id)} aria-label={`${store.name} 관심 없음`}>관심 없음</button></div>} />}
        </section>
        <LocationConsent onDone={() => setConsentTick((value) => value + 1)} />
        <FirstVisitGuide />

    </main>
  </div>;
}
