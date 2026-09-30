// 주문 샘플 데이터 (메모리 저장 — 서버를 재시작하면 새로 만든 주문은 사라지고 이 상태로 돌아온다)
const orders = [
  {
    id: 1,
    storeId: 1,
    items: [{ menuId: 101, quantity: 2 }],
    totalPrice: 16000,
    pickupTime: '2026-10-08T12:30',
    customerPhone: '010-0000-0001',
    status: 'pending',
    createdAt: '2026-10-08T11:50',
  },
  {
    id: 2,
    storeId: 1,
    items: [
      { menuId: 101, quantity: 1 },
      { menuId: 102, quantity: 1 },
    ],
    totalPrice: 14000,
    pickupTime: '2026-10-08T13:00',
    customerPhone: '010-0000-0002',
    status: 'accepted',
    createdAt: '2026-10-08T11:55',
  },
  {
    id: 3,
    storeId: 4,
    items: [{ menuId: 401, quantity: 1 }],
    totalPrice: 10000,
    pickupTime: '2026-10-09T09:00',
    customerPhone: '010-0000-0003',
    status: 'pending',
    createdAt: '2026-10-08T20:10',
  },
];

module.exports = orders;
