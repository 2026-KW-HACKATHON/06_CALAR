import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import ReservationRequestCard from '../../components/owner/ReservationRequestCard';
import { getOrderStatus, respondToOrder } from '../../services/orderService';
import { getStoreDetail } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';

const OwnerOrderManage = () => {
  const { storeId, orderId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    getStoreDetail(Number(storeId)).then(setStore);
    getOrderStatus(orderId).then(setOrder);
  }, [storeId, orderId]);

  const handleStatusChange = async (id, status) => {
    const updated = await respondToOrder(id, status);
    setOrder(updated);
  };

  if (!order) return <p>불러오는 중...</p>;

  return (
    <div>
      <Header title="요청 상세" showBackButton />

      <ReservationRequestCard
        order={order}
        storeMenu={store?.menu || []}
        onAccept={(id) => handleStatusChange(id, 'accepted')}
        onReject={(id) => handleStatusChange(id, 'rejected')}
        onDone={(id) => handleStatusChange(id, 'done')}
      />

      <button onClick={() => navigate(ROUTES.ownerHome(storeId))}>목록으로</button>
    </div>
  );
};

export default OwnerOrderManage;
