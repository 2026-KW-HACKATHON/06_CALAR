import Header from '../../components/common/Header';
import { LoadingBox } from '../../components/common/StateBox';
import OrderRating from '../../components/order/OrderRating';
import PhoneVerification from '../../components/order/PhoneVerification';
import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';
import { getToken } from '../../services/session';

export default function MyOrders() {
  const [tick, setTick] = useState(0);
  const orders = useFetch(async () => getToken() ? (await api.get('/api/orders/mine')).data : null, [tick]);
  return <div className="screen"><Header title="내 주문 · 평점" showBackButton /><main className="screen__body"><div className="stack">
    {orders.status === 'loading' && <LoadingBox>주문 내역을 불러오고 있어요.</LoadingBox>}
    {orders.status === 'error' && <><p role="alert">주문 내역을 불러오지 못했어요.</p><button onClick={orders.reload}>다시 시도</button></>}
    {orders.status === 'ready' && !orders.data && <PhoneVerification onVerified={() => setTick((n) => n + 1)} />}
    {orders.status === 'ready' && orders.data?.length === 0 && <p>아직 주문 내역이 없어요.</p>}
    {orders.status === 'ready' && orders.data?.map((order) => <section className="card stack" key={order.id}>
      <h2>{order.storeName}</h2><p>주문 #{order.id} · {order.totalPrice.toLocaleString('ko-KR')}원</p>
      <p>{{ pending: '접수 대기', accepted: '수락됨', rejected: '거절됨', done: '완료' }[order.status]}</p>
      {order.status === 'done' && <OrderRating orderId={order.id} initialRating={order.rating} onRated={orders.refresh} />}
    </section>)}
  </div></main></div>;
}
