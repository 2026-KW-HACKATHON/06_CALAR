import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import OrderForm from '../../components/order/OrderForm';
import OrderStatus from '../../components/order/OrderStatus';
import { getStoreDetail } from '../../services/storeService';

const Order = () => {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  useEffect(() => {
    getStoreDetail(Number(storeId)).then(setStore);
  }, [storeId]);

  if (!store) return <p>불러오는 중...</p>;

  return (
    <div>
      <Header title={`${store.name} 주문/예약`} showBackButton />

      {submittedOrder ? (
        <>
          <p>신청이 접수됐어요!</p>
          <OrderStatus order={submittedOrder} />
        </>
      ) : (
        <OrderForm storeId={store.id} menu={store.menu} onSuccess={setSubmittedOrder} />
      )}
    </div>
  );
};

export default Order;
