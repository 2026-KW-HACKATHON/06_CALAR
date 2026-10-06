import { formatWon } from '../../utils/formatDate';

// 백엔드 데이터에 별도 '대표상품' 필드가 없어서, menu 의 첫 번째 항목을 대표 메뉴로 사용합니다.
const FeaturedProduct = ({ store }) => {
  const featured = store?.menu?.[0];
  if (!featured) return null;

  return (
    <section className="stack">
      <h2 className="section-title">대표 메뉴</h2>
      <div className="featured">
        <span>{featured.name}</span>
        <span className="featured__price">{formatWon(featured.price)}</span>
      </div>
    </section>
  );
};

export default FeaturedProduct;
