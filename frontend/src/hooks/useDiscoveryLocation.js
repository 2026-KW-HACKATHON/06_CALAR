import { useEffect, useState } from 'react';
import useGeolocation from './useGeolocation';
import { REGIONS, readPreference, savePreference } from '../utils/discoveryPreferences';
import { getLocationConsent, setLocationConsent } from '../services/locationConsent';
let currentLocation = null;
export default function useDiscoveryLocation() {
  const [regionId, setRegionId] = useState(() => readPreference('calar.region', ''));
  const [current, setCurrent] = useState(() => currentLocation !== null);
  const [accepted, setAccepted] = useState(null);
  const [consentError, setConsentError] = useState(null);
  const geo = useGeolocation({ enabled: false });
  useEffect(() => {
    let alive = true;
    const changed = (event) => { if (!alive) return; setAccepted(event.detail.accepted); if (event.detail.accepted !== true) { currentLocation = null; setCurrent(false); geo.reset(); } };
    window.addEventListener('calar-location-consent', changed);
    getLocationConsent().catch(() => { if (alive) setConsentError('동의 정보를 확인하지 못했어요. 현재 위치 사용을 다시 눌러 주세요.'); });
    return () => { alive = false; window.removeEventListener('calar-location-consent', changed); };
  }, [geo.reset]);
  const region = REGIONS.find((item) => item.id === regionId);
  useEffect(() => { if (current && geo.latitude !== null && !geo.error) currentLocation = { latitude: geo.latitude, longitude: geo.longitude }; }, [current, geo.latitude, geo.longitude, geo.error]);
  const position = geo.latitude !== null ? geo : currentLocation;
  const located = accepted === true && current && position && !geo.error;
  return { latitude: located ? position.latitude : region?.latitude, longitude: located ? position.longitude : region?.longitude,
    label: located ? '현재 위치' : region?.name, loading: geo.loading, error: consentError || geo.error,
    selectRegion(id) { currentLocation = null; setCurrent(false); setRegionId(id); savePreference('calar.region', id); },
    async request() {
      let data;
      try { data = await getLocationConsent(); setConsentError(null); }
      catch { setConsentError('동의 정보를 확인하지 못했어요. 다시 시도해 주세요.'); return; }
      if (data.accepted !== true) {
        if (!window.confirm('주변 가게를 찾기 위해 위치정보를 이용할까요? 좌표는 DB에 저장하지 않습니다. 동의하지 않아도 지역 선택으로 이용할 수 있어요.')) return;
        try { await setLocationConsent(true); }
        catch { window.alert('동의 선택을 저장하지 못했어요. 다시 시도해 주세요.'); return; }
      }
      setCurrent(true); geo.request();
    },
  };
}
