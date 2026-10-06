import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import OrderForm from '../../components/order/OrderForm';
import OrderStatus from '../../components/order/OrderStatus';
import { getStoreDetail } from '../../services/storeService';
import { getOrderStatus } from '../../services/orderService';
import { ROUTES } from '../../constants/routes';
import useFetch from '../../hooks/useFetch';

const POLL_MS = 10000; // 접수 후 가게가 수락/거절했는지 10초마다 확인

const Order = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const id = Number(storeId);

  const { status, data: store, retrying, reload } = useFetch(
    () =>
      Number.isInteger(id) && id > 0 ? getStoreDetail(id) : Promise.reject(new Error('잘못된 가게 번호')),
    [storeId]
  );

  const [submittedOrder, setSubmittedOrder] = useState(null);

  // "이 화면에서 상태를 볼 수 있어요" 문구가 사실이 되도록, 끝난 상태(거절/완료)가 되기 전까지 상태를 다시 확인
  const orderId = submittedOrder?.id;
  const orderStatus = submittedOrder?.status;
  useEffect(() => {
    if (!orderId || orderStatus === 'rejected' || orderStatus === 'done') return undefined;

    const timer = setInterval(async () => {
      try {
        setSubmittedOrder(await getOrderStatus(orderId));
      } catch (err) {
        // 이번 확인만 실패한 것이니 화면은 그대로 두고 다음 주기에 다시 확인
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [orderId, orderStatus]);

  return (
    <div className="screen">
      <Header title={status === 'ready' ? `${store.name} 주문/예약` : '주문/예약'} showBackButton />

      {status === 'loading' && (
        <main className="screen__body screen__body--tight">
          <LoadingBox>가게 정보를 불러오는 중…</LoadingBox>
          <SkeletonCard lines={3} />
        </main>
      )}

      {status === 'error' && (
        <main className="screen__body">
          <MessageBox
            tone="error"
            icon="storefront"
            title="가게 정보를 찾지 못했어요"
            body="잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            actionIcon="refresh"
            onAction={reload}
            actionLoading={retrying}
          />
        </main>
      )}

      {/* 주소창으로 직접 들어왔을 때, 주문을 안 받는 가게면 안내 */}
      {status === 'ready' && store.orderType === 'none' && (
        <main className="screen__body">
          <MessageBox
            tone="empty"
            icon="storefront"
            title="이 가게는 주문을 받지 않아요"
            body="전화로 문의해 주세요."
            actionLabel="가게 정보로 돌아가기"
            actionIcon="chevron_left"
            onAction={() => navigate(ROUTES.storeDetail(store.id))}
          />
        </main>
      )}

      {status === 'ready' && store.orderType !== 'none' && !submittedOrder && (
        <OrderForm
          storeId={store.id}
          menu={store.menu}
          openHours={store.openHours}
          onSuccess={setSubmittedOrder}
        />
      )}

      {status === 'ready' && store.orderType !== 'none' && submittedOrder && (
        <main className="screen__body screen__body--tight">
          <OrderStatus order={submittedOrder} store={store} />
          <BigButton variant="secondary" icon="home" onClick={() => navigate(ROUTES.home)}>
            처음 화면으로
          </BigButton>
        </main>
      )}
    </div>
  );
};

export default Order;
