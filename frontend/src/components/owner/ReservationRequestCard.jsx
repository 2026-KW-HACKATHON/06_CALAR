import { useState } from 'react';
import BigButton from '../common/BigButton';
import CallButton from '../common/CallButton';
import Icon from '../common/Icon';
import OrderStatusBadge from '../order/OrderStatusBadge';
import { formatPhoneNumber } from '../../utils/phoneFormatter';
import { formatPickup, formatCreated, formatWon } from '../../utils/formatDate';

// 점주용 주문/예약 요청 카드
// - order 에는 customerName 이 없고 customerPhone 만 있어서 전화번호로 표시합니다.
// - order.items 는 menuId 만 가지고 있어서, 가게 상세의 menu 배열(storeMenu)에서 이름을 찾아 보여줍니다.
// - 버튼: pending -> 수락/거절(거절은 한 번 더 확인), accepted -> 완료 처리
// props
//  - onAccept(orderId) / onReject(orderId) / onDone(orderId) : Promise 를 돌려주면 처리 중에 버튼이 잠깁니다.
const ReservationRequestCard = ({ order, storeMenu = [], onAccept, onReject, onDone }) => {
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [busy, setBusy] = useState(false);

  const getMenuName = (menuId) => storeMenu.find((m) => m.id === menuId)?.name || '메뉴 정보 없음';

  const run = async (handler) => {
    if (busy) return;
    setBusy(true);
    try {
      await handler(order.id);
    } finally {
      setBusy(false);
      setConfirmingReject(false);
    }
  };

  const isPending = order.status === 'pending';
  const isAccepted = order.status === 'accepted';
  const finished = !isPending && !isAccepted; // rejected, done

  const cardClass = ['request-card', isPending ? 'request-card--pending' : '', finished ? 'request-card--closed' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClass}>
      <div className="request-card__top">
        <OrderStatusBadge status={order.status} />
        <span className="request-card__created">{formatCreated(order.createdAt)} 신청</span>
      </div>

      <div>
        <span className="request-card__label">픽업/예약 시간</span>
        <span className="request-card__pickup">{formatPickup(order.pickupTime)}</span>
      </div>

      <div className="request-card__contact">
        <div>
          <span className="request-card__label">연락처</span>
          <span className="request-card__phone">{formatPhoneNumber(order.customerPhone)}</span>
        </div>
        <CallButton phoneNumber={order.customerPhone} label="전화" outline />
      </div>

      <ul className="request-card__items">
        {order.items.map((item, idx) => (
          <li key={`${item.menuId}-${idx}`}>
            <span>{getMenuName(item.menuId)}</span>
            <span>× {item.quantity}</span>
          </li>
        ))}
      </ul>

      <div className="request-card__total">
        <span className="request-card__total-label">총 금액</span>
        <span className="request-card__total-value">{formatWon(order.totalPrice)}</span>
      </div>

      {isPending && !confirmingReject && (
        <div className="request-card__actions">
          <BigButton icon="check" disabled={busy} onClick={() => run(onAccept)}>
            수락
          </BigButton>
          <BigButton variant="dangerOutline" icon="close" disabled={busy} onClick={() => setConfirmingReject(true)}>
            거절
          </BigButton>
        </div>
      )}

      {/* 거절은 되돌릴 수 없어서 한 번 더 확인 */}
      {isPending && confirmingReject && (
        <div role="alertdialog" aria-label="거절 확인" className="confirm-box">
          <span className="confirm-box__text">
            <Icon name="warning" />이 요청을 거절할까요? 되돌릴 수 없어요.
          </span>
          <div className="confirm-box__actions">
            <BigButton variant="plain" disabled={busy} onClick={() => setConfirmingReject(false)}>
              취소
            </BigButton>
            <BigButton variant="danger" icon="close" disabled={busy} onClick={() => run(onReject)}>
              거절하기
            </BigButton>
          </div>
        </div>
      )}

      {isAccepted && (
        <BigButton variant="info" icon="task_alt" disabled={busy} onClick={() => run(onDone)}>
          완료 처리
        </BigButton>
      )}
    </article>
  );
};

export default ReservationRequestCard;
