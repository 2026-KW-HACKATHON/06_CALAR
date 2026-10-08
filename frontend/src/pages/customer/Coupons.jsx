import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import CouponCard from '../../components/store/CouponCard';
import { getStores } from '../../services/storeService';
import useFetch from '../../hooks/useFetch';
export default function Coupons() {
  const navigate = useNavigate(); const info = useFetch(getStores, []); const stores = (info.data || []).filter((store) => store.coupon);
  return <div className="screen"><Header title="내 쿠폰" showBackButton /><main className="screen__body"><p>현재 가게에서 제공하는 쿠폰이에요. 적용 가능한 할인은 주문 화면에서 확인할 수 있어요.</p>{info.status === 'loading' && <LoadingBox>쿠폰을 불러오고 있어요.</LoadingBox>}{info.status === 'error' && <MessageBox title="쿠폰을 불러오지 못했어요" actionLabel="다시 시도" onAction={info.reload} />}{info.status === 'ready' && !stores.length && <MessageBox title="현재 사용 가능한 쿠폰이 없어요" />}{stores.map((store) => <section className="stack" key={store.id}><h2>{store.name}</h2><CouponCard coupon={store.coupon} /><button className="discovery-action" onClick={() => navigate(`/store/${store.id}`)}>가게 보기</button></section>)}</main></div>;
}
