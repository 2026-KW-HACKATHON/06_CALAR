import { useRef, useState } from 'react';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import CustomerSession from '../../components/order/CustomerSession';
import api from '../../services/api';
import { getToken } from '../../services/session';
import useFetch from '../../hooks/useFetch';

export default function Wallet() {
  const [loginTick, setLoginTick] = useState(0);
  const [amount, setAmount] = useState('10000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const paymentRequestId = useRef(crypto.randomUUID());
  const pay = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/api/payments/kakaopay/ready', { amount: Number(amount), requestId: paymentRequestId.current, client: window.calarMobile ? 'mobile' : 'web' });
      if (data.status !== 'ready') throw new Error('Payment already processed');
      if (window.calarMobile) { await window.calarMobile.openPayment(data.redirectMobile); setBusy(false); }
      else window.location.assign(/Android|iPhone|iPad/i.test(navigator.userAgent) ? data.redirectMobile : data.redirectPc);
    } catch { setError('결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'); setBusy(false); }
  };
  const wallet = useFetch(async () => getToken() ? (await api.get('/api/auth/wallet')).data : null, [loginTick]);
  const topup = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/auth/wallet/dev-topup', { amount: Number(amount), requestId: requestId.current });
      requestId.current = crypto.randomUUID();
      setNotice('개발용 크레딧이 충전됐어요. 실제 돈은 결제되지 않았습니다.'); wallet.refresh();
    } catch (err) { setError(err.response?.status === 403 ? '개발용 충전이 비활성화되어 있어요.' : '충전하지 못했어요. 금액과 연결 상태를 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  return <div className="screen"><Header title="내 크레딧" showBackButton showRoleSwitch />
    <main className="screen__body"><div className="stack">
      {wallet.status === 'loading' && <LoadingBox>잔액을 확인하고 있어요…</LoadingBox>}
      {wallet.status === 'error' && (getToken() ? <MessageBox tone="error" title="크레딧을 불러오지 못했어요" body="다시 시도해 주세요." actionLabel="다시 시도" onAction={wallet.reload} /> : <CustomerSession onVerified={() => setLoginTick((n) => n + 1)} />)}
      {wallet.status === 'ready' && !wallet.data && <CustomerSession onVerified={() => setLoginTick((n) => n + 1)} />}
      {wallet.status === 'ready' && wallet.data && <>
        <h2 className="lead">{wallet.data.credit.toLocaleString('ko-KR')} 크레딧</h2>
        {wallet.data.kakaoPay?.enabled && <form className="stack owner-login menu-editor" onSubmit={pay}>
          <h3>카카오페이 충전{wallet.data.kakaoPay.mode === 'test' ? ' (테스트)' : ''}</h3>
          <p>{wallet.data.kakaoPay.mode === 'test' ? '테스트 결제이며 실제 돈이 결제되지 않아요.' : '결제를 완료하면 같은 금액의 크레딧이 충전돼요.'}</p>
          <label className="stack">충전 금액 (원)<input type="number" required min="1000" max="1000000" step="1" value={amount} disabled={busy} onChange={(event) => { setAmount(event.target.value); paymentRequestId.current = crypto.randomUUID(); requestId.current = crypto.randomUUID(); }} /></label>
          <BigButton type="submit" loading={busy}>카카오페이로 결제하기</BigButton>
        </form>}
        <p>1크레딧 = 1원 · 주문 시 선결제에 사용할 수 있어요. 주문이 거절되면 자동으로 돌려드려요.</p>
        {wallet.data.devTopupEnabled ? <form className="stack owner-login menu-editor" onSubmit={topup}>
          <h3>개발용 충전</h3><p>시연용 잔액입니다. 실제 결제가 발생하지 않아요.</p>
          <label className="stack">충전할 금액 (원)<input type="number" required min="1000" max="1000000" step="1" value={amount} disabled={busy} onChange={(event) => { setAmount(event.target.value); requestId.current = crypto.randomUUID(); }} /></label>
          <BigButton type="submit" loading={busy}>개발용 크레딧 충전</BigButton>
        </form> : <p>현재 충전 서비스를 준비하고 있어요.</p>}
        {error && <p role="alert" className="owner-login__error">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <h3>최근 충전·사용 내역</h3>
        {!wallet.data.transactions.length && <p>아직 내역이 없어요.</p>}
        <ul className="stack">{wallet.data.transactions.map((entry) => <li className="menu-manage-card" key={entry.uuid}>
          <div className="menu-manage-card__heading"><strong>{{ topup: '충전', payment: '주문 결제', refund: '주문 환불' }[entry.kind]}</strong><span>{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('ko-KR')}</span></div>
          <p>잔액 {entry.balanceAfter.toLocaleString('ko-KR')} · {new Date(`${entry.createdAt.replace(' ', 'T')}Z`).toLocaleString('ko-KR')}</p>
        </li>)}</ul>
      </>}
    </div></main>
  </div>;
}
