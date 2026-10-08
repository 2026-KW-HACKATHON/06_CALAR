import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import BigButton from '../components/common/BigButton';
import api from '../services/api';
import { clearToken } from '../services/session';

export default function ResetPassword() {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    return value;
  });
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);
  const [mode, setMode] = useState(token ? 'recover' : 'email');
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ email: '', currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (mode !== 'email' && form.newPassword !== form.confirm) { setError('새 비밀번호 확인이 일치하지 않아요.'); return; }
    if (mode === 'current' && form.newPassword === form.currentPassword) { setError('기존 비밀번호와 다른 비밀번호를 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      if (mode === 'email') {
        await api.post('/api/auth/forgot-password', { email: form.email });
        setSent(true); return;
      }
      if (mode === 'recover') await api.post('/api/auth/recover-password', { token, newPassword: form.newPassword });
      else await api.post('/api/auth/reset-password', { email: form.email, currentPassword: form.currentPassword, newPassword: form.newPassword });
      clearToken(); setForm({ email: '', currentPassword: '', newPassword: '', confirm: '' }); setDone(true);
    } catch (err) {
      setError(err.response?.status === 503 ? '이메일 발송 서비스가 아직 준비되지 않았어요. 현재 비밀번호로 변경하거나 관리자에게 문의해 주세요.' :
        err.response?.status === 429 ? '요청이 너무 많아요. 15분 후 다시 시도해 주세요.' :
        mode === 'recover' && err.response?.status === 400 ? '링크가 만료되었거나 이미 사용됐어요. 새 복구 메일을 요청해 주세요.' :
        err.response?.status === 401 ? '이메일 또는 현재 비밀번호를 확인해 주세요.' : '요청하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  };
  const input = (name, label, props) => <label className="stack">{label}
    <input required disabled={busy} value={form[name]} maxLength={128}
      onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))} {...props} />
  </label>;
  return <div className="screen">
    <Header title="비밀번호 재설정" showRoleSwitch />
    <main className="screen__body"><div className="stack owner-login">
      {done ? <>
        <h2 className="lead" role="status">비밀번호가 변경됐어요</h2>
        <p>기존 로그인은 종료됐어요. 새 비밀번호로 다시 로그인해 주세요.</p>
        <Link className="auth-link" to="/owner/login">점주 로그인</Link>
        <Link className="auth-link" to="/admin">관리자 로그인</Link>
      </> : <form className="stack" onSubmit={submit}>
        <h2 className="lead">{mode === 'email' ? '이메일로 계정을 복구해요' : '새 비밀번호를 설정해요'}</h2>
        <p>{mode === 'email' ? '가입한 이메일로 15분 동안 사용할 수 있는 복구 링크를 보내드려요.' : mode === 'recover' ? '메일로 본인 확인을 완료했어요. 새 비밀번호를 입력해 주세요.' : '본인 확인을 위해 현재 비밀번호가 필요해요.'}</p>
        {mode !== 'recover' && input('email', '이메일', { type: 'email', autoComplete: 'username', maxLength: 254 })}
        {mode === 'current' && input('currentPassword', '현재 비밀번호', { type: 'password', autoComplete: 'current-password' })}
        {mode !== 'email' && <>
          {input('newPassword', '새 비밀번호 (10자 이상)', { type: 'password', autoComplete: 'new-password', minLength: 10 })}
          {input('confirm', '새 비밀번호 확인', { type: 'password', autoComplete: 'new-password', minLength: 10 })}
        </>}
        {sent && mode === 'email' && <p role="status">등록된 이메일이라면 복구 메일이 발송돼요. 받은편지함과 스팸함을 확인해 주세요.</p>}
        {error && <p className="owner-login__error" role="alert">{error}</p>}
        <BigButton type="submit" loading={busy} loadingLabel="처리 중…">{mode === 'email' ? '복구 메일 보내기' : '비밀번호 변경'}</BigButton>
        <BigButton variant="secondary" disabled={busy} onClick={() => { setMode(mode === 'email' ? 'current' : 'email'); setError(''); setSent(false); }}>
          {mode === 'email' ? '현재 비밀번호로 변경' : '이메일로 복구하기'}
        </BigButton>
        <Link className="auth-link" to="/owner/login">로그인으로 돌아가기</Link>
      </form>}
    </div></main>
  </div>;
}
