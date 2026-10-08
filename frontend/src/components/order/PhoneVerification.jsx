import { useEffect, useRef, useState } from 'react';
import BigButton from '../common/BigButton';
import api from '../../services/api';
import { rememberRole, saveToken } from '../../services/session';
import { formatPhoneInput } from '../../utils/phoneFormatter';

export default function PhoneVerification({ onVerified }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [mockCode, setMockCode] = useState('');
  const smsListener = useRef(null);
  const [autofilled, setAutofilled] = useState(false);
  const stopAutofill = () => { smsListener.current?.stop().catch(() => {}); smsListener.current = null; };
  useEffect(() => () => stopAutofill(), []);
  useEffect(() => {
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const message = (err) => err.response?.status === 429 ? '잠시 기다린 뒤 다시 요청해 주세요.' :
    err.response?.status === 403 ? '이 전화번호의 계정을 이용할 수 없어요. 관리자에게 문의해 주세요.' :
    err.response?.status === 503 ? '문자 발송을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.' :
    '전화번호 또는 인증번호를 확인해 주세요. 만료됐다면 새 번호를 요청해 주세요.';
  const send = async () => {
    if (busy) return;
    setBusy(true); setError('');
    stopAutofill(); setAutofilled(false); setCode('');
    try {
      let appHash;
      if (window.calarMobile?.startSmsAutofill) {
        try {
          smsListener.current = await window.calarMobile.startSmsAutofill((value) => { setCode(value); setAutofilled(true); });
          appHash = smsListener.current.appHash;
        } catch { /* Manual entry remains available on unsupported devices. */ }
      }
      const { data } = await api.post('/api/auth/phone/send-code', { phone, appHash, client: window.calarMobile?.platform });
      setRequestId(data.requestId); setRemaining(60);
      setMockCode(data.mock ? data.mockCode : '');
    } catch (err) { stopAutofill(); setError(message(err)); }
    finally { setBusy(false); }
  };
  const verify = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/api/auth/phone/check-code', { requestId, code });
      stopAutofill(); saveToken(data.token); rememberRole('customer'); onVerified(data.user);
    } catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  };
  return <section className="stack owner-login menu-editor">
    <h2 className="lead">전화번호 인증 후 주문해요</h2>
    <p>문자 인증을 완료하면 고객으로 자동 로그인돼요. 처음 이용하면 고객 계정이 만들어져요.</p>
    <label className="stack">휴대폰 번호
      <input type="tel" autoComplete="tel-national" inputMode="tel" placeholder="010-0000-0000" value={phone}
        disabled={busy || !!requestId} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} />
    </label>
    <BigButton disabled={busy || remaining > 0 || !/^010\d{8}$/.test(phone.replace(/-/g, ''))} onClick={send}>
      {remaining > 0 ? `${remaining}초 후 재발송 가능` : requestId ? '인증번호 다시 받기' : '문자 인증번호 받기'}
    </BigButton>
    {requestId && <form className="stack" onSubmit={verify}>
      {autofilled && <p role="status">인증번호가 자동 입력됐어요. 인증 버튼을 눌러 완료하세요.</p>}
      <p role="status">{mockCode ? `개발용 MOCK 인증번호: ${mockCode} (문자는 발송되지 않아요)` : '인증번호를 보냈어요. 10분 안에 입력해 주세요.'}</p>
      <label className="stack">인증번호
        <input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}
          disabled={busy} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
      </label>
      <BigButton type="submit" loading={busy} disabled={code.length !== 6}>인증하고 주문 계속하기</BigButton>
      <BigButton variant="secondary" disabled={busy} onClick={() => { stopAutofill(); setAutofilled(false); setRequestId(null); setCode(''); setError(''); }}>다른 전화번호 사용</BigButton>
    </form>}
    {error && <p role="alert" className="owner-login__error">{error}</p>}
  </section>;
}
