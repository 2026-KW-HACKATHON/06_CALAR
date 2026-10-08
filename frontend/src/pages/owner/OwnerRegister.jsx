import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import api from '../../services/api';
import { rememberRole } from '../../services/session';

const INITIAL = { email: '', password: '', confirm: '', displayName: '', businessNumber: '', legalName: '', representativeName: '', address: '' };
const ERRORS = {
  'Invalid email': '이메일 주소를 확인해 주세요.',
  'Invalid business registration number checksum': '올바른 사업자등록번호 10자리를 입력해 주세요.',
  'Email or business registration number is already registered': '이미 등록된 이메일 또는 사업자등록번호예요.',
};

export default function OwnerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locationConsent, setLocationConsent] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (form.password !== form.confirm) { setError('비밀번호 확인이 일치하지 않아요.'); return; }
    setBusy(true); setError('');
    try {
      await api.post('/api/auth/register', {
        email: form.email.trim(), password: form.password, displayName: form.displayName.trim(), role: 'owner',
        locationConsent,
        business: {
          businessNumber: form.businessNumber, legalName: form.legalName.trim(),
          representativeName: form.representativeName.trim(), address: form.address.trim(),
        },
      });
      rememberRole('owner');
      navigate('/verify-email', { replace: true, state: { email: form.email.trim() } });
    } catch (err) {
      setError(ERRORS[err.response?.data?.error] || '회원가입하지 못했어요. 입력 내용과 서버 연결을 확인해 주세요.');
    } finally { setBusy(false); }
  };
  const field = (name, label, props = {}) => (
    <label className="stack" key={name}>{label}
      <input required disabled={busy} value={form[name]} onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))} {...props} />
    </label>
  );
  return <div className="screen">
    <Header title="점주 회원가입" showRoleSwitch />
    <main className="screen__body"><form className="stack owner-login" onSubmit={submit}>
      <h2 className="lead">우리 가게와 함께 시작해요</h2>
      <p>계정과 사업자 정보를 입력해 주세요. 사업자 정보는 가입 후 승인 절차를 거쳐요.</p>
      <fieldset className="auth-fields stack"><legend>계정 정보</legend>
        {field('email', '이메일', { type: 'email', autoComplete: 'username', maxLength: 254 })}
        {field('displayName', '이름', { autoComplete: 'name', maxLength: 80 })}
        {field('password', '비밀번호 (10자 이상)', { type: 'password', autoComplete: 'new-password', minLength: 10, maxLength: 128 })}
        {field('confirm', '비밀번호 확인', { type: 'password', autoComplete: 'new-password', minLength: 10, maxLength: 128 })}
      </fieldset>
      <fieldset className="auth-fields stack"><legend>사업자 정보</legend>
        {field('businessNumber', '사업자등록번호', { inputMode: 'numeric', placeholder: '000-00-00000', pattern: '[0-9]{3}-?[0-9]{2}-?[0-9]{5}', maxLength: 12 })}
        {field('legalName', '사업자명 (상호)', { autoComplete: 'organization', maxLength: 120 })}
        {field('representativeName', '대표자 이름', { maxLength: 80 })}
        {field('address', '사업장 주소', { autoComplete: 'street-address', maxLength: 240 })}
      </fieldset>
      {error && <p className="owner-login__error" role="alert">{error}</p>}
      <label className="consent-choice"><input type="checkbox" checked={locationConsent} disabled={busy} onChange={(event) => setLocationConsent(event.target.checked)} /><span>위치정보 이용 동의 (선택)</span></label><p>주변 가게 탐색에 사용합니다. 동의하지 않아도 가입할 수 있으며, 기기 위치 권한은 별도로 요청합니다.</p>
      <BigButton type="submit" loading={busy} loadingLabel="가입 중…">회원가입</BigButton>
      <p className="auth-link">이미 계정이 있으신가요? <Link to="/owner/login">로그인</Link></p>
    </form></main>
  </div>;
}
