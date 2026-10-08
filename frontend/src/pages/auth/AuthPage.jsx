import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AuthPage = ({ mode = 'login' }) => {
  const registering = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    try {
      if (!registering) {
        const user = await login({ email, password });
        const requestedPath = searchParams.get('next');
        const nextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : null;
        navigate(nextPath || (user.role === 'admin' ? '/admin' : user.role === 'owner' ? '/owner' : '/'), { replace: true });
        return;
      }
      const details = {
        email,
        password,
        displayName: String(form.get('displayName') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        address: String(form.get('address') || '').trim(),
        role,
      };
      if (role === 'owner') {
        details.business = {
          businessNumber: String(form.get('businessNumber') || '').trim(),
          legalName: String(form.get('legalName') || '').trim(),
          representativeName: String(form.get('representativeName') || '').trim(),
          address: String(form.get('businessAddress') || '').trim(),
        };
      }
      const user = await register(details);
      navigate(user.role === 'owner' ? '/owner' : '/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || '요청을 처리하지 못했습니다. 입력 내용을 확인해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="wordmark" to="/">월계 <span>CALAR</span></Link>
        <p className="eyebrow">우리 동네 가게와 이웃을 잇다</p>
        <h1>{registering ? '새 계정 만들기' : '다시 오셨네요'}</h1>
        <p className="lede">{registering ? '고객 또는 점주 계정으로 시작하세요.' : '이메일과 비밀번호로 로그인하세요.'}</p>
        <div className="auth-tabs"><Link className={!registering ? 'selected' : ''} to="/login">로그인</Link><Link className={registering ? 'selected' : ''} to="/register">회원가입</Link></div>
        {registering && <div className="role-switch" role="group" aria-label="가입 유형">
          <button type="button" className={role === 'customer' ? 'selected' : ''} onClick={() => setRole('customer')}>동네 고객</button>
          <button type="button" className={role === 'owner' ? 'selected' : ''} onClick={() => setRole('owner')}>가게 사장님</button>
        </div>}
        <form className="form-stack" onSubmit={handleSubmit}>
          {registering && <label>이름<input name="displayName" autoComplete="name" required maxLength="80" /></label>}
          <label>이메일<input name="email" type="email" autoComplete="email" required maxLength="254" /></label>
          <label>비밀번호<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength="10" maxLength="128" /></label>
          {registering && <>
            <label>연락처<input name="phone" type="tel" autoComplete="tel" /></label>
            <label>내 주소<input name="address" autoComplete="street-address" /></label>
          </>}
          {registering && role === 'owner' && <fieldset className="business-fields">
            <legend>사업자 신청</legend>
            <label>사업자등록번호<input name="businessNumber" placeholder="000-00-00000" required /></label>
            <label>상호명<input name="legalName" required maxLength="120" /></label>
            <label>대표자명<input name="representativeName" required maxLength="80" /></label>
            <label>사업장 주소<input name="businessAddress" autoComplete="street-address" required maxLength="240" /></label>
            <p className="form-note">번호 체크섬 확인 후 관리자 승인 대기 상태로 저장됩니다. 실제 사업자 진위 확인에는 별도 국세청 API 연동이 필요합니다.</p>
          </fieldset>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? '처리 중…' : registering ? '계정 만들기' : '로그인'} <span aria-hidden="true">→</span></button>
        </form>
      </section>
      <aside className="auth-aside"><span className="aside-orbit" aria-hidden="true">W</span><p className="eyebrow">WOLGYE · SEOUL</p><h2>동네의 오늘을<br />가볍게 잇다.</h2><p>가게를 발견하고 주문을 이어가며, 우리 동네의 새로운 얼굴을 만납니다.</p><div className="aside-rule"><strong>06</strong><span>LOCAL<br />COMMERCE</span></div></aside>
    </main>
  );
};

export default AuthPage;