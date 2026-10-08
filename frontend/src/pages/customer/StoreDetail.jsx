import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import Icon from '../../components/common/Icon';
import { LoadingBox, SkeletonCard, MessageBox } from '../../components/common/StateBox';
import StoreInfo from '../../components/store/StoreInfo';
import FeaturedProduct from '../../components/store/FeaturedProduct';
import MenuList from '../../components/store/MenuList';
import CouponCard from '../../components/store/CouponCard';
import { getStoreDetail } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';
import useFetch from '../../hooks/useFetch';
import { photoUrl } from '../../utils/photoUrl';
import FavoriteButton from '../../components/customer/FavoriteButton';

const StoreDetail = () => {
  const { storeId } = useParams(); // useParams 결과는 항상 문자열 -> 숫자로 바꿔서 사용
  const navigate = useNavigate();
  const id = Number(storeId);

  const { status, data: store, retrying, reload } = useFetch(
    () =>
      Number.isInteger(id) && id > 0 ? getStoreDetail(id) : Promise.reject(new Error('잘못된 가게 번호')),
    [storeId]
  );

  const canOrder = status === 'ready' && store.orderType !== 'none';

  return (
    <div className="screen">
      <Header title={status === 'ready' ? store.name : '가게 정보'} showBackButton />

      {status === 'loading' && (
        <main className="screen__body screen__body--tight">
          <LoadingBox>가게 정보를 불러오는 중…</LoadingBox>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </main>
      )}

      {status === 'error' && (
        <main className="screen__body">
          <MessageBox
            tone="error"
            icon="storefront"
            title="가게 정보를 찾지 못했어요"
            body={
              <>
                잠시 후 다시 시도해 주세요.
                <br />
                계속 안 되면 "뒤로"를 눌러주세요.
              </>
            }
            actionLabel="다시 시도"
            actionIcon="refresh"
            onAction={reload}
            actionLoading={retrying}
          />
        </main>
      )}

      {status === 'ready' && (
        <>
          {/* 혜택(쿠폰)이 먼저 보이도록 StoreInfo 바로 아래에 둡니다 */}
          <main className="screen__body">
            <StoreInfo store={store} />
            <FavoriteButton storeId={store.id} />
            {store.ownerPhoto && <section className="owner-introduction"><img src={photoUrl(store.ownerPhoto.url)} alt={`${store.name} 사장님`} /><div><h2 className="section-title">우리 가게 사장님</h2><p>반갑게 맞이할게요.</p></div></section>}
            {store.videos?.length > 0 && <section className="stack"><h2 className="section-title">매장 동영상</h2>
              {store.videos.map((video) => <video className="store-video" key={video.uuid} src={photoUrl(video.url)} controls autoPlay muted playsInline preload="metadata" aria-label={`${store.name} 매장 동영상`} />)}
            </section>}
            {store.photos?.length > 0 && <section className="stack"><h2 className="section-title">매장 둘러보기</h2>
              <div className="store-photo-gallery">{store.photos.map((photo, index) => <img key={photo.uuid} src={photoUrl(photo.url)} alt={`${store.name} 매장 사진 ${index + 1}`} loading="lazy" />)}</div>
            </section>}
            <CouponCard coupon={store.coupon} />
            <FeaturedProduct store={store} />
            <MenuList menu={store.menu} />
          </main>

          {/* 핵심 행동인 주문 버튼은 화면 아래에 고정 */}
          {canOrder && (
            <div className="sticky-bar">
              {store.openStatus === 'closed' && (
                <span className="sticky-bar__note">
                  <Icon name="info" />
                  지금은 영업종료 · 예약은 할 수 있어요
                </span>
              )}
              <BigButton
                size="md"
                icon={store.orderType === 'reservation' ? 'event_available' : 'shopping_bag'}
                onClick={() => navigate(ROUTES.order(store.id))}
              >
                {store.orderType === 'reservation' ? '예약하기' : '미리 주문하기'}
              </BigButton>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StoreDetail;
