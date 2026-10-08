import CallButton from '../common/CallButton';
import Icon from '../common/Icon';
import OpenBadge from './OpenBadge';
import { formatPhoneNumber } from '../../utils/phoneFormatter';

// 가게 기본 정보 카드. openStatus 는 백엔드가 계산해서 내려주므로 그대로 표시만 합니다.
// 전화번호는 크게 보여주고, 아래 초록 "전화 걸기" 버튼으로 바로 걸 수 있게 했습니다.
const StoreInfo = ({ store }) => {
  if (!store) return null;

  return (
    <section className="card store-info">
      <div className="store-info__head">
        <div className="store-info__top">
          <span className="store-info__category">{store.category}</span>
          <OpenBadge status={store.openStatus} large />
        </div>
        <h2 className="store-info__name">{store.name}</h2>
        {store.isVirtual && <span className="virtual-store-badge">가상·예시 점포</span>}
        {store.ratingCount > 10 && <p>{`★ ${store.rating.toFixed(1)} / 5 · ${store.ratingCount}개의 평점`}</p>}
        {store.description && <p className="store-info__desc">{store.description}</p>}
      </div>

      <dl className="info-list">
        <div className="info-row">
          <dt>
            <Icon name="location_on" />
            주소
          </dt>
          <dd>{store.address}</dd>
        </div>
        <div className="info-row">
          <dt>
            <Icon name="schedule" />
            영업시간
          </dt>
          <dd>{store.openHours}</dd>
        </div>
        <div className="info-row info-row--phone">
          <dt>
            <Icon name="call" />
            전화
          </dt>
          <dd>{formatPhoneNumber(store.phone)}</dd>
        </div>
      </dl>

      <CallButton phoneNumber={store.phone} />
    </section>
  );
};

export default StoreInfo;
