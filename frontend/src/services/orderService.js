import api from './api';
import { ensureCustomerSession } from './customerSession';

// 주문/예약 생성 (고객)
// totalPrice는 안 보냄 - 백엔드가 메뉴 가격 기준으로 계산
export const createOrder = async ({ storeId, items, pickupTime, kind, partySize, couponUuid, customerPhone, paymentMethod, requestId }) => {
  await ensureCustomerSession();
  const res = await api.post('/api/orders', {
    storeId: Number(storeId),
    items,
    pickupTime,
    kind,
    partySize,
    couponUuid,
    customerPhone,
    paymentMethod,
    requestId,
  });
  return res.data;
};

// 주문 상태 조회 (고객)
export const getOrderStatus = async (orderId) => {
  const res = await api.get(`/api/orders/${orderId}`);
  return res.data;
};

// 가게로 들어온 주문 목록 조회 (점주)
// status 생략하면 전체 조회, 넘기면 그 상태만 필터링
export const getOwnerOrderList = async (storeId, status) => {
  const res = await api.get(`/api/owner/stores/${storeId}/orders`, {
    params: status ? { status } : {},
  });
  return res.data;
};

// 주문 상태 변경 (점주) - 'accepted' | 'rejected' | 'done'
export const respondToOrder = async (orderId, status) => {
  const res = await api.patch(`/api/owner/orders/${orderId}/status`, { status });
  return res.data;
};
