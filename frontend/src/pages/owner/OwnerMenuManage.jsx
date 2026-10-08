import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { LoadingBox, MessageBox } from '../../components/common/StateBox';
import useFetch from '../../hooks/useFetch';
import api from '../../services/api';
import PhotoManager from '../../components/owner/PhotoManager';
import { ROUTES } from '../../constants/routes';

export default function OwnerMenuManage() {
  const { storeId } = useParams();
  const endpoint = `/api/owner/stores/${storeId}/menus`;
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const nameInput = useRef(null);
  const info = useFetch(async () => {
    const [store, menus, profile] = await Promise.all([
      api.get(`/api/owner/stores/${storeId}`), api.get(endpoint), api.get('/api/auth/me'),
    ]);
    return { store: store.data, menus: menus.data, approved: profile.data.user.business?.status === 'verified' };
  }, [storeId]);
  const service = info.data?.store.orderType === 'reservation';
  const label = service ? '서비스' : '메뉴';
  const resetForm = () => { setEditingId(null); setName(''); setPrice(''); };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !info.data?.approved) return;
    const amount = Number(price);
    if (!name.trim() || price === '' || !Number.isSafeInteger(amount) || amount < 0) {
      setError('이름과 0원 이상의 정수 가격을 입력해 주세요.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const body = { name: name.trim(), price: amount };
      if (editingId === null) await api.post(endpoint, body);
      else await api.patch(`${endpoint}/${editingId}`, body);
      setNotice(`${label}를 ${editingId === null ? '등록' : '수정'}했어요.`);
      resetForm(); info.refresh();
    } catch (err) {
      setError(err.response?.status === 403 ? '사업자 승인 후 본인 가게의 메뉴를 관리할 수 있어요.' : '저장하지 못했어요. 입력 내용과 서버 연결을 확인해 주세요.');
    } finally { setBusy(false); }
  };
  const remove = async (menu) => {
    if (busy || !window.confirm(`“${menu.name}”을 삭제할까요? 기존 주문 이력은 보존됩니다.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.delete(`${endpoint}/${menu.id}`);
      if (editingId === menu.id) resetForm();
      setNotice(`${menu.name}을 삭제했어요.`); info.refresh();
    } catch (err) { setError(err.response?.status === 403 ? '사업자 승인 후 삭제할 수 있어요.' : '삭제하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  return <div className="screen screen--owner">
    <Header title="메뉴·서비스 관리" showRoleSwitch />
    <main className="screen__body"><div className="stack">
      <Link className="store-register__back" to={ROUTES.ownerHome(storeId)}>← 주문·예약 관리로</Link>
      {info.status === 'loading' && <LoadingBox>메뉴를 불러오는 중이에요…</LoadingBox>}
      {info.status === 'error' && <MessageBox tone="error" title="메뉴를 불러오지 못했어요" body="본인 가게인지 확인하고 다시 시도해 주세요."
        actionLabel="다시 시도" onAction={info.reload} actionLoading={info.retrying} />}
      {info.status === 'ready' && <>
        <h2 className="lead">{info.data.store.name}</h2>
        <PhotoManager portrait storeId={storeId} photos={info.data.store.ownerPhoto ? [info.data.store.ownerPhoto] : []} onSaved={info.refresh} disabled={!info.data.approved} />
        <PhotoManager storeId={storeId} photos={info.data.store.photos} onSaved={info.refresh} disabled={!info.data.approved} />
        <PhotoManager video storeId={storeId} photos={info.data.store.videos} onSaved={info.refresh} disabled={!info.data.approved} />
        <p>{service ? '커트·세탁·수선 같은 서비스 항목과 가격을 설정해요.' : '음식·상품 메뉴와 가격을 설정해요.'} 저장하면 고객 화면에 반영돼요.</p>
        {!info.data.approved && <p role="status">사업자 승인 후 등록·수정·삭제할 수 있어요.</p>}
        <form className="stack owner-login menu-editor" onSubmit={submit}>
          <h3>{editingId === null ? `${label} 등록` : `${label} 수정`}</h3>
          <label className="stack">{label} 이름
            <input ref={nameInput} required maxLength={120} value={name} disabled={busy || !info.data.approved}
              placeholder={service ? '예: 일반 커트' : '예: 바지락 칼국수'} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="stack">가격 (원)
            <input type="number" inputMode="numeric" required min="0" max="9007199254740991" step="1" value={price}
              disabled={busy || !info.data.approved} placeholder="예: 8000" onChange={(event) => setPrice(event.target.value)} />
          </label>
          {error && <p className="owner-login__error" role="alert">{error}</p>}
          <BigButton type="submit" loading={busy} disabled={!info.data.approved}>{editingId === null ? `${label} 등록하기` : '수정 저장'}</BigButton>
          {editingId !== null && <BigButton variant="secondary" disabled={busy} onClick={resetForm}>수정 취소</BigButton>}
        </form>
        {notice && <p role="status">{notice}</p>}
        <h3>등록된 {label} {info.data.menus.length}개</h3>
        {info.data.menus.length === 0 && <MessageBox tone="empty" icon="menu_book" title={`등록된 ${label}가 없어요`} body="위에서 이름과 가격을 입력해 첫 항목을 등록해 주세요." />}
        <ul className="stack">{info.data.menus.map((menu) => <li className="menu-manage-card stack" key={menu.id}>
          <PhotoManager storeId={storeId} menuId={menu.id} photos={menu.photo ? [menu.photo] : []} onSaved={info.refresh} disabled={!info.data.approved} />
          <PhotoManager video storeId={storeId} menuId={menu.id} photos={menu.video ? [menu.video] : []} onSaved={info.refresh} disabled={!info.data.approved} />
          <div className="menu-manage-card__heading"><strong>{menu.name}</strong><span>{menu.price.toLocaleString('ko-KR')}원</span></div>
          <div className="menu-manage-card__actions">
            <BigButton variant="secondary" size="sm" disabled={busy || !info.data.approved} onClick={() => {
              setEditingId(menu.id); setName(menu.name); setPrice(String(menu.price)); setError(''); setNotice('');
              nameInput.current?.focus(); nameInput.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }}>수정</BigButton>
            <BigButton variant="dangerOutline" size="sm" disabled={busy || !info.data.approved} onClick={() => remove(menu)}>삭제</BigButton>
          </div>
        </li>)}</ul>
      </>}
    </div></main>
  </div>;
}
