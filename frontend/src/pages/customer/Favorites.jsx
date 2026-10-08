import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import StoreCard from '../../components/store/StoreCard';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import { favoriteIds } from '../../components/customer/FavoriteButton';
import { getStores } from '../../services/storeService';
import useFetch from '../../hooks/useFetch';
export default function Favorites() {
  const navigate = useNavigate(); const info = useFetch(getStores, []);
  const stores = (info.data || []).filter((store) => favoriteIds().includes(store.id));
  return <div className="screen"><Header title="내가 찜한 가게" showBackButton /><main className="screen__body">
    {info.status === 'loading' && <LoadingBox>찜한 가게를 불러오고 있어요.</LoadingBox>}
    {info.status === 'error' && <MessageBox title="가게를 불러오지 못했어요" actionLabel="다시 시도" onAction={info.reload} />}
    {info.status === 'ready' && !stores.length && <MessageBox title="아직 찜한 가게가 없어요" body="가게 상세에서 하트를 눌러 모아보세요." actionLabel="가게 둘러보기" onAction={() => navigate('/customer/nearby')} />}
    <ul className="store-list">{stores.map((store) => <li key={store.id}><StoreCard store={store} onClick={() => navigate(`/store/${store.id}`)} /></li>)}</ul>
  </main></div>;
}
