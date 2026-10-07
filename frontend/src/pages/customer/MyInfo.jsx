import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import PhoneVerification from '../../components/order/PhoneVerification';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';
import { getToken, clearToken } from '../../services/session';
import { formatPhoneNumber } from '../../utils/phoneFormatter';
export default function MyInfo() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const profile = useFetch(async () => getToken() ? (await api.get('/api/auth/me')).data.user : null, [tick]);
  useEffect(() => {
    const expired = () => setTick((n) => n + 1);
    window.addEventListener('calar-session-expired', expired);
    return () => window.removeEventListener('calar-session-expired', expired);
  }, []);
  const logout = async () => {
    setBusy(true);
    try { await api.post('/api/auth/logout'); }
    catch { /* Clear local session even if the server is unreachable. */ }
    finally { clearToken(); setBusy(false); setTick((n) => n + 1); }
  };
  return <div className="screen"><Header title="내 정보" /><main className="screen__body"><div className="stack">
    {profile.status === 'loading' && <LoadingBox>내 정보를 확인하고 있어요.</LoadingBox>}
    {profile.status === 'error' && <MessageBox tone="error" title="내 정보를 불러오지 못했어요" body="잠시 후 다시 시도해 주세요." actionLabel="다시 시도" onAction={profile.reload} />}
    {profile.status === 'ready' && !profile.data && <><p>전화번호 인증으로 로그인하고 주문 내역과 크레딧을 확인하세요.</p><PhoneVerification onVerified={() => setTick((n) => n + 1)} /></>}
    {profile.status === 'ready' && profile.data && <section className="card stack"><h2>{profile.data.displayName || '고객'}님</h2>
      {profile.data.phone && <p>{formatPhoneNumber(profile.data.phone)}</p>}
      <p>보유 크레딧 <strong>{(profile.data.credit ?? 0).toLocaleString('ko-KR')}</strong></p>
    </section>}
    <BigButton variant="secondary" icon="receipt_long" onClick={() => navigate('/customer/orders')}>내 주문 · 평점 남기기</BigButton>
    <BigButton variant="secondary" icon="account_balance_wallet" onClick={() => navigate('/customer/wallet')}>내 크레딧 · 충전</BigButton>
    <BigButton variant="secondary" onClick={() => navigate('/roles')}>이용 역할 변경</BigButton>
    {profile.status === 'ready' && profile.data && <BigButton variant="secondary" loading={busy} onClick={logout}>로그아웃</BigButton>}
  </div></main></div>;
}
