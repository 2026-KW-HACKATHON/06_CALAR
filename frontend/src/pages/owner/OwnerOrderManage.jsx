import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import Toast from '../../components/common/Toast';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import ReservationRequestCard from '../../components/owner/ReservationRequestCard';
import { getOrderStatus, respondToOrder } from '../../services/orderService';
import { getStoreDetail } from '../../services/storeService';
import { OWNER_TOAST } from '../../constants/orderStatus';
import { ROUTES } from '../../constants/routes';
import useFetch from '../../hooks/useFetch';

const TOAST_MS = 2200;

const OwnerOrderManage = () => {
  const { storeId, orderId } = useParams();
  const navigate = useNavigate();

  const orderFetch = useFetch(() => getOrderStatus(orderId), [orderId]);
  const storeFetch = useFetch(() => getStoreDetail(Number(storeId)), [storeId]);

  const [updatedOrder, setUpdatedOrder] = useState(null); // 처리 후 서버가 돌려준 최신 주문
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (value) => {
    setToast(value);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const handleStatusChange = async (id, status) => {
    try {
      setUpdatedOrder(await respondToOrder(id, status));
      showToast(OWNER_TOAST[status]);
    } catch (err) {
      showToast(OWNER_TOAST.error);
    }
  };

  const order = updatedOrder || orderFetch.data;

  return (
    <div className="screen screen--owner">
      <Header title="요청 상세" showBackButton />

      <main className="owner-list" style={{ paddingTop: 'var(--space-4)' }}>
        {orderFetch.status === 'loading' && (
          <>
            <LoadingBox>불러오는 중...</LoadingBox>
            <SkeletonCard lines={4} />
          </>
        )}

        {orderFetch.status === 'error' && (
          <MessageBox
            tone="error"
            icon="wifi_off"
            title="요청을 불러오지 못했어요"
            body="인터넷 연결을 확인한 뒤 다시 눌러주세요."
            actionLabel="다시 시도"
            actionIcon="refresh"
            onAction={orderFetch.reload}
            actionLoading={orderFetch.retrying}
          />
        )}

        {orderFetch.status === 'ready' && order && (
          <>
            <ReservationRequestCard
              order={order}
              storeMenu={storeFetch.data?.menu || []}
              onAccept={(id) => handleStatusChange(id, 'accepted')}
              onReject={(id) => handleStatusChange(id, 'rejected')}
              onDone={(id) => handleStatusChange(id, 'done')}
            />
            <BigButton variant="secondary" icon="list" onClick={() => navigate(ROUTES.ownerHome(storeId))}>
              목록으로
            </BigButton>
          </>
        )}
      </main>

      <Toast toast={toast} />
    </div>
  );
};

export default OwnerOrderManage;
