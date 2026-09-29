// 월계1동 가게 샘플 데이터 (가상의 가게, 테스트용)
const stores = [
  {
    id: 1,
    name: '월계 손칼국수',
    category: '음식점',
    description: '직접 뽑은 면으로 끓이는 동네 칼국수집',
    menu: [
      { name: '바지락 칼국수', price: 8000 },
      { name: '왕만두', price: 6000 },
    ],
    coupon: { title: '만두 1판 10% 할인', discountRate: 10 },
    visits: 120,
  },
  {
    id: 2,
    name: '새마을 세탁소',
    category: '세탁소',
    description: '30년 경력 사장님의 수선·드라이클리닝',
    menu: [
      { name: '와이셔츠 세탁', price: 3000 },
      { name: '정장 드라이', price: 9000 },
      { name: '바지 기장 수선', price: 7000 },
    ],
    coupon: null,
    visits: 15,
  },
  {
    id: 3,
    name: '햇살 미용실',
    category: '미용실',
    description: '어르신 커트와 염색을 전문으로 하는 미용실',
    menu: [
      { name: '커트', price: 12000 },
      { name: '뿌리 염색', price: 30000 },
    ],
    coupon: { title: '첫 방문 커트 2,000원 할인', discountRate: null },
    visits: 40,
  },
  {
    id: 4,
    name: '월계 반찬가게',
    category: '반찬',
    description: '매일 아침 만드는 집반찬, 미리 주문 가능',
    menu: [
      { name: '반찬 3종 세트', price: 10000 },
      { name: '김치 1kg', price: 12000 },
    ],
    coupon: null,
    visits: 8,
  },
];

module.exports = stores;
