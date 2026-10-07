import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BigButton from '../../components/common/BigButton';
import Header from '../../components/common/Header';
import api from '../../services/api';
import { saveToken, rememberRole } from '../../services/session';

export default function OwnerLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      if (data.user.role !== 'owner') {
        await api.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${data.token}` } });
        setError('점주 계정으로 로그인해 주세요.');
        return;
      }
      saveToken(data.token); rememberRole('owner');
      navigate('/owner', { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? '이메일 또는 비밀번호를 확인해 주세요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  };
  return <div className="screen">
    <Header title="점주 로그인" showRoleSwitch />
    <main className="screen__body"><form className="stack owner-login" onSubmit={submit}>
      <h2 className="lead">우리 가게를 관리해요</h2>
      <p>등록된 점주 계정으로 로그인해 주세요.</p>
      {state?.registered && <p role="status">회원가입이 완료됐어요. 로그인해 주세요. 사업자 정보는 승인 대기 중이에요.</p>}
      <label className="stack">이메일<input type="email" autoComplete="username" required maxLength={254}
        value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></label>
      <label className="stack">비밀번호<input type="password" autoComplete="current-password" required maxLength={128}
        value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
      {error && <p className="owner-login__error" role="alert">{error}</p>}
      <BigButton type="submit" loading={busy} loadingLabel="로그인 중…">로그인</BigButton>
      <p className="auth-link"><Link to="/reset-password">비밀번호 재설정</Link></p>
      <p className="auth-link"><Link to="/verify-email">이메일 인증</Link></p>
      <p className="auth-link">아직 계정이 없으신가요? <Link to="/owner/register">점주 회원가입</Link></p>
    </form></main>
  </div>;
}
