import { useEffect, useState } from 'react';
import BigButton from '../common/BigButton';
import { getLocationConsent, setLocationConsent } from '../../services/locationConsent';
export default function LocationConsent({ onDone, manage = false }) {
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    getLocationConsent().then((data) => { if (alive) setConsent(data.accepted); }).catch(() => { if (alive) setError('동의 정보를 불러오지 못했어요. 다시 시도해 주세요.'); }).finally(() => { if (alive) setLoading(false); });
    const changed = (event) => { if (alive) setConsent(event.detail.accepted); };
    window.addEventListener('calar-location-consent', changed);
    return () => { alive = false; window.removeEventListener('calar-location-consent', changed); };
  }, [tick]);
  const decide = async (accepted) => {
    setBusy(true); setError('');
    try {
      const data = await setLocationConsent(accepted);
      setConsent(data.accepted); onDone?.();
    } catch { setError('동의 선택을 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  if (loading) return <p role="status">위치정보 동의를 확인하고 있어요.</p>;
  if (!manage && consent !== null && !error) return null;
  return <section className="first-guide stack"><h2>위치정보 이용 동의</h2><p>위치정보 이용은 선택이에요. 동의하면 현재 위치로 가까운 가게를 찾습니다. 좌표는 화면 이용 중에만 사용하며 DB에 저장하지 않습니다. 거절해도 지역을 직접 골라 이용할 수 있어요.</p><p role="status">현재 상태: {consent === true ? '동의함' : consent === false ? '동의하지 않음' : '아직 선택하지 않음'}</p>{error && <><p role="alert">{error}</p><BigButton variant="secondary" onClick={() => setTick((value) => value + 1)}>다시 확인</BigButton></>}<BigButton loading={busy} disabled={consent === true} onClick={() => decide(true)}>위치정보 이용에 동의</BigButton><BigButton variant="secondary" disabled={busy || consent === false} onClick={() => decide(false)}>{consent === true ? '동의 철회' : '동의하지 않고 이용'}</BigButton></section>;
}
