import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';
import { ROUTES } from '../../constants/routes';

export default function OwnerCouponManage() {
  const { storeId } = useParams();
  const endpoint = `/api/owner/stores/${storeId}/coupons`;
  const info = useFetch(async () => {
    const [store, coupons, menus] = await Promise.all([api.get(`/api/owner/stores/${storeId}`), api.get(endpoint), api.get(`/api/owner/stores/${storeId}/menus`)]);
    return { store: store.data, coupons: coupons.data, menus: menus.data };
  }, [storeId]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setEditing(null); setError(''); setNotice(''); }, [storeId]);
  const save = async (event) => {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const body = { title: form.get('title').trim(), description: form.get('description'), discountRate: form.get('discountRate') === '' ? null : Number(form.get('discountRate')), validFrom: form.get('validFrom') || null, validUntil: form.get('validUntil') || null, isActive: form.has('isActive') };
    body.targetMenuId = Number(form.get('targetMenuId'));
    if (body.validFrom && body.validUntil && body.validFrom > body.validUntil) { setError('종료일은 시작일 이후로 선택해 주세요.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (editing.id) await api.patch(`${endpoint}/${editing.id}`, body); else await api.post(endpoint, body);
      setEditing(null); setNotice('쿠폰을 저장했어요.'); info.refresh();
    } catch (err) { setError(err.response?.status === 403 ? '사업자 승인 후 본인 가게의 쿠폰을 관리할 수 있어요.' : '저장하지 못했어요. 입력 내용과 연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const remove = async (coupon) => {
    if (busy || !window.confirm(`“${coupon.title}” 쿠폰을 삭제할까요?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.delete(`${endpoint}/${coupon.id}`); if (editing?.id === coupon.id) setEditing(null); setNotice('쿠폰을 삭제했어요.'); info.refresh(); }
    catch { setError('삭제하지 못했어요. 권한과 연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  return <div className="screen screen--owner"><Header title="쿠폰 관리" showRoleSwitch /><main className="screen__body">
    <Link className="store-register__back" to={ROUTES.ownerHome(storeId)}>← 주문·예약 관리로</Link>
    {info.status === 'loading' && <LoadingBox>쿠폰을 불러오고 있어요.</LoadingBox>}
    {info.status === 'error' && <MessageBox title="쿠폰을 불러오지 못했어요" actionLabel="다시 시도" onAction={info.reload} />}
    {info.status === 'ready' && <>
      <h2 className="section-title">{info.data.store.name}</h2>
      <Link className="store-register__back" to={ROUTES.ownerSelect}>다른 가게 선택</Link>
      <BigButton icon="add" disabled={busy} onClick={() => { setEditing({ isActive: true }); setError(''); setNotice(''); }}>쿠폰 추가</BigButton>
      {editing && <form key={editing.id ?? 'new'} className="card stack" onSubmit={save}><fieldset disabled={busy} className="stack">
        <legend>{editing.id ? '쿠폰 수정' : '새 쿠폰'}</legend>
        <label className="field">쿠폰 이름<input name="title" required maxLength={120} defaultValue={editing.title || ''} /></label>
        <label className="field">할인 대상 메뉴<select name="targetMenuId" defaultValue={editing.targetMenuId ?? 0}><option value="0">모든 메뉴</option>{info.data.menus.map(menu => <option key={menu.id} value={menu.id}>{menu.name}</option>)}{editing.targetMenuId && !info.data.menus.some(menu => menu.id === editing.targetMenuId) ? <option value={editing.targetMenuId}>삭제된 메뉴 · 대상을 변경해 주세요</option> : null}</select></label>
        <label className="field">설명<textarea name="description" maxLength={500} defaultValue={editing.description || ''} /></label>
        <label className="field">할인율 (%)<input name="discountRate" type="number" min="0" max="100" step="any" defaultValue={editing.discountRate ?? ''} /></label>
        <label className="field">시작일<input name="validFrom" type="date" defaultValue={editing.validFrom || ''} /></label>
        <label className="field">종료일<input name="validUntil" type="date" defaultValue={editing.validUntil || ''} /></label>
        <label><input name="isActive" type="checkbox" defaultChecked={Boolean(editing.isActive)} /> 쿠폰 사용</label>
        <BigButton type="submit" disabled={busy}>{busy ? '저장 중' : '저장'}</BigButton>
        <BigButton type="button" variant="secondary" onClick={() => setEditing(null)}>취소</BigButton>
      </fieldset></form>}
      {!info.data.coupons.length && <p>등록된 쿠폰이 없어요.</p>}
      {info.data.coupons.map(coupon => <section className="card stack" key={coupon.id}><h3>{coupon.title}</h3><p>{coupon.targetMenuId ? info.data.menus.find(menu => menu.id === coupon.targetMenuId)?.name || '삭제된 메뉴' : '모든 메뉴'}</p><p>{coupon.discountRate == null ? '기타 혜택' : `${coupon.discountRate}% 할인`} · {coupon.isActive ? '사용 중' : '사용 중지'}</p><p>{coupon.validFrom || '시작일 제한 없음'} ~ {coupon.validUntil || '종료일 제한 없음'}</p>{coupon.description && <p>{coupon.description}</p>}<BigButton variant="secondary" disabled={busy} onClick={() => { setEditing(coupon); setError(''); setNotice(''); }}>수정</BigButton><BigButton variant="dangerOutline" disabled={busy} onClick={() => remove(coupon)}>삭제</BigButton></section>)}
    </>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </main></div>;
}
