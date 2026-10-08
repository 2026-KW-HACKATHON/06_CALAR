import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import api from '../../services/api';

export default function PaymentResult() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('결제 결과를 확인하고 있어요.');
  const started = useRef(false);
  const approve = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/api/payments/kakaopay/approve', { paymentId: params.get('paymentId'), pgToken: params.get('pg_token') });
      setMessage(`충전을 완료했어요. 현재 잔액은 ${data.credit.toLocaleString('ko-KR')} 크레딧이에요.`);
    } catch { setMessage('승인 결과를 확인하지 못했어요. 아래 버튼으로 다시 확인해 주세요. 중복 충전되지 않아요.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const cleaned = new URL(window.location.href); cleaned.searchParams.delete('pg_token');
    window.history.replaceState(window.history.state, '', cleaned);
    if (params.get('outcome') === 'success') approve();
    else setMessage(params.get('outcome') === 'cancel' ? '결제를 취소했어요.' : '결제를 완료하지 못했어요.');
  }, []);
  return <div className="screen"><Header title="충전 결과" /><main className="screen__body"><div className="stack">
    <p role="status">{message}</p>
    {params.get('outcome') === 'success' && <BigButton loading={busy} onClick={approve}>승인 결과 다시 확인</BigButton>}
    <Link to="/customer/wallet">내 크레딧으로 돌아가기</Link>
  </div></main></div>;
}
