// 라우트 경로 상수
// storeId가 필요한 경로는 함수로 만들어서 실제 id를 넣어 사용합니다.
// 예: navigate(ROUTES.storeDetail(store.id))

export const ROUTES = {
  home: '/',
  customerHome: '/customer',
  ownerSelect: '/owner',
  camera: '/camera',
  recommendation: '/recommendation',

  // path 정의 (react-router Route에 등록할 때 사용)
  storeDetailPath: '/store/:storeId',
  orderPath: '/store/:storeId/order',
  ownerHomePath: '/owner/:storeId',
  ownerOrderManagePath: '/owner/:storeId/order/:orderId',

  // 실제 이동할 때 쓰는 링크 생성 함수 (storeId를 채워서 반환)
  storeDetail: (storeId) => `/store/${storeId}`,
  order: (storeId) => `/store/${storeId}/order`,
  ownerHome: (storeId) => `/owner/${storeId}`,
  ownerOrderManage: (storeId, orderId) => `/owner/${storeId}/order/${orderId}`,
};
