import { useEffect, useState } from 'react';
import { getLocationConsent, setLocationConsent } from '../../services/locationConsent';
import { getNotificationSettings, setNotificationSettings } from '../../services/notificationSettings';
import Icon from '../common/Icon';
import { getPersonalInformationSettings, setPersonalInformationSettings } from '../../services/personalInformationSettings';
export default function SettingsSwitches() {
  const [values, setValues] = useState(null); const [busy, setBusy] = useState(null); const [error, setError] = useState(''); const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([getLocationConsent(), getNotificationSettings(), getPersonalInformationSettings()]).then(([location, notification, personal]) => { if (alive) { setValues({ location: location.accepted === true, notification: notification.enabled, phone: personal.phone, contacts: personal.contacts }); setError(''); } }).catch(() => { if (alive) setError('설정을 불러오지 못했어요. 다시 시도해 주세요.'); });
    return () => { alive = false; };
  }, [tick]);
  const toggle = async (key) => {
    if (!values || busy) return;
    const next = !values[key];
    setBusy(key); setError('');
    try {
      if (key === 'location') await setLocationConsent(next);
      else if (key === 'notification') await setNotificationSettings(next);
      else await setPersonalInformationSettings(key, next);
      setValues((prev) => ({ ...prev, [key]: next }));
    } catch { setError('변경하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(null); }
  };
  return <section className="settings-switches stack"><h2 className="section-title">이용 설정</h2>
    {[['notification', '알림', 'notifications', '이용 중 주문·예약 상태가 바뀌면 알려드려요.'], ['location', '위치정보', 'location_on', '주변 가게 탐색에 사용해요. 위치는 DB에 저장하지 않아요.'], ['phone', '전화번호 정보', 'phone', '전화번호 정보 사용 동의를 설정해요.'], ['contacts', '주소록 정보', 'contacts', '주소록 정보 사용 동의를 설정해요.']].map(([key, title, icon, description]) => <div className="settings-switch-row" key={key}><Icon name={icon} /><div><h3>{title}</h3><p>{description}</p></div><button className="settings-toggle" type="button" role="switch" aria-label={`${title} 이용`} aria-checked={Boolean(values?.[key])} disabled={!values || Boolean(busy)} onClick={() => toggle(key)}><span className="settings-toggle__track"><span /></span><strong>{busy === key ? '저장 중' : values?.[key] ? '켜짐' : '꺼짐'}</strong></button></div>)}
    <p>위치정보를 켜면 이용에 동의한 것으로 저장됩니다. 실제 현재 위치 사용 시 기기 권한을 별도로 요청해요. 꺼도 지역 선택으로 이용할 수 있어요.</p>
    <p>전화번호·주소록은 기본적으로 꺼져 있어요. 현재는 동의 여부만 저장하며, 켜도 정보를 자동으로 수집하지 않아요.</p>
    {!values && !error && <p role="status">설정을 확인하고 있어요.</p>}
    {error && <><p role="alert">{error}</p><button className="discovery-action" type="button" onClick={() => setTick((n) => n + 1)}>다시 확인</button></>}
  </section>;
}
