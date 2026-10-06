// 백엔드 Order 데이터에 updatedAt 필드가 없어서 createdAt만 표시합니다.
const STATUS_LABEL = {
  pending: '확인 대기중',
  accepted: '수락됨',
  rejected: '거절됨',
  done: '완료',
};

const OrderStatus = ({ order }) => {
  if (!order) return null;

  return (
    <div>
      <p>상태: {STATUS_LABEL[order.status] || order.status}</p>
      <p>픽업/예약 시간: {order.pickupTime}</p>
      <p>신청일시: {order.createdAt}</p>
    </div>
  );
};

export default OrderStatus;
