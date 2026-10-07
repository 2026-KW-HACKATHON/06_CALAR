import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import api from '../services/api';
import { getToken, clearToken } from '../services/session';
import { LoadingBox, MessageBox } from './common/StateBox';

export default function OwnerGuard() {
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const expired = () => setStatus('login');
    window.addEventListener('calar-session-expired', expired);
    if (!getToken()) setStatus('login');
    else {
      setStatus('loading');
      api.get('/api/auth/me').then(({ data }) => {
        if (!active) return;
        if (data.user.role === 'owner') setStatus('ready');
        else { clearToken(); setStatus('login'); }
      }).catch((error) => {
        if (active) setStatus(error.response?.status === 401 ? 'login' : 'error');
      });
    }
    return () => { active = false; window.removeEventListener('calar-session-expired', expired); };
  }, [attempt]);
  if (status === 'login') return <Navigate to="/owner/login" replace />;
  if (status === 'ready') return <Outlet />;
  return <div className="screen"><main className="screen__body">
    {status === 'loading' ? <LoadingBox>로그인 상태를 확인하고 있어요…</LoadingBox> :
      <MessageBox tone="error" title="로그인 상태를 확인하지 못했어요" body="서버 연결을 확인한 뒤 다시 시도해 주세요."
        actionLabel="다시 시도" onAction={() => setAttempt((value) => value + 1)} />}
  </main></div>;
}
