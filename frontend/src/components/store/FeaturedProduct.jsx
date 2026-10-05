// 백엔드 데이터에 별도 '대표상품' 필드가 없어서, menu의 첫 번째 항목을 대표상품으로 사용합니다.
const FeaturedProduct = ({ store }) => {
  const featured = store?.menu?.[0];
  if (!featured) return null;

  return (
    <div>
      <h2>대표 메뉴</h2>
      <p>{featured.name}</p>
      <p>{featured.price.toLocaleString()}원</p>
    </div>
  );
};

export default FeaturedProduct;
