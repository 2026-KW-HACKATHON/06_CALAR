import { useState } from 'react';
import { createOrder } from '../../services/orderService';

// store.menu를 받아서 수량 선택 후 주문을 생성합니다.
// totalPrice는 화면 표시용으로만 계산하고, 실제 요청에는 넣지 않습니다 (백엔드가 계산).
const OrderForm = ({ storeId, menu = [], onSuccess }) => {
  const [quantities, setQuantities] = useState({}); // { [menuId]: quantity }
  const [pickupTime, setPickupTime] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleQuantityChange = (menuId, quantity) => {
    setQuantities((prev) => ({ ...prev, [menuId]: Number(quantity) }));
  };

  const previewTotal = menu.reduce((sum, item) => {
    const qty = quantities[item.id] || 0;
    return sum + item.price * qty;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([menuId, quantity]) => ({ menuId: Number(menuId), quantity }));

    if (items.length === 0) {
      setError('메뉴를 1개 이상 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const order = await createOrder({ storeId, items, pickupTime, customerPhone });
      onSuccess(order);
    } catch (err) {
      setError(err.response?.data?.error || '주문에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {menu.map((item) => (
        <div key={item.id}>
          <span>{item.name} ({item.price.toLocaleString()}원)</span>
          <input
            type="number"
            min="0"
            value={quantities[item.id] || 0}
            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
          />
        </div>
      ))}

      <p>예상 금액: {previewTotal.toLocaleString()}원</p>

      <input
        type="datetime-local"
        value={pickupTime}
        onChange={(e) => setPickupTime(e.target.value)}
        required
      />
      <input
        type="tel"
        placeholder="연락처 (010-0000-0000)"
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
        required
      />

      {error && <p>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? '처리중...' : '주문하기'}
      </button>
    </form>
  );
};

export default OrderForm;
