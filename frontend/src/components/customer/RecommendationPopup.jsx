import { useEffect, useRef } from 'react';
import RecommendationCard from '../recommendation/RecommendationCard';
import SlideRail from './SlideRail';
import { LoadingBox, MessageBox } from '../common/StateBox';
export default function RecommendationPopup({ stores, status, location, onDismiss, onReload, onClose, onSelect, onBrowse }) {
  const dialog = useRef(null);
  useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
  return <dialog className="recommendation-popup" ref={dialog} onCancel={onClose} aria-labelledby="recommendation-popup-title"><h2 id="recommendation-popup-title">동네 가게를 만나보세요</h2>
    {status === 'loading' && <LoadingBox>가게를 불러오고 있어요.</LoadingBox>}
    {status === 'error' && <MessageBox title="추천을 불러오지 못했어요" actionLabel="다시 시도" onAction={onReload} />}
    {status === 'ready' && !stores.length && <MessageBox title="표시할 추천 가게가 없어요" actionLabel="가게 둘러보기" onAction={onBrowse} />}
    {stores.length > 0 && <SlideRail key={stores.map((store) => store.id).join(',')} label="추천 가게" items={stores} renderItem={(store) => <div className="stack"><RecommendationCard store={store} userLocation={location} onClick={(id) => onSelect(stores.find((item) => item.id === id))} /><button className="discovery-action" type="button" onClick={() => onDismiss(store.id)} aria-label={`${store.name} 관심 없음`}>관심 없음</button></div>} />}
    <button className="discovery-action" type="button" onClick={onClose}>닫기</button></dialog>;
}
