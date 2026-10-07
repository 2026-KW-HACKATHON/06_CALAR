import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import BigButton from '../components/common/BigButton';
import api from '../services/api';

export default function VerifyEmail() {
  const { state } = useLocation();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'));
  const [email, setEmail] = useState(state?.email || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [requestMode, setRequestMode] = useState(!token);
  useEffect(() => { if (token) window.history.replaceState(null, '', window.location.pathname); }, [token]);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (requestMode) {
        await api.post('/api/auth/request-email-verification', { email }); setSent(true);
      } else {
        await api.post('/api/auth/verify-email', { token }); setDone(true);
      }
    } catch (err) {
      setError(err.response?.status === 429 ? '요청이 너무 많아요. 15분 후 다시 시도해 주세요.' :
        err.response?.status === 503 ? '이메일 발송 서비스가 준비되지 않았어요. 잠시 후 다시 시도해 주세요.' :
        !requestMode && err.response?.status === 400 ? '만료되었거나 이미 사용된 링크예요. 이미 인증했다면 로그인하고, 아직 인증하지 않았다면 새 링크를 요청해 주세요.' :
        '요청하지 못했어요. 이메일 주소와 서버 연결을 확인해 주세요.');
    } finally { setBusy(false); }
  };
  return <div className="screen"><Header title="이메일 인증" showRoleSwitch />
    <main className="screen__body"><div className="stack owner-login">
      {done ? <><h2 className="lead" role="status">이메일 인증이 완료됐어요</h2><p>가입한 이메일을 확인했습니다. 로그인해서 이용해 주세요.</p></> :
        <form className="stack" onSubmit={submit}>
          <h2 className="lead">{requestMode ? '가입한 이메일을 인증해요' : '이메일 인증을 완료해요'}</h2>
          <p>{requestMode ? '가입한 이메일로 인증 링크를 보내드려요. 링크는 15분 동안 유효해요.' : '아래 버튼을 누르면 이메일 인증이 완료돼요.'}</p>
          {requestMode && <label className="stack">이메일<input type="email" required autoComplete="email" maxLength={254} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></label>}
          {sent && <p role="status">등록된 미인증 이메일이라면 메일이 발송돼요. 받은편지함과 스팸함을 확인해 주세요.</p>}
          {error && <p className="owner-login__error" role="alert">{error}</p>}
          <BigButton type="submit" loading={busy}>{requestMode ? '인증 메일 보내기' : '이메일 인증 완료하기'}</BigButton>
          {!requestMode && <BigButton variant="secondary" disabled={busy} onClick={() => { setRequestMode(true); setError(''); }}>새 인증 링크 요청</BigButton>}
        </form>}
      <Link className="auth-link" to="/owner/login">점주 로그인</Link>
      <Link className="auth-link" to="/reset-password">이메일로 비밀번호 복구</Link>
    </div></main>
  </div>;
}
