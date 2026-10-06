import Icon from '../common/Icon';
import CallButton from '../common/CallButton';
import OrderStatusBadge from './OrderStatusBadge';
import { ORDER_STATUS_MESSAGE } from '../../constants/orderStatus';
import { formatPickup, formatCreated, formatWon } from '../../utils/formatDate';

// 접수 후 주문 상태 화면 (대기중 / 수락됨 / 거절됨 / 완료 에 따라 뱃지·문구가 바뀝니다)
// 백엔드 Order 에는 updatedAt 이 없어서 createdAt(신청일시)만 표시합니다.
// props
//  - order : 주문 데이터
//  - store : 가게 데이터 (메뉴 이름 조회 + 전화 걸기용)
const OrderStatus = ({ order, store }) => {
  if (!order) return null;

  const info = ORDER_STATUS_MESSAGE[order.status] || ORDER_STATUS_MESSAGE.pending;
  const pickup = formatPickup(order.pickupTime);
  const hint = info.hint.replace('{pickup}', pickup);

  const menuName = (menuId) => store?.menu?.find((m) => m.id === menuId)?.name || '메뉴 정보 없음';
  const itemsLabel = order.items.map((it) => `${menuName(it.menuId)} ${it.quantity}개`).join(', ');

  const iconClass =
    order.status === 'rejected' ? ' order-done__icon--rejected' : order.status === 'done' ? ' order-done__icon--done' : '';

  return (
    <div className="order-done">
      {/* 상태가 바뀌면 스크린리더가 읽어주도록 aria-live */}
      <div className="order-done__head" aria-live="polite">
        <span className={`order-done__icon${iconClass}`}>
          <Icon name={info.headIcon} fill />
        </span>
        <p className="order-done__title">{info.headTitle}</p>
        <OrderStatusBadge status={order.status} large />
        <p className="order-done__msg">
          {info.message && <strong>{info.message}</strong>}
          {hint}
        </p>
      </div>

      <dl className="receipt">
        <div className="receipt__row receipt__row--strong">
          <dt>픽업/예약 시간</dt>
          <dd>{pickup}</dd>
        </div>
        <div className="receipt__row">
          <dt>신청 메뉴</dt>
          <dd>{itemsLabel}</dd>
        </div>
        <div className="receipt__row receipt__row--strong">
          <dt>예상 금액</dt>
          <dd>{formatWon(order.totalPrice)}</dd>
        </div>
        <div className="receipt__row">
          <dt>신청일시</dt>
          <dd>{formatCreated(order.createdAt, { withDate: true })}</dd>
        </div>
      </dl>

      <CallButton phoneNumber={store?.phone} />
    </div>
  );
};

export default OrderStatus;
