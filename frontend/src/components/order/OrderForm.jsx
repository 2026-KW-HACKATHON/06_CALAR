import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BigButton from '../common/BigButton';
import Icon from '../common/Icon';
import { createOrder } from '../../services/orderService';
import { formatPhoneInput, isValidPhone } from '../../utils/phoneFormatter';
import { buildPickupOptions, pickupRange, toKoreanOrderError } from '../../utils/pickupTime';
import { formatWon } from '../../utils/formatDate';

const MAX_QTY = 99;

// 주문/예약 신청 폼
// - 수량: 빼기/더하기 큰 버튼
// - 픽업 시간: 시간 고르기 버튼 4개 (영업시간 밖은 비활성) + "다른 시간 직접 고르기"
// - 전화번호: 자동 하이픈
// - totalPrice 는 화면 표시용 예상 금액일 뿐, 요청에는 넣지 않습니다 (백엔드가 계산).
const OrderForm = ({ storeId, menu = [], openHours, onSuccess, initialPhone = '', initialCredit = 0 }) => {
  const [paymentMethod, setPaymentMethod] = useState('onsite');
  const paymentRequest = useRef(null);
  const [quantities, setQuantities] = useState({}); // { [menuId]: 수량 }
  const [options, setOptions] = useState(() => buildPickupOptions(openHours));
  const [pick, setPick] = useState(null); // 선택지 번호 | 'custom' | null
  const [customTime, setCustomTime] = useState('');
  const [phone, setPhone] = useState(() => formatPhoneInput(initialPhone));
  const [errors, setErrors] = useState({ time: false, phone: false, form: null });
  const [submitting, setSubmitting] = useState(false);

  const pickupValue = pick === 'custom' ? customTime : pick !== null ? options[pick]?.value || '' : '';

  const count = Object.values(quantities).reduce((a, b) => a + b, 0);
  const previewTotal = menu.reduce((sum, item) => sum + item.price * (quantities[item.id] || 0), 0);

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
    const phoneError = !isValidPhone(phone);
    const formError =
      items.length === 0
        ? '메뉴를 1개 이상 선택해주세요.'
        : timeError || phoneError
          ? '빨간 글씨로 표시된 칸을 채워주세요.'
          : null;

    if (formError) {
      setErrors({ time: timeError, phone: phoneError, form: formError });
      return;
    }

    setSubmitting(true);
    setErrors({ time: false, phone: false, form: null });

    try {
      const body = { storeId, items, pickupTime: pickupValue, customerPhone: phone, paymentMethod };
      const fingerprint = JSON.stringify(body);
      if (paymentRequest.current?.fingerprint !== fingerprint) paymentRequest.current = { fingerprint, id: crypto.randomUUID() };
      const order = await createOrder({ ...body, requestId: paymentRequest.current.id });
      onSuccess(order);
    } catch (err) {
      const serverMessage = err.response?.data?.error;
      const message = err.response
        ? toKoreanOrderError(serverMessage)
        : '인터넷 연결을 확인한 뒤 다시 시도해주세요.';

      // 시간 문제로 거절됐으면 선택지를 지금 시각 기준으로 다시 만들고 다시 고르게 함
      const timeProblem = /pickupTime/.test(String(serverMessage));
      if (timeProblem) {
        setOptions(buildPickupOptions(openHours));
        setPick(null);
        setCustomTime('');
      }
      setErrors({ time: timeProblem, phone: false, form: message });
    } finally {
      setSubmitting(false);
    }
  };

  const range = pickupRange();

  return (
    <form className="order-form" onSubmit={handleSubmit} noValidate>
      <div className="screen__body">
        {/* 1. 메뉴와 수량 */}
        <section className="stack">
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
        </section>

        {/* 2. 가지러 올 시간 */}
        <section className="stack">
          <h2 className="step-title">
            <span className="step-title__num">2</span>
            가지러 올 시간
          </h2>
          <div role="radiogroup" aria-label="가지러 올 시간" className="time-grid">
            {options.map((opt, i) => {
              const on = pick === i;
              return (
                <button
                  key={opt.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={opt.disabled}
                  className="time-btn"
                  onClick={() => {
                    setPick(i);
                    setErrors((prev) => ({ ...prev, time: false }));
                  }}
                >
                  <span className="time-btn__label">
                    {on && <Icon name="check_circle" />}
                    {opt.label}
                  </span>
                  <span className="time-btn__sub">{opt.sub}</span>
                  {opt.disabled && <span className="time-btn__sub">영업시간이 아니에요</span>}
                </button>
              );
            })}
          </div>

          {pick === 'custom' ? (
            <label className="field">
              <span className="field__hint">
                {openHours ? `영업시간 ${String(openHours).replace('-', ' ~ ')} 안에서 골라주세요` : '날짜와 시간을 골라주세요'}
              </span>
              <input
                type="datetime-local"
                className={`input${errors.time ? ' input--error' : ''}`}
                min={range.min}
                max={range.max}
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  setErrors((prev) => ({ ...prev, time: false }));
                }}
              />
            </label>
          ) : (
            <button type="button" className="link-btn" onClick={() => setPick('custom')}>
              <Icon name="edit_calendar" />
              다른 시간 직접 고르기
            </button>
          )}

          {errors.time && (
            <span role="alert" className="field__error">
              <Icon name="error" />
              가지러 올 시간을 골라주세요
            </span>
          )}
        </section>

        {/* 3. 전화번호 */}
        <section className="stack">
          <h2 className="step-title">
            <span className="step-title__num">3</span>
            내 전화번호
          </h2>
          <label className="field">
            <span className="field__hint">가게 사장님께 이 번호가 전달돼요</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-0000-0000"
              className={`input${errors.phone ? ' input--error' : ''}`}
              value={phone}
              onChange={(e) => {
                setPhone(formatPhoneInput(e.target.value));
                setErrors((prev) => ({ ...prev, phone: false }));
              }}
            />
          </label>
          {errors.phone && (
            <span role="alert" className="field__error">
              <Icon name="error" />
              전화번호를 끝까지 적어주세요 (예: 010-1234-5678)
            </span>
          )}
        </section>
      </div>

      {/* 화면 아래에 고정: 예상 금액 + 주문 버튼 */}
      <div className="sticky-bar">
        <fieldset className="auth-fields stack" disabled={submitting}>
          <legend>결제 방법</legend>
          <label><input type="radio" name="paymentMethod" checked={paymentMethod === 'onsite'} onChange={() => setPaymentMethod('onsite')} /> 가게에서 결제</label>
          <label><input type="radio" name="paymentMethod" checked={paymentMethod === 'credit'} onChange={() => setPaymentMethod('credit')} /> 크레딧 선결제 (잔액 {formatWon(initialCredit)})</label>
          <Link to="/customer/wallet">크레딧 충전·내역</Link>
          {paymentMethod === 'credit' && previewTotal > initialCredit && <p className="owner-login__error">크레딧이 부족해요. 충전하거나 가게에서 결제를 선택해 주세요.</p>}
        </fieldset>
        {errors.form && (
          <div role="alert" className="form-alert">
            <Icon name="error" />
            {errors.form}
          </div>
        )}
        <div className="total-row">
          <span className="total-row__label">
            예상 금액 <span className="total-row__count">({count}개)</span>
          </span>
          <span className="total-row__value">{formatWon(previewTotal)}</span>
        </div>
        <BigButton type="submit" size="md" icon="shopping_bag" loading={submitting} loadingLabel="처리중...">
          {paymentMethod === 'credit' ? '크레딧 결제하고 주문' : '주문하기'}
        </BigButton>
      </div>
    </form>
  );
};

export default OrderForm;
