import { useEffect, useState } from 'react';
import BigButton from '../common/BigButton';
import { LoadingBox } from '../common/StateBox';
import { ensureCustomerSession } from '../../services/customerSession';

export default function CustomerSession({ onVerified }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    ensureCustomerSession().then((user) => {
      if (active) onVerified(user);
    }).catch((failure) => {
      if (active) setError(failure.response?.status === 403
        ? '고객으로 전환하려면 현재 계정에서 로그아웃해 주세요.'
        : '연결하지 못했어요. 다시 시도해 주세요.');
    });
    return () => { active = false; };
    // Retry controls the request; parent callback changes should not start another session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  if (!error) return <LoadingBox>이용 준비 중이에요.</LoadingBox>;
  return <section className="stack">
    <p role="alert">{error}</p>
    <BigButton onClick={() => setAttempt(value => value + 1)}>다시 시도</BigButton>
  </section>;
}
