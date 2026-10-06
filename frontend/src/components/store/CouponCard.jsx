// store.coupon이 null이면 쿠폰이 없는 가게이므로 아무것도 표시하지 않습니다.
const CouponCard = ({ coupon }) => {
  if (!coupon) return null;

  return (
    <div>
      <p>{coupon.title}</p>
      <p>{coupon.discountRate}% 할인</p>
    </div>
  );
};

export default CouponCard;
