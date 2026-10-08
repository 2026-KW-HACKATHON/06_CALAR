import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { LoadingBox, MessageBox } from '../common/StateBox';

const STATUS = { pending: '접수 대기', accepted: '수락됨', rejected: '거절됨', done: '완료' };
export default function WalletHistory({ orders, couponStores }) {
  const [open, setOpen] = useState(null);
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);
  const coupons = (couponStores.data || []).filter((store) => store.coupon);
  const start = (event, tab) => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, tab };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const end = (event) => {
    const from = gesture.current; gesture.current = null;
    if (!from) return;
    const dy = event.clientY - from.y;
    if (Math.abs(dy) < 40 || Math.abs(dy) <= Math.abs(event.clientX - from.x)) return;
    setOpen(dy > 0 ? from.tab : null);
    suppressClickUntil.current = Date.now() + 500;
  };
  const toggle = (tab) => {
    if (Date.now() < suppressClickUntil.current) return;
    setOpen((current) => current === tab ? null : tab);
  };
  return <section className="wallet-history" aria-label="최근 주문과 내 쿠폰">
    <div className="wallet-history__row">{[['orders', '최근 주문', 'receipt_long'], ['coupons', '내 쿠폰', 'local_offer']].map(([tab, title, icon]) => <button
      className={`wallet-history__card wallet-history__card--${tab}${open === tab ? ' is-open' : ''}`} key={tab} type="button"
      aria-expanded={open === tab} aria-controls={`wallet-history-${tab}`} onClick={() => toggle(tab)}
      onPointerDown={(event) => start(event, tab)} onPointerUp={end} onPointerCancel={() => { gesture.current = null; }}>
      <Icon name={icon} /><span className="wallet-history__title"><strong>{title}</strong><span className="wallet-history__count" aria-label={tab === 'orders' ? '주문 개수' : '쿠폰 개수'}>{(tab === 'orders' ? orders : couponStores).status === 'ready' ? (tab === 'orders' ? orders.data?.length || 0 : coupons.length) : '—'}</span></span>
      <span className="wallet-history__handle"><Icon name={open === tab ? 'expand_less' : 'expand_more'} />{open === tab ? '접기' : '보기'}</span>
    </button>)}</div>
    <div id="wallet-history-orders" className="wallet-history__panel" hidden={open !== 'orders'} role="region" aria-label="최근 주문 내역">
      <div className="section-head"><h3>최근 주문 내역</h3><button className="discovery-action" type="button" onClick={() => setOpen(null)}>닫기</button></div>
      {orders.status === 'loading' && <LoadingBox>주문 내역을 불러오고 있어요.</LoadingBox>}
      {orders.status === 'error' && <MessageBox title="주문을 불러오지 못했어요" actionLabel="다시 시도" onAction={orders.reload} />}
      {orders.status === 'ready' && !orders.data?.length && <p>아직 주문 내역이 없어요.</p>}
      <ul className="wallet-history__list">{orders.data?.slice(0, 5).map((order) => <li key={order.id}><strong>{order.storeName}</strong><span>{STATUS[order.status] || order.status} · {order.partySize ? `${order.partySize}명 예약` : `${order.totalPrice.toLocaleString('ko-KR')}원`}</span><span>{order.pickupTime?.replace('T', ' ')}</span></li>)}</ul>
      <Link className="discovery-action" to="/customer/orders">전체 주문 보기</Link>
    </div>
    <div id="wallet-history-coupons" className="wallet-history__panel" hidden={open !== 'coupons'} role="region" aria-label="내 쿠폰 내역">
      <div className="section-head"><h3>내 쿠폰 내역</h3><button className="discovery-action" type="button" onClick={() => setOpen(null)}>닫기</button></div>
      {couponStores.status === 'loading' && <LoadingBox>쿠폰을 불러오고 있어요.</LoadingBox>}
      {couponStores.status === 'error' && <MessageBox title="쿠폰을 불러오지 못했어요" actionLabel="다시 시도" onAction={couponStores.reload} />}
      {couponStores.status === 'ready' && !coupons.length && <p>현재 사용 가능한 쿠폰이 없어요.</p>}
      <ul className="wallet-history__list">{coupons.slice(0, 5).map((store) => <li key={store.id}><Link to={`/store/${store.id}`}><strong>{store.name}</strong><span>{store.coupon.title}</span><span>{store.coupon.discountRate > 0 ? `${store.coupon.discountRate}% 할인` : '가게에서 혜택 확인'}</span></Link></li>)}</ul>
      <Link className="discovery-action" to="/customer/coupons">전체 쿠폰 보기</Link>
    </div>
  </section>;
}
