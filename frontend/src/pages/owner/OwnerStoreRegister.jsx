import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';

export default function OwnerStoreRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', categoryId: '', address: '', phone: '', description: '', open: '09:00', close: '18:00', orderType: 'preorder' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const info = useFetch(async () => {
    const [categories, profile] = await Promise.all([api.get('/api/owner/categories'), api.get('/api/auth/me')]);
    return { categories: categories.data, business: profile.data.user.business };
  });
  const approved = info.data?.business?.status === 'verified';
  const change = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !approved) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/api/owner/stores', {
        name: form.name.trim(), categoryId: Number(form.categoryId), address: form.address.trim(),
        phone: form.phone.trim(), description: form.description.trim(),
        openHours: `${form.open}-${form.close}`, orderType: form.orderType,
      });
      navigate('/owner', { replace: true, state: { registeredStore: data.name } });
    } catch (err) {
      setError(err.response?.status === 403 ? '사업자 승인 후 가게를 등록할 수 있어요.' :
        err.response?.data?.error === 'Invalid store phone' ? '전화번호 형식을 확인해 주세요.' :
        '가게를 등록하지 못했어요. 입력 내용과 서버 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally { setBusy(false); }
  };
  const input = (name, label, props = {}) => <label className="stack">{label}
    <input name={name} value={form[name]} onChange={change} {...props} />
  </label>;

  return <div className="screen screen--owner">
    <Header title="가게 등록" />
    <main className="screen__body"><div className="stack">
      <Link className="store-register__back" to="/owner">← 관리할 가게 선택으로</Link>
      <h2 className="lead">우리 가게를 등록해요</h2>
      <p>가게 정보를 입력하면 내 가게 목록에 추가돼요.</p>
      {info.status === 'loading' && <LoadingBox>등록 정보를 확인하고 있어요…</LoadingBox>}
      {info.status === 'error' && <MessageBox tone="error" title="등록 정보를 불러오지 못했어요" body="잠시 후 다시 시도해 주세요."
        actionLabel="다시 시도" onAction={info.reload} actionLoading={info.retrying} />}
      {info.status === 'ready' && <>
        {!approved && <MessageBox tone="empty" icon="pending_actions" title="사업자 승인이 필요해요"
          body={info.data.business?.status === 'rejected' ? '사업자 정보가 반려됐어요. 사업자 정보를 확인하고 승인받은 후 등록해 주세요.' : '사업자 정보가 승인되면 가게를 등록할 수 있어요.'} />}
        <form className="stack owner-login" onSubmit={submit}>
          <fieldset className="auth-fields stack" disabled={busy || !approved}>
            <legend>가게 정보</legend>
            {input('name', '가게 이름', { required: true, maxLength: 120, autoComplete: 'organization' })}
            <label className="stack">업종
              <select name="categoryId" value={form.categoryId} onChange={change} required>
                <option value="">업종을 선택해 주세요</option>
                {info.data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {input('address', '가게 주소', { required: true, maxLength: 240, autoComplete: 'street-address' })}
            {input('phone', '전화번호 (선택)', { type: 'tel', autoComplete: 'tel', maxLength: 24, minLength: 7, pattern: '[0-9+()\\s-]{7,24}', placeholder: '02-123-4567' })}
            <label className="stack">가게 소개 (선택)
              <textarea name="description" value={form.description} onChange={change} rows={3} maxLength={500} />
            </label>
            {input('open', '영업 시작 시간', { type: 'time', required: true })}
            {input('close', '영업 종료 시간', { type: 'time', required: true })}
            <label className="stack">주문·예약 방식
              <select name="orderType" value={form.orderType} onChange={change}>
                <option value="preorder">미리 주문</option>
                <option value="reservation">예약</option>
                <option value="none">주문·예약 받지 않음</option>
              </select>
            </label>
          </fieldset>
          {error && <p role="alert" className="owner-login__error">{error}</p>}
          <BigButton type="submit" loading={busy} loadingLabel="등록 중…" disabled={!approved || info.data.categories.length === 0}>
            {approved ? '가게 등록하기' : '사업자 승인 후 등록 가능'}
          </BigButton>
        </form>
      </>}
    </div></main>
  </div>;
}
