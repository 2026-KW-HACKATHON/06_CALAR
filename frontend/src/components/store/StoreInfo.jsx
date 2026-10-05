import CallButton from '../common/CallButton';
import { formatPhoneNumber } from '../../utils/phoneFormatter';

// store.openStatus는 백엔드가 이미 계산해서 내려주므로 그대로 표시만 합니다.
const StoreInfo = ({ store }) => {
  if (!store) return null;

  return (
    <div>
      <h1>{store.name}</h1>
      <p>{store.category}</p>
      <p>{store.description}</p>
      <p>{store.address}</p>
      <p>{store.openHours}</p>
      <p>{store.openStatus === 'open' ? '영업중' : '영업종료'}</p>
      <p>{formatPhoneNumber(store.phone)}</p>
      <CallButton phoneNumber={store.phone} />
    </div>
  );
};

export default StoreInfo;
