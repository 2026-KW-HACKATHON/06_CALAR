import { formatPhoneNumber } from '../../utils/phoneFormatter';

// order에는 customerName이 없고 customerPhone만 있어서 전화번호로 표시합니다.
// order.items는 menuId만 가지고 있어서, 가게 상세의 menu 배열(storeMenu)에서 이름을 찾아 보여줍니다.
const ReservationRequestCard = ({ order, storeMenu = [], onAccept, onReject, onDone }) => {
  const getMenuName = (menuId) => storeMenu.find((m) => m.id === menuId)?.name || '메뉴 정보 없음';

  return (
    <div>
      <p>연락처: {formatPhoneNumber(order.customerPhone)}</p>
      <p>픽업/예약 시간: {order.pickupTime}</p>
      <ul>
        {order.items.map((item, idx) => (
          <li key={idx}>
            {getMenuName(item.menuId)} x {item.quantity}
          </li>
        ))}
      </ul>
      <p>총 금액: {order.totalPrice.toLocaleString()}원</p>
      <p>상태: {order.status}</p>

      {order.status === 'pending' && (
        <>
          <button onClick={() => onAccept(order.id)}>수락</button>
          <button onClick={() => onReject(order.id)}>거절</button>
        </>
      )}
      {order.status === 'accepted' && (
        <button onClick={() => onDone(order.id)}>완료 처리</button>
      )}
    </div>
  );
};

export default ReservationRequestCard;
