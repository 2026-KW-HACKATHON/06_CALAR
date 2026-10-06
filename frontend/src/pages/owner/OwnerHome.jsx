import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import ReservationRequestCard from '../../components/owner/ReservationRequestCard';
import { getOwnerOrderList, respondToOrder } from '../../services/orderService';
import { getStoreDetail } from '../../services/storeService';
import { OWNER_TOAST } from '../../constants/orderStatus';
import useFetch from '../../hooks/useFetch';

const FILTERS = [
  ['pending', '대기중만', 'schedule'],
  ['', '전체', 'list'],
];

const REFRESH_MS = 15000; // 새 요청이 들어왔는지 15초마다 조용히 확인
const TOAST_MS = 2200;

const OwnerHome = () => {
  const { storeId } = useParams();
  const id = Number(storeId);
  const [filter, setFilter] = useState('pending'); // 'pending' | '' (전체)
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // 요청 카드에서 메뉴 이름을 보여주려고 가게 상세(menu)도 함께 불러옵니다.
  const storeFetch = useFetch(() => getStoreDetail(id), [storeId]);
  const orders = useFetch(() => getOwnerOrderList(id, filter || undefined), [storeId, filter]);
  const { refresh } = orders;

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (value) => {
    setToast(value);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const handleStatusChange = async (orderId, status) => {
    try {
      await respondToOrder(orderId, status);
      showToast(OWNER_TOAST[status]);
    } catch (err) {
      showToast(OWNER_TOAST.error);
    }
    refresh(); // 처리 후 목록을 깜빡임 없이 다시 불러오기
  };

  const list = orders.data || [];
  const storeName = storeFetch.status === 'ready' ? storeFetch.data.name : null;
  const countLabel = `${filter === 'pending' ? '대기중 요청' : '전체 요청'} ${list.length}건`;

  return (
    <div className="screen screen--owner">
      <Header title={storeName ? `${storeName} - 들어온 요청` : '들어온 요청'} />

      <div className="owner-top">
        <div role="tablist" aria-label="요청 보기" className="tabs tabs--two">
          {FILTERS.map(([key, label, icon]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className="tab"
              onClick={() => setFilter(key)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </div>
        {orders.status === 'ready' && list.length > 0 && <div className="owner-count">{countLabel}</div>}
      </div>

      <main className="owner-list">
        {orders.status === 'loading' && (
          <>
            <LoadingBox>불러오는 중...</LoadingBox>
            <SkeletonCard lines={4} />
          </>
        )}

        {orders.status === 'error' && (
          <MessageBox
            tone="error"
            icon="wifi_off"
            title="요청 목록을 불러오지 못했어요"
            body="인터넷 연결을 확인한 뒤 다시 눌러주세요."
            actionLabel="다시 시도"
            actionIcon="refresh"
            onAction={orders.reload}
            actionLoading={orders.retrying}
          />
        )}

        {orders.status === 'ready' && list.length === 0 && (
          <MessageBox
            tone="empty"
            icon="inbox"
            title={filter === 'pending' ? '기다리는 요청이 없어요' : '아직 들어온 요청이 없어요'}
            body={
              filter === 'pending' ? (
                <>
                  새 요청이 들어오면 여기에 보여요.
                  <br />
                  지난 요청은 "전체"에서 볼 수 있어요.
                </>
              ) : (
                '새 요청이 들어오면 여기에 보여요.'
              )
            }
          />
        )}

        {orders.status === 'ready' &&
          list.map((order) => (
            <ReservationRequestCard
              key={order.id}
              order={order}
              storeMenu={storeFetch.data?.menu || []}
              onAccept={(orderId) => handleStatusChange(orderId, 'accepted')}
              onReject={(orderId) => handleStatusChange(orderId, 'rejected')}
              onDone={(orderId) => handleStatusChange(orderId, 'done')}
            />
          ))}
      </main>

      <Toast toast={toast} />
    </div>
  );
};

export default OwnerHome;
