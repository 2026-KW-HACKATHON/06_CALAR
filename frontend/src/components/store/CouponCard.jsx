import Icon from '../common/Icon';

// store.coupon 이 null 이면 쿠폰이 없는 가게이므로 아무것도 표시하지 않습니다.
const CouponCard = ({ coupon }) => {
  if (!coupon) return null;

  return (
    <section aria-label="쿠폰" className="coupon">
      <div className="coupon__rate">
        <span className="coupon__rate-num">{coupon.discountRate}%</span>
        <span>할인</span>
      </div>
      <div className="coupon__body">
        <span className="coupon__tag">
          <Icon name="confirmation_number" />
          쿠폰
        </span>
        <span className="coupon__title">{coupon.title}</span>
      </div>
    </section>
  );
};

export default CouponCard;
