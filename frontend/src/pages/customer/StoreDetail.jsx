import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import StoreInfo from '../../components/store/StoreInfo';
import FeaturedProduct from '../../components/store/FeaturedProduct';
import MenuList from '../../components/store/MenuList';
import CouponCard from '../../components/store/CouponCard';
import { getStoreDetail } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';

const StoreDetail = () => {
  const { storeId } = useParams(); // useParams 결과는 항상 문자열
  const navigate = useNavigate();
  const [store, setStore] = useState(null);

  useEffect(() => {
    getStoreDetail(Number(storeId)).then(setStore);
  }, [storeId]);

  if (!store) return <p>불러오는 중...</p>;

  return (
    <div>
      <Header title={store.name} showBackButton />

      <StoreInfo store={store} />
      <FeaturedProduct store={store} />
      <MenuList menu={store.menu} />
      <CouponCard coupon={store.coupon} />

      {store.orderType !== 'none' && (
        <BigButton
          label={store.orderType === 'reservation' ? '예약하기' : '미리 주문하기'}
          onClick={() => navigate(ROUTES.order(store.id))}
        />
      )}
    </div>
  );
};

export default StoreDetail;
