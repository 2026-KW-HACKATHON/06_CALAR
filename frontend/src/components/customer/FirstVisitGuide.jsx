import { useState } from 'react';
import Icon from '../common/Icon';
import BigButton from '../common/BigButton';
import { readPreference, savePreference } from '../../utils/discoveryPreferences';
const STEPS = [['storefront', '가게 탭에서 찾기', '가까운 가게나 업종을 찾아요.'], ['photo_camera', '촬영으로 찾기', '간판을 찍고 맞는 가게를 골라요.'], ['local_offer', '메뉴·쿠폰 확인', '원하는 메뉴와 혜택을 살펴봐요.'], ['event_available', '주문·예약', '시간을 고르고 신청해요.']];
export default function FirstVisitGuide() {
  const [open, setOpen] = useState(() => !readPreference('calar.guideSeen', false));
  return open ? <section className="first-guide stack" aria-label="첫 이용 안내"><h2 className="section-title">이렇게 이용해요</h2><ol>{STEPS.map(([icon, title, body], index) => <li key={title}><span className="first-guide__picture"><Icon name={icon} /></span><div><strong>{index + 1}. {title}</strong><p>{body}</p></div></li>)}</ol><BigButton onClick={() => { savePreference('calar.guideSeen', true); setOpen(false); }}>알겠어요, 시작하기</BigButton></section>
    : <button className="discovery-action" type="button" onClick={() => setOpen(true)}>이용 방법 다시 보기</button>;
}
