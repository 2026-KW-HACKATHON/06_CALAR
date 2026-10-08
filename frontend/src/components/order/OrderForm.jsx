import { useState } from 'react';
import BigButton from '../common/BigButton';
import Icon from '../common/Icon';
import { createOrder } from '../../services/orderService';

import { toKoreanOrderError } from '../../utils/pickupTime';
import { formatWon } from '../../utils/formatDate';
import PickupTimePicker from './PickupTimePicker';

const MAX_QTY = 99;

// 주문/예약 신청 폼
// - 수량: 빼기/더하기 큰 버튼
// - 픽업 시간: 시간 고르기 버튼 4개 (영업시간 밖은 비활성) + "다른 시간 직접 고르기"
// - 전화번호: 자동 하이픈
// - totalPrice 는 화면 표시용 예상 금액일 뿐, 요청에는 넣지 않습니다 (백엔드가 계산).
const OrderForm = ({ storeId, menu = [], openHours, coupon, orderType, minOrderMinutes = 0, onSuccess }) => {
  const reservation = orderType === 'reservation';
  const [partySize, setPartySize] = useState(1);
  const [applyCoupon, setApplyCoupon] = useState(true);
  const [quantities, setQuantities] = useState({}); // { [menuId]: 수량 }
  const [pickerVersion, setPickerVersion] = useState(0);
  const [customTime, setCustomTime] = useState('');
  const [errors, setErrors] = useState({ time: false, phone: false, form: null });
  const [submitting, setSubmitting] = useState(false);

  const pickupValue = customTime;

  const count = Object.values(quantities).reduce((a, b) => a + b, 0);
  const subtotal = menu.reduce((sum, item) => sum + item.price * (quantities[item.id] || 0), 0);
  const eligibleSubtotal = coupon ? menu.filter(item => !coupon.targetMenuId || item.id === coupon.targetMenuId).reduce((sum, item) => sum + item.price * (quantities[item.id] || 0), 0) : 0;
  const discountAmount = !reservation && applyCoupon && coupon ? Math.floor(eligibleSubtotal * coupon.discountRate / 100) : 0;
  const previewTotal = subtotal - discountAmount;

  const changeQty = (menuId, delta) => {
    setQuantities((prev) => {
      const next = Math.min(MAX_QTY, Math.max(0, (prev[menuId] || 0) + delta));
      return { ...prev, [menuId]: next };
    });
    setErrors((prev) => ({ ...prev, form: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const items = menu
      .filter((item) => quantities[item.id] > 0)
      .map((item) => ({ menuId: item.id, quantity: quantities[item.id] }));

    const timeError = !pickupValue;
    const formError =
      !reservation && items.length === 0
        ? '메뉴를 1개 이상 선택해주세요.'
        : timeError
          ? '빨간 글씨로 표시된 칸을 채워주세요.'
          : null;

    if (formError) {
      setErrors({ time: timeError, phone: false, form: formError });
      return;
    }

    setSubmitting(true);
    setErrors({ time: false, phone: false, form: null });

    try {
      const body = { ...(reservation ? { kind: 'reservation', partySize } : {}), storeId, items: reservation ? [] : items, pickupTime: pickupValue, couponUuid: !reservation && applyCoupon && coupon && eligibleSubtotal > 0 ? coupon.uuid : null };
      const order = await createOrder(body);
      onSuccess(order);
    } catch (err) {
      const serverMessage = err.response?.data?.error;
      const message = err.response
        ? toKoreanOrderError(serverMessage)
        : '인터넷 연결을 확인한 뒤 다시 시도해주세요.';

      // 시간 문제로 거절됐으면 선택지를 지금 시각 기준으로 다시 만들고 다시 고르게 함
      const timeProblem = /pickupTime/.test(String(serverMessage));
      if (timeProblem) {
        setPickerVersion(version => version + 1);
        setCustomTime('');
      }
      setErrors({ time: timeProblem, phone: false, form: message });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <form className="order-form" onSubmit={handleSubmit} noValidate>
      <div className="screen__body">
        {/* 1. 메뉴와 수량 */}
        {reservation ? <section className="stack">
          <h2 className="step-title">1. 예약 인원</h2>
          <div className="qty-row">
            <button type="button" className="qty-btn" disabled={partySize <= 1} onClick={() => setPartySize(value => value - 1)}>빼기</button>
            <span className="qty-value" role="status">{partySize}명</span>
            <button type="button" className="qty-btn" disabled={partySize >= 99} onClick={() => setPartySize(value => value + 1)}>더하기</button>
          </div>
          <p>점주가 수락하면 예약이 확정돼요.</p>
        </section> : <section className="stack">
          <h2 className="step-title">
            <span className="step-title__num">1</span>
            메뉴와 수량 고르기
          </h2>
          {menu.map((item) => {
            const qty = quantities[item.id] || 0;
            return (
              <div key={item.id} className={`qty-card${qty > 0 ? ' qty-card--on' : ''}`}>
                <div className="qty-card__head">
                  <span className="qty-card__name">{item.name}</span>
                  <span className="qty-card__price">{formatWon(item.price)}</span>
                </div>
                <div className="qty-row">
                  <button
                    type="button"
                    className="qty-btn"
                    disabled={qty === 0}
                    aria-label={`${item.name} 하나 빼기`}
                    onClick={() => changeQty(item.id, -1)}
                  >
                    <Icon name="remove" />
                    빼기
                  </button>
                  <div role="status" className="qty-value">
                    {qty}개
                  </div>
                  <button
                    type="button"
                    className="qty-btn qty-btn--add"
                    aria-label={`${item.name} 하나 더하기`}
                    onClick={() => changeQty(item.id, 1)}
                  >
                    <Icon name="add" />
                    더하기
                  </button>
                </div>
              </div>
            );
          })}
        </section>}

        <section className="stack">
          <h2 className="step-title"><span className="step-title__num">2</span>{reservation ? '방문할 시간' : '가지러 올 시간'}</h2>
          <PickupTimePicker key={pickerVersion} openHours={openHours} minOrderMinutes={minOrderMinutes} value={customTime} disabled={submitting} error={errors.time} onChange={value => {
            setCustomTime(value);
            setErrors(previous => ({ ...previous, time: false }));
          }} />
          {errors.time && <p role="alert" className="field__error">방문할 날짜와 시간을 골라주세요.</p>}
        </section>

      </div>

      {/* 화면 아래에 고정: 예상 금액 + 주문 버튼 */}
      <div className="sticky-bar">
        {!reservation && coupon && <label><input type="checkbox" checked={applyCoupon} disabled={submitting || eligibleSubtotal === 0} onChange={event => setApplyCoupon(event.target.checked)} /> {coupon.title} ({coupon.discountRate}% 할인 · {coupon.targetMenuId ? coupon.targetMenuName || '지정 메뉴' : '모든 메뉴'}){eligibleSubtotal === 0 && coupon.targetMenuId ? ' · 대상 메뉴를 선택해 주세요' : ''}</label>}
        {discountAmount > 0 && <p>쿠폰 할인 −{formatWon(discountAmount)}</p>}

        {errors.form && (
          <div role="alert" className="form-alert">
            <Icon name="error" />
            {errors.form}
          </div>
        )}
        {!reservation && <div className="total-row">
          <span className="total-row__label">
            예상 금액 <span className="total-row__count">({count}개)</span>
          </span>
          <span className="total-row__value">{formatWon(previewTotal)}</span>
        </div>
        }
        <BigButton type="submit" size="md" icon="shopping_bag" loading={submitting} loadingLabel="처리중...">
          {reservation ? '예약 신청하기' : '주문하기'}
        </BigButton>
      </div>
    </form>
  );
};

export default OrderForm;
