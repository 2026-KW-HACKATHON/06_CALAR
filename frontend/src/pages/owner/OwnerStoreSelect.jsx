import { useLocation, useNavigate } from 'react-router-dom';
import BigButton from '../../components/common/BigButton';
import Header from '../../components/common/Header';
import StoreCard from '../../components/store/StoreCard';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';
import { ROUTES } from '../../constants/routes';

const OwnerStoreSelect = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { status, data, reload, retrying } = useFetch(async () => (await api.get('/api/owner/stores')).data);

  return (
    <div className="screen screen--owner">
      <Header title="관리할 가게 선택" showRoleSwitch />
      <main className="screen__body">
        <div className="stack">
          <p className="lead">어떤 가게를 관리하시나요?</p>
          <p>가게를 선택하면 들어온 주문·예약을 확인할 수 있어요.</p>
          <BigButton icon="add_business" onClick={() => navigate('/owner/stores/new')}>가게 등록</BigButton>
          {state?.registeredStore && <p role="status">{state.registeredStore} 가게가 등록됐어요.</p>}
          {status === 'loading' && <LoadingBox>가게 목록을 불러오는 중이에요…</LoadingBox>}
          {status === 'error' && (
            <MessageBox tone="error" icon="wifi_off" title="가게 목록을 불러오지 못했어요"
              body="잠시 후 다시 시도해 주세요." actionLabel="다시 시도" actionIcon="refresh"
              onAction={reload} actionLoading={retrying} />
          )}
          {status === 'ready' && data.length === 0 && (
            <MessageBox tone="empty" icon="storefront" title="등록된 가게가 없어요" body="가게 등록 후 이용해 주세요." />
          )}
          {status === 'ready' && (
            <ul className="store-list">
              {data.map((store) => (
                <li key={store.id}>
                  <StoreCard store={store} onClick={(selected) => navigate(ROUTES.ownerHome(selected.id))} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

export default OwnerStoreSelect;
