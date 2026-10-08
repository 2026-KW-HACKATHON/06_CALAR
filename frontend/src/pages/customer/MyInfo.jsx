import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import CustomerSession from '../../components/order/CustomerSession';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';
import { ensureCustomerSession } from '../../services/customerSession';
import { formatPhoneNumber } from '../../utils/phoneFormatter';
export default function MyInfo() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const profile = useFetch(async () => { await ensureCustomerSession(); return (await api.get('/api/auth/me')).data.user; }, [tick]);
  useEffect(() => {
    const expired = () => setTick((n) => n + 1);
    window.addEventListener('calar-session-expired', expired);
    return () => window.removeEventListener('calar-session-expired', expired);
  }, []);
  return <div className="screen"><Header title="내 정보" /><main className="screen__body"><div className="stack">
    {profile.status === 'loading' && <LoadingBox>내 정보를 확인하고 있어요.</LoadingBox>}
    {profile.status === 'error' && <MessageBox tone="error" title="내 정보를 불러오지 못했어요" body="잠시 후 다시 시도해 주세요." actionLabel="다시 시도" onAction={profile.reload} />}
    {profile.status === 'ready' && !profile.data && <><CustomerSession onVerified={() => setTick((n) => n + 1)} /></>}
    {profile.status === 'ready' && profile.data?.phone && <section className="card stack">
      <p>{formatPhoneNumber(profile.data.phone)}</p>
    </section>}
    <BigButton variant="secondary" icon="receipt_long" onClick={() => navigate('/customer/orders')}>내 주문 · 평점 남기기</BigButton>
  </div></main></div>;
}
