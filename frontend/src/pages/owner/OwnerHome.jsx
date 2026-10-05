import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import ReservationRequestCard from '../../components/owner/ReservationRequestCard';
import { getOwnerOrderList, respondToOrder } from '../../services/orderService';
import { getStoreDetail } from '../../services/storeService';

const OwnerHome = () => {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending' | '' (전체)

  const loadOrders = () => {
    getOwnerOrderList(storeId, filter || undefined).then(setOrders);
  };

  useEffect(() => {
    getStoreDetail(Number(storeId)).then(setStore); // 메뉴 이름 조회용
  }, [storeId]);

  useEffect(() => {
    loadOrders();
  }, [storeId, filter]);

  const handleStatusChange = async (orderId, status) => {
    await respondToOrder(orderId, status);
    loadOrders(); // 처리 후 목록 다시 불러오기
  };

  return (
    <div>
      <Header title={store ? `${store.name} - 들어온 요청` : '들어온 요청'} />

      <div>
        <button onClick={() => setFilter('pending')}>대기중만</button>
        <button onClick={() => setFilter('')}>전체</button>
      </div>

      {orders.map((order) => (
        <ReservationRequestCard
          key={order.id}
          order={order}
          storeMenu={store?.menu || []}
          onAccept={(id) => handleStatusChange(id, 'accepted')}
          onReject={(id) => handleStatusChange(id, 'rejected')}
          onDone={(id) => handleStatusChange(id, 'done')}
        />
      ))}
    </div>
  );
};

export default OwnerHome;
